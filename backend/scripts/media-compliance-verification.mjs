import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyMediaCompliance({
  db,
  ids,
  owner,
  token,
  base,
  test,
  productEvidence,
  output,
}) {
  const call = async (
    route,
    { method = 'GET', body, session = token, origin = base } = {},
  ) => {
    const r = await fetch(origin + '/api/admin/' + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
        Authorization: 'Bearer ' + session,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  const media = `scopes/tenants/${ids.tenantId}/media`,
    ok = (r, status = 201) => {
      assert.equal(r.status, status, r.data.message ?? 'Media request failed');
      return r.data;
    };
  const imported = productEvidence[0].mapping.media[0],
    source = await db.mediaAsset.findUniqueOrThrow({
      where: { id: imported.assetId },
    });
  await test('Imported private previews are digest checked and rights/history/listing impact stay scoped', async () => {
    const preview = ok(
      await call(`${media}/assets/${source.id}/content?width=320`),
      200,
    );
    assert.ok(
      preview.private && preview.dataUrl.startsWith('data:image/webp;base64,'),
    );
    const review = ok(await call(`${media}/assets/${source.id}/review`), 200);
    assert.ok(review.publicationBlocked);
    assert.ok(
      review.affectedListings.some(
        (l) => l.listingId === productEvidence[0].listingId,
      ),
    );
    const { referencePreview } =
      await import('../dist/operations/reference-preview.js');
    await assert.rejects(() =>
      referencePreview(source.storageReference, '0'.repeat(64), 320),
    );
    await assert.rejects(() =>
      referencePreview('/../../private.key', source.contentDigest, 320),
    );
    const user = await db.adminUser.create({
      data: {
        name: 'Media view only',
        email: 'media-view-only@example.invalid',
        passwordHash: owner.passwordHash,
      },
    });
    await db.tenantMembership.create({
      data: { tenantId: ids.tenantId, userId: user.id },
    });
    const role = await db.scopedRole.create({
        data: {
          scopeKind: 'TENANT',
          tenantId: ids.tenantId,
          code: 'MEDIA_VIEW_ONLY',
          name: 'Media view only',
        },
      }),
      permission = await db.permission.findUniqueOrThrow({
        where: { code: 'media.view' },
      });
    await db.scopedRolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        scopeKind: 'TENANT',
        canDelegate: false,
      },
    });
    await db.tenantRoleAssignment.create({
      data: { tenantId: ids.tenantId, userId: user.id, roleId: role.id },
    });
    const session = randomBytes(32).toString('hex'),
      { hashToken } = await import('../dist/security/auth.service.js');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const own = ok(
      await call(`${media}/assets/${source.id}/review`, { session }),
      200,
    );
    assert.equal(
      own.affectedListings.length,
      0,
      'Media access must not grant store-listing access',
    );
    assert.equal(
      (
        await call(`${media}/assets/${source.id}/reject`, {
          session,
          method: 'POST',
          body: { revision: source.revision, reason: 'Must not approve' },
        })
      ).status,
      403,
    );
    const foreign = await db.tenant.create({
        data: { slug: 'media_foreign_fixture', name: 'Foreign media' },
      }),
      asset = await db.mediaAsset.create({
        data: {
          tenantId: foreign.id,
          code: 'foreign',
          mimeType: 'image/png',
          createdBy: owner.id,
        },
      });
    assert.equal(
      (await call(`${media}/assets/${asset.id}/review`)).status,
      404,
    );
    assert.equal(
      (await call(`${media}/assets/${asset.id}/content?width=320`)).status,
      404,
    );
  });
  await test('Real approval/rejection records preserve reviewer/evidence/conditions and cannot authorize by URL alone', async () => {
    const bytes = await sharp({
      create: { width: 50, height: 80, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    let asset = ok(
      await call(media + '/uploads', {
        method: 'POST',
        body: {
          uploadKey: randomUUID(),
          fileName: 'compliance-fixture.png',
          mimeType: 'image/png',
          dataBase64: bytes.toString('base64'),
          altText: 'Synthetic review fixture',
          intendedPurpose: 'DETAIL_POSTER',
        },
      }),
    );
    assert.equal(
      (
        await call(`${media}/assets/${asset.id}/approve`, {
          method: 'POST',
          body: {
            revision: asset.revision,
            license: 'https://example.invalid/photo',
            attribution: '',
            scope: 'PUBLIC',
          },
        })
      ).status,
      400,
    );
    asset = ok(
      await call(`${media}/assets/${asset.id}/reject`, {
        method: 'POST',
        body: {
          revision: asset.revision,
          reason: 'Commercial permission not established',
          evidenceUrl: 'https://example.invalid/evidence',
          conditions: 'Keep private',
        },
      }),
    );
    assert.equal(asset.rights, 'RESTRICTED');
    assert.equal(asset.publicUse, false);
    const rejected = await db.mediaReview.findFirstOrThrow({
      where: { assetId: asset.id },
    });
    assert.equal(rejected.reviewerId, owner.id);
    assert.equal(rejected.decision, 'REJECT');
    assert.equal(rejected.conditions, 'Keep private');
    await assert.rejects(() =>
      db.mediaReview.update({
        where: { id: rejected.id },
        data: { conditions: 'overwrite' },
      }),
    );
    assert.equal(
      (
        await call(`${media}/assets/${asset.id}/reject`, {
          method: 'POST',
          body: { revision: 1, reason: 'stale' },
        })
      ).status,
      409,
    );
    asset = ok(
      await call(`${media}/assets/${asset.id}/approve`, {
        method: 'POST',
        body: {
          revision: asset.revision,
          license: 'Synthetic original fixture owned by test',
          attribution: 'Isolated fixture',
          scope: 'DEVELOPMENT',
          evidenceNote: 'Generated in this disposable test only',
          conditions: 'Development testing only',
        },
      }),
    );
    assert.equal(asset.developmentOnly, true);
    assert.equal(asset.publicUse, false);
    const review = ok(await call(`${media}/assets/${asset.id}/review`), 200);
    assert.equal(review.reviews.length, 2);
    assert.ok(
      review.reviews.every((r) => r.reviewer.id === owner.id && r.createdAt),
    );
    assert.equal(
      await db.mediaAsset.count({
        where: {
          id: {
            in: productEvidence.flatMap((e) =>
              e.mapping.media.map((m) => m.assetId),
            ),
          },
          rights: 'APPROVED',
        },
      }),
      0,
      'No imported image approved by tests',
    );
  });
  await test('Production-mode staging dry-run leaves catalog writes/public reads off while health and Owner reads work', async () => {
    const port = await new Promise((resolve) => {
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
          const p = s.address().port;
          s.close(() => resolve(p));
        });
      }),
      origin = `http://127.0.0.1:${port}`;
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      ADMIN_ORIGIN: 'https://admin.example.invalid',
      STOREFRONT_ORIGIN: 'https://store.example.invalid',
    };
    delete env.CATALOG_ADMIN_WRITES_ENABLED;
    delete env.PUBLIC_CATALOG_MODE;
    delete env.MEDIA_REFERENCE_PREVIEW;
    const before = {
        products: await db.product.count(),
        reviews: await db.mediaReview.count(),
        prices: await db.storePrice.count(),
      },
      server = spawn(process.execPath, ['dist/main.js'], {
        env,
        stdio: 'pipe',
      });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});
    try {
      for (let n = 0; n < 150; n++) {
        try {
          if ((await fetch(origin + '/api/health/ready')).ok) break;
        } catch {}
        if (n === 149) throw Error('Production dry-run startup failed');
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(
        (await fetch(origin + '/api/catalog/navigation')).status,
        503,
      );
      assert.equal((await call('auth/me', { origin })).status, 200);
      assert.equal(
        (await call(`stores/${ids.storeId}/listings`, { origin })).status,
        200,
      );
      assert.equal(
        (
          await call(`scopes/tenants/${ids.tenantId}/schema/product-types`, {
            origin,
            method: 'POST',
            body: { code: 'blocked_creation', label: 'Must not create' },
          })
        ).status,
        503,
      );
      assert.equal(
        (
          await call(`${media}/assets/${source.id}/reject`, {
            origin,
            method: 'POST',
            body: {
              revision: source.revision,
              reason: 'Must remain unchanged',
            },
          })
        ).status,
        503,
      );
      assert.equal(
        (
          await call(`${media}/assets/${source.id}/content?width=320`, {
            origin,
          })
        ).status,
        404,
      );
      assert.deepEqual(
        {
          products: await db.product.count(),
          reviews: await db.mediaReview.count(),
          prices: await db.storePrice.count(),
        },
        before,
      );
    } finally {
      if (server.exitCode === null) {
        server.kill();
        await once(server, 'exit');
      }
    }
  });
  await fs.writeFile(
    path.join(output, 'media-workflow.json'),
    JSON.stringify(
      {
        passed: true,
        importedAssetsApproved: 0,
        privateReferencePreview: true,
        hashChecks: true,
        reviewerAudit: true,
        rejection: true,
        storeImpactAuthorization: true,
        foreignTenantDenied: true,
        productionModeDryRun: true,
        productionAccess: false,
        fixturesOnly: true,
      },
      null,
      2,
    ) + '\n',
  );
}
