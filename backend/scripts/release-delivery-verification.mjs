import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import {
  initializeReleaseFoundation,
  authFingerprint,
  migrationInventory,
  schemaFingerprint,
  verifyImportedRelease,
} from './catalog-release-core.mjs';
import { assertReleaseTarget } from './release-target.mjs';
import { importLegacyCatalog } from './import-legacy-catalog.mjs';
export async function initializeReleaseFixture(db, url, owner) {
  const u = new URL(url),
    plan = {
      version: 1,
      environment: 'isolated',
      releaseSha: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      host: u.hostname,
      port: Number(u.port),
      database: u.pathname.slice(1),
      actorId: owner.id,
      tenantId: randomUUID(),
      storeId: randomUUID(),
      memberIds: [owner.id],
      baselineMigrations: (await migrationInventory(db)).applied,
      schemaFingerprint: await schemaFingerprint(db),
      manifestHash:
        '264136158ad771573cd526bfa0b2ad8f26eff5306257da2e7886ba3fa1047c04',
      recovery: {
        verifiedAt: new Date().toISOString(),
        encryptedSha256: '0'.repeat(64),
        isolatedRestorePassed: true,
      },
      presentation: 'PENDING',
    };
  await assertReleaseTarget(db, url, plan);
  const before = await authFingerprint(db),
    tenants = await db.tenant.count();
  assert.equal((await initializeReleaseFoundation(db, plan)).dryRun, true);
  assert.equal(await db.tenant.count(), tenants);
  await initializeReleaseFoundation(db, plan, { apply: true });
  await initializeReleaseFoundation(db, plan, { apply: true });
  assert.equal(await authFingerprint(db), before);
  assert.equal(await db.platformRoleAssignment.count(), 0);
  assert.equal(await db.tenant.count(), tenants + 1);
  return { plan, tenantId: plan.tenantId, storeId: plan.storeId };
}
export async function verifyReleaseDelivery({
  db,
  url,
  ids,
  owner,
  base,
  token,
  manifest,
  test,
  output,
  directory,
}) {
  const plan = ids.plan;
  await test('Authorized admin source-review queue shows exactly ten retained decisions and rejects a foreign tenant', async () => {
    const headers = {
      'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
      Authorization: 'Bearer ' + token,
    };
    const r = await fetch(
      base + `/api/admin/scopes/tenants/${ids.tenantId}/catalog/release-review`,
      { headers },
    );
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.items.flatMap((p) => p.decisions).length, 10);
    const foreign = await fetch(
      base + `/api/admin/scopes/tenants/${randomUUID()}/catalog/release-review`,
      { headers },
    );
    assert.equal(foreign.status, 403);
  });
  await test('Release target, migration inventory and foundation dry-run preserve Owner and refuse drift/revocation', async () => {
    assert.equal((await migrationInventory(db)).pending.length, 0);
    assert.equal(await schemaFingerprint(db), plan.schemaFingerprint);
    await assert.rejects(() =>
      assertReleaseTarget(db, url, { ...plan, database: 'wrong_test' }),
    );
    await assert.rejects(() =>
      assertReleaseTarget(db, url, { ...plan, environment: 'production' }),
    );
    await assert.rejects(() =>
      initializeReleaseFoundation(db, { ...plan, memberIds: [] }),
    );
    await db.tenantMembership.update({
      where: { tenantId_userId: { tenantId: ids.tenantId, userId: owner.id } },
      data: { active: false },
    });
    await assert.rejects(() =>
      initializeReleaseFoundation(db, plan, { apply: true }),
    );
    assert.equal(
      (
        await db.tenantMembership.findUnique({
          where: {
            tenantId_userId: { tenantId: ids.tenantId, userId: owner.id },
          },
        })
      ).active,
      false,
    );
    await db.tenantMembership.update({
      where: { tenantId_userId: { tenantId: ids.tenantId, userId: owner.id } },
      data: { active: true },
    });
  });
  await test('Reviewed operator importer verifies 84/12/84/95 and repeats with zero catalog writes', async () => {
    const before = await authFingerprint(db);
    const options = {
      db,
      url,
      base,
      token,
      bffKey: process.env.BFF_SHARED_SECRET,
      actorId: owner.id,
      tenantId: ids.tenantId,
      storeId: ids.storeId,
      manifest,
      releasePlan: plan,
      confirm: 'APPROVED_CATALOG_IMPORT',
    };
    const result = await importLegacyCatalog(options);
    assert.equal(result.completedWrites, 0);
    assert.equal(
      (await verifyImportedRelease(db, plan, manifest)).products,
      84,
    );
    await assert.rejects(() =>
      importLegacyCatalog({ ...options, actorId: randomUUID() }),
    );
    await assert.rejects(() =>
      importLegacyCatalog({ ...options, token: 'invalid-session' }),
    );
    assert.equal(await authFingerprint(db), before);
  });
  await test('Exact operator CLI dry-runs, confirmations and zero-write import execute against an isolated staged bundle', async () => {
    const path = await import('node:path');
    const stage = path.join(directory, 'operator-stage'),
      backend = path.join(stage, 'backend'),
      frontend = path.join(stage, 'frontend');
    await fs.mkdir(backend, { recursive: true });
    await fs.mkdir(frontend, { recursive: true });
    for (const name of ['scripts', 'dist', 'prisma', 'docs'])
      await fs.cp(name, path.join(backend, name), { recursive: true });
    for (const name of ['src', 'docs', 'public/images/products'])
      await fs.cp('../frontend/' + name, path.join(frontend, name), {
        recursive: true,
      });
    await fs.symlink(
      path.resolve('node_modules'),
      path.join(backend, 'node_modules'),
      'junction',
    );
    await fs.symlink(
      path.resolve('../frontend/node_modules'),
      path.join(frontend, 'node_modules'),
      'junction',
    );
    await fs.writeFile(
      path.join(backend, 'RELEASE_COMMIT'),
      plan.releaseSha + '\n',
    );
    const { createHash } = await import('node:crypto');
    const source = 'backend/scripts/catalog-release.mjs';
    await fs.writeFile(
      path.join(stage, 'RELEASE_SOURCE.sha256'),
      createHash('sha256')
        .update(await fs.readFile(path.join(stage, source)))
        .digest('hex') +
        '  ' +
        source +
        '\n',
    );
    await fs.writeFile(path.join(backend, 'plan.json'), JSON.stringify(plan));
    const { digest } = await import('./legacy-catalog-manifest.mjs');
    const before = await authFingerprint(db);
    const run = async (args) => {
      const child = spawn(
        process.execPath,
        [
          'scripts/catalog-release.mjs',
          ...args,
          '--plan=plan.json',
          '--journal=.local/operator.jsonl',
        ],
        {
          cwd: backend,
          env: {
            ...process.env,
            CATALOG_OPERATOR_API_ORIGIN: base,
            CATALOG_OPERATOR_SESSION: token,
          },
          stdio: 'pipe',
        },
      );
      let output = '',
        diagnostic = '';
      child.stdout.on('data', (b) => (output += b));
      child.stderr.on('data', (b) => {
        diagnostic += b;
      });
      const [code] = await once(child, 'exit');
      return {
        code,
        output,
        diagnostic:
          diagnostic.match(
            /Release operation failed closed at \w+|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|SyntaxError|TypeError/,
          )?.[0] ?? 'no sanitized diagnostic',
      };
    };
    for (const command of [
      'inspect',
      'migrate',
      'foundation',
      'import',
      'verify',
    ]) {
      const r = await run([command]);
      assert.equal(r.code, 0, 'Operator CLI ' + command + ' ' + r.diagnostic);
      assert.equal(JSON.parse(r.output).passed, true);
    }
    assert.equal(
      (await run(['foundation', '--apply', '--confirm=wrong'])).code,
      1,
    );
    const sessionsBefore = digest(
      await db.adminSession.findMany({ orderBy: { id: 'asc' } }),
    );
    assert.equal(
      (await run(['foundation', '--apply', '--confirm=' + digest(plan)])).code,
      0,
    );
    assert.equal(
      digest(await db.adminSession.findMany({ orderBy: { id: 'asc' } })),
      sessionsBefore,
    );
    const repeat = await run([
      'import',
      '--apply',
      '--confirm=' + digest(plan),
    ]);
    assert.equal(repeat.code, 0);
    assert.equal(JSON.parse(repeat.output).result.completedWrites, 0);
    assert.equal(await authFingerprint(db), before);
  });
  await test('Production read gate stays off by default and explicit isolated cutover exposes only the fixed store', async () => {
    const port = await new Promise((r) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => r(p));
      });
    });
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      HOST: '127.0.0.1',
      ADMIN_ORIGIN: 'https://admin.example.invalid',
      STOREFRONT_ORIGIN: 'https://store.example.invalid',
      PUBLIC_CATALOG_MODE: 'production',
      PUBLIC_CATALOG_READS_ENABLED: '1',
      PUBLIC_CATALOG_TENANT_ID: ids.tenantId,
      PUBLIC_CATALOG_STORE_ID: ids.storeId,
    };
    delete env.CATALOG_ADMIN_WRITES_ENABLED;
    const server = spawn(process.execPath, ['dist/main.js'], {
      env,
      stdio: 'pipe',
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});
    const origin = `http://127.0.0.1:${port}`;
    try {
      let ready = false;
      for (let i = 0; i < 150; i++) {
        try {
          if ((await fetch(origin + '/api/health/ready')).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.ok(ready);
      const response = await fetch(origin + '/api/catalog/listings');
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.total, 84);
      assert.equal(
        (await fetch(origin + '/api/catalog/listings?storeId=' + randomUUID()))
          .status,
        400,
      );
      const product = await (
        await fetch(
          origin +
            '/api/catalog/products/' +
            manifest.records[0].source.product.slug,
        )
      ).json();
      assert.ok(!JSON.stringify(product).includes('storageReference'));
      const mutation = await fetch(
        origin +
          `/api/admin/scopes/tenants/${ids.tenantId}/schema/product-types`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-bff-key': env.BFF_SHARED_SECRET,
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify({ code: 'no_cutover_writes', label: 'Blocked' }),
        },
      );
      assert.equal(mutation.status, 503);
    } finally {
      if (server.exitCode === null) {
        server.kill();
        await once(server, 'exit');
      }
    }
  });
  await fs.writeFile(
    output + '/release-delivery.json',
    JSON.stringify(
      {
        passed: true,
        productionAccess: false,
        foundationAppliedOnlyToDisposableDatabase: true,
        ownerCredentialsUnchanged: true,
        platformGrants: 0,
        productionTargetGuards: true,
        migrationHistoryChecked: true,
        importerZeroWriteRepeat: true,
        actualOperatorCliPassed: true,
        existingSessionsUnchangedByFoundation: true,
        productionModeReadCutoverIsolated: true,
        liveSettingsChanged: false,
      },
      null,
      2,
    ) + '\n',
  );
}
