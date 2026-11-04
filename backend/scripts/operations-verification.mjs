import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { Client } from 'pg';
export async function verifyOperations({
  db,
  ids,
  owner,
  token,
  bToken,
  tenantB,
  member,
  base,
  test,
  hashToken,
}) {
  await test('Milestone 5 additive migration preserves populated catalog and media facts', async () => {
    const target = new URL(process.env.DATABASE_URL),
      name = `operations_upgrade_${randomBytes(6).toString('hex')}_test`,
      control = new Client({ connectionString: target.href });
    await control.connect();
    try {
      await control.query(`CREATE DATABASE "${name}"`);
    } finally {
      await control.end();
    }
    target.pathname = '/' + name;
    const pg = new Client({ connectionString: target.href });
    await pg.connect();
    try {
      for (const dir of (
        await fs.readdir('prisma/migrations', { withFileTypes: true })
      )
        .filter(
          (d) =>
            d.isDirectory() && d.name < '202611010005_pricing_inventory_media',
        )
        .map((d) => d.name)
        .sort())
        await pg.query(
          await fs.readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'),
        );
      const tenant = randomUUID(),
        store = randomUUID(),
        type = randomUUID(),
        product = randomUUID(),
        asset = randomUUID();
      await pg.query('INSERT INTO "Tenant" (id,slug,name) VALUES ($1,$2,$3)', [
        tenant,
        'preserved',
        'Preserved',
      ]);
      await pg.query(
        'INSERT INTO "Store" (id,"tenantId",slug,name) VALUES ($1,$2,$3,$4)',
        [store, tenant, 'preserved', 'Preserved'],
      );
      await pg.query(
        'INSERT INTO "ProductType" (id,"tenantId",code,label) VALUES ($1,$2,$3,$4)',
        [type, tenant, 'preserved', 'Preserved'],
      );
      await pg.query(
        'INSERT INTO "Product" (id,"tenantId","productTypeId",code,"createdBy") VALUES ($1,$2,$3,$4,$5)',
        [product, tenant, type, 'preserved', owner.id],
      );
      await pg.query(
        'INSERT INTO "MediaAsset" (id,"tenantId",code,"mimeType","createdBy") VALUES ($1,$2,$3,$4,$5)',
        [asset, tenant, 'preserved', 'image/webp', owner.id],
      );
      const before = (await pg.query('SELECT * FROM "Product"')).rows;
      await pg.query('BEGIN');
      await pg.query(
        await fs.readFile(
          'prisma/migrations/202611010005_pricing_inventory_media/migration.sql',
          'utf8',
        ),
      );
      await pg.query('COMMIT');
      assert.deepEqual(
        (await pg.query('SELECT * FROM "Product"')).rows,
        before,
      );
      const media = (
        await pg.query(
          'SELECT "publicUse","developmentOnly","storageProvider","storedBytes" FROM "MediaAsset"',
        )
      ).rows[0];
      assert.deepEqual(media, {
        publicUse: false,
        developmentOnly: true,
        storageProvider: 'REFERENCE',
        storedBytes: 0,
      });
      assert.equal(
        (await pg.query('SELECT "timeZone" FROM "Store"')).rows[0].timeZone,
        'UTC',
      );
    } finally {
      await pg.end();
    }
  });
  const request = async (
    path,
    { method = 'GET', body, session = token } = {},
  ) => {
    const r = await fetch(`${base}/api/admin/${path}`, {
      method,
      headers: {
        'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
        Authorization: `Bearer ${session}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, data: await r.json() };
  };
  const ok = (r, status = 201) => {
    assert.equal(
      r.status,
      status,
      `${r.status}: ${r.data.message ?? 'unexpected operations response'}`,
    );
    return r.data;
  };
  const ops = `stores/${ids.storeId}/operations`,
    media = `scopes/tenants/${ids.tenantId}/media`;
  const product = await db.product.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'default_product' },
      },
      include: { skus: true },
    }),
    sku = product.skus[0],
    mouse = await db.product.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'sensor_mouse' },
      },
      include: { skus: true },
    }),
    secondSku = mouse.skus[0];
  const pricePath = (s = sku.id, store = ids.storeId) =>
    `stores/${store}/operations/skus/${s}/prices`;
  const priceAction = async (row, a, store = ids.storeId, s = sku.id) =>
    ok(
      await request(`${pricePath(s, store)}/${row.id}/actions/${a}`, {
        method: 'POST',
        body: {
          revision: row.revision,
          rootRevision: row.rootRevision ?? row.price.revision,
        },
      }),
    );
  const publish = async (row, store = ids.storeId, s = sku.id) =>
    priceAction(
      await priceAction(
        await priceAction(row, 'review', store, s),
        'approve',
        store,
        s,
      ),
      'publish',
      store,
      s,
    );
  const now = Date.now(),
    iso = (ms) => new Date(ms).toISOString(),
    offer = (regular = '1000', extra = {}) => ({
      currency: 'PKR',
      regularAmount: regular,
      promotions: [],
      ...extra,
    });
  let published, defaultLocation;
  await test('Approved store offers, exact amounts, scheduling, expiry and reference-only gating', async () => {
    let r = ok(
      await request(pricePath(), {
        method: 'POST',
        body: offer('1000.00', {
          promotions: [
            {
              amount: '900',
              startsAt: iso(now - 60000),
              endsAt: iso(now + 3600000),
              label: 'Active promotion',
            },
          ],
        }),
      }),
    );
    assert.equal(ok(await request(pricePath()), 200).effectiveOffer, null);
    published = await publish(r);
    assert.equal(
      ok(await request(pricePath()), 200).effectiveOffer.sellingAmount,
      '900',
    );
    assert.equal(
      ok(await request(`${ops}/skus/${sku.id}/quote`), 200).offer,
      null,
    ); // catalog remains REFERENCE
    assert.equal(
      ok(await request(`${ops}/skus/${sku.id}/quote`), 200).purchasable,
      false,
    );
    const other = ok(
      await request(pricePath(secondSku.id), {
        method: 'POST',
        body: offer('2500', {
          promotions: [
            {
              amount: '2000',
              startsAt: '2020-01-01T00:00:00Z',
              endsAt: '2020-02-01T00:00:00Z',
              label: 'Expired promotion',
            },
          ],
        }),
      }),
    );
    await publish(other, ids.storeId, secondSku.id);
    assert.equal(
      ok(await request(pricePath(secondSku.id)), 200).effectiveOffer
        .sellingAmount,
      '2500',
    );
  });
  await test('Invalid currency precision, discounts, overlapping windows and stale price approvals reject', async () => {
    for (const input of [
      offer('-1'),
      offer('1.001'),
      offer('100', {
        promotions: [
          {
            amount: '100',
            startsAt: iso(now),
            endsAt: iso(now + 2000),
            label: 'Invalid',
          },
        ],
      }),
      offer('100', { currency: 'USD' }),
      offer('100', {
        promotions: [
          {
            amount: '90',
            startsAt: iso(now),
            endsAt: iso(now + 2000),
            label: 'One',
          },
          {
            amount: '80',
            startsAt: iso(now + 1000),
            endsAt: iso(now + 3000),
            label: 'Overlapping',
          },
        ],
      }),
      offer('100', { validFrom: iso(now + 1000), validUntil: iso(now) }),
    ])
      assert.equal(
        (await request(pricePath(), { method: 'POST', body: input })).status,
        400,
      );
    let r = ok(
      await request(pricePath(), { method: 'POST', body: offer('1100') }),
    );
    r = await priceAction(r, 'review');
    const result = await Promise.all(
      [1, 2].map(() =>
        request(`${pricePath()}/${r.id}/actions/approve`, {
          method: 'POST',
          body: { revision: r.revision },
        }),
      ),
    );
    assert.deepEqual(result.map((r) => r.status).sort(), [201, 409]);
    await assert.rejects(() =>
      db.priceRevision.update({
        where: { id: published.id },
        data: { regularAmount: '1' },
      }),
    );
    await assert.rejects(() =>
      db.priceApproval.deleteMany({ where: { priceRevisionId: published.id } }),
    );
  });
  const other = await db.store.findFirstOrThrow({
    where: { tenantId: ids.tenantId, slug: 'other' },
  });
  await test('The same catalog SKU has independent offers in two explicitly authorized stores', async () => {
    await db.storeMembership.create({
      data: { tenantId: ids.tenantId, storeId: other.id, userId: owner.id },
    });
    const role = await db.scopedRole.create({
      data: {
        tenantId: ids.tenantId,
        storeId: other.id,
        scopeKind: 'STORE',
        code: 'OPERATOR_OTHER',
        name: 'Other store operator',
      },
    });
    const capabilities = await db.permission.findMany({
      where: {
        code: {
          in: [
            'pricing.view',
            'pricing.propose',
            'pricing.approve',
            'pricing.publish',
            'pricing.archive',
            'inventory.view',
            'inventory.adjust',
            'inventory.configure',
            'inventory.audit',
          ],
        },
      },
    });
    await db.scopedRolePermission.createMany({
      data: capabilities.map((p) => ({
        roleId: role.id,
        permissionId: p.id,
        scopeKind: 'STORE',
        canDelegate: false,
      })),
    });
    await db.storeRoleAssignment.create({
      data: {
        tenantId: ids.tenantId,
        storeId: other.id,
        userId: owner.id,
        roleId: role.id,
      },
    });
    await publish(
      ok(
        await request(pricePath(sku.id, other.id), {
          method: 'POST',
          body: offer('750'),
        }),
      ),
      other.id,
    );
    assert.equal(
      ok(await request(pricePath(sku.id, other.id)), 200).effectiveOffer
        .sellingAmount,
      '750',
    );
    assert.equal(
      ok(await request(pricePath()), 200).effectiveOffer.sellingAmount,
      '900',
    );
  });
  const stock = `${ops}/skus/${sku.id}/inventory`;
  const adjust = (body) =>
    request(`${stock}/adjustments`, { method: 'POST', body });
  await test('Unknown stock, verified zero, quantity counts and append-only history are distinct', async () => {
    assert.equal(ok(await request(stock), 200).summary.quantity, null);
    defaultLocation = ok(await request(`${ops}/locations`), 200).find(
      (l) => l.isDefault,
    );
    assert.ok(defaultLocation);
    assert.equal(
      (
        await request(`${ops}/locations`, {
          method: 'POST',
          body: {
            code: 'second_default',
            name: 'Second default',
            isDefault: true,
          },
        })
      ).status,
      409,
    );
    const additionalLocation = ok(
      await request(`${ops}/locations`, {
        method: 'POST',
        body: {
          code: 'warehouse',
          name: 'Additional development location',
          isDefault: false,
        },
      }),
    );
    ok(
      await request(stock, {
        method: 'PATCH',
        body: { revision: 0, policy: 'QUANTITY', lowStockThreshold: 2 },
      }),
      200,
    );
    ok(
      await request(`${stock}/adjustments`, {
        method: 'POST',
        body: {
          locationId: additionalLocation.id,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
          mode: 'COUNT',
          quantity: 0,
          reason: 'Additional location physical zero',
        },
      }),
    );
    assert.equal(
      (
        await adjust({
          locationId: defaultLocation.id,
          expectedRevision: 0,
          idempotencyKey: randomUUID(),
          mode: 'DELTA',
          quantity: 1,
          reason: 'Unknown stock cannot receive a delta',
        })
      ).status,
      409,
    );
    const count = ok(
      await adjust({
        locationId: defaultLocation.id,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        mode: 'COUNT',
        quantity: 0,
        reason: 'Physical zero verified',
      }),
    );
    assert.equal(count.movement.afterKnown, true);
    assert.equal(ok(await request(stock), 200).summary.quantity, 0);
    assert.equal(ok(await request(stock), 200).summary.status, 'OUT_OF_STOCK');
    await assert.rejects(() =>
      db.inventoryMovement.update({
        where: { id: count.movement.id },
        data: { afterQuantity: 50 },
      }),
    );
    await assert.rejects(() =>
      db.stockBalance.update({
        where: { id: count.movement.balanceId },
        data: { onHand: 100, revision: { increment: 1 } },
      }),
    );
  });
  await test('Concurrent quantity adjustments, idempotent retries, negative stock and explicit invalidation are safe', async () => {
    const first = {
      locationId: defaultLocation.id,
      expectedRevision: 1,
      idempotencyKey: randomUUID(),
      mode: 'COUNT',
      quantity: 5,
      reason: 'Opening verified count',
    };
    const a = ok(await adjust(first));
    const duplicate = ok(await adjust(first));
    assert.equal(duplicate.replayed, true);
    assert.equal(duplicate.movement.id, a.movement.id);
    assert.equal((await adjust({ ...first, quantity: 6 })).status, 409);
    const results = await Promise.all(
      [1, 2].map(() =>
        adjust({
          locationId: defaultLocation.id,
          expectedRevision: 2,
          idempotencyKey: randomUUID(),
          mode: 'DELTA',
          quantity: -4,
          reason: 'One authorized correction',
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(ok(await request(stock), 200).summary.quantity, 1);
    assert.equal(
      (
        await adjust({
          locationId: defaultLocation.id,
          expectedRevision: 3,
          idempotencyKey: randomUUID(),
          mode: 'DELTA',
          quantity: -2,
          reason: 'Would create negative stock',
        })
      ).status,
      400,
    );
    ok(
      await adjust({
        locationId: defaultLocation.id,
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
        mode: 'INVALIDATE',
        quantity: 0,
        reason: 'Count disputed pending recount',
      }),
    );
    assert.equal(ok(await request(stock), 200).summary.quantity, null);
    ok(
      await adjust({
        locationId: defaultLocation.id,
        expectedRevision: 4,
        idempotencyKey: randomUUID(),
        mode: 'COUNT',
        quantity: 3,
        reason: 'Recount physically verified',
      }),
    );
  });
  await test('Cross-store locations, non-quantity policies and stale catalog drafts cannot overwrite stock or prices', async () => {
    const foreignLocation = ok(
      await request(`stores/${other.id}/operations/locations`, {
        method: 'POST',
        body: { code: 'main', name: 'Other location', isDefault: true },
      }),
    );
    assert.equal(
      (
        await adjust({
          locationId: foreignLocation.id,
          expectedRevision: 5,
          idempotencyKey: randomUUID(),
          mode: 'COUNT',
          quantity: 100,
          reason: 'Foreign location rejected',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(stock, {
          method: 'PATCH',
          body: { revision: 1, policy: 'SERIALIZED', lowStockThreshold: null },
        })
      ).status,
      409,
    );
    const otherStock = `${ops}/skus/${secondSku.id}/inventory`;
    ok(
      await request(otherStock, {
        method: 'PATCH',
        body: { revision: 0, policy: 'SERIALIZED', lowStockThreshold: null },
      }),
      200,
    );
    assert.equal(
      ok(await request(otherStock), 200).summary.status,
      'SERIALIZED_NOT_IMPLEMENTED',
    );
    assert.equal(
      (
        await request(`${otherStock}/adjustments`, {
          method: 'POST',
          body: {
            locationId: defaultLocation.id,
            expectedRevision: 0,
            idempotencyKey: randomUUID(),
            mode: 'COUNT',
            quantity: 1,
            reason: 'Not a quantity policy',
          },
        })
      ).status,
      400,
    );
    const before = ok(await request(stock), 200).summary.quantity;
    for (const [policy, revision, status] of [
      ['NON_STOCK', 1, 'INVENTORY_NOT_REQUIRED'],
      ['UNTRACKED', 2, 'UNKNOWN'],
    ]) {
      ok(
        await request(otherStock, {
          method: 'PATCH',
          body: { revision, policy, lowStockThreshold: null },
        }),
        200,
      );
      const result = ok(await request(otherStock), 200);
      assert.equal(result.summary.status, status);
      assert.equal(result.summary.quantity, null);
      assert.equal(result.purchasable, false);
    }
    const draft = await db.productRevision.findFirstOrThrow({
      where: { productId: product.id, status: 'DRAFT' },
    });
    assert.equal(
      (
        await request(
          `scopes/tenants/${ids.tenantId}/catalog/products/${product.id}/revisions/${draft.id}`,
          {
            method: 'PATCH',
            body: { revision: draft.revision, stock: 999, price: 1 },
          },
        )
      ).status,
      400,
    );
    assert.equal(ok(await request(stock), 200).summary.quantity, before);
    assert.equal(
      ok(await request(pricePath()), 200).effectiveOffer.sellingAmount,
      '900',
    );
  });
  const bytes = await sharp({
    create: {
      width: 640,
      height: 1200,
      channels: 3,
      background: { r: 24, g: 48, b: 80 },
    },
  })
    .png()
    .toBuffer();
  const upload = (altText = 'Synthetic development poster') => ({
    uploadKey: randomUUID(),
    fileName: 'fixture.png',
    mimeType: 'image/png',
    dataBase64: bytes.toString('base64'),
    altText,
    caption: 'Synthetic non-product test fixture',
    intendedPurpose: 'DETAIL_POSTER',
    sourceUrl: 'https://example.invalid/synthetic-test-fixture',
  });
  let asset, secondAsset;
  await test('Real signature validation, private local WebP derivatives and idempotent image upload work', async () => {
    const body = upload();
    asset = ok(await request(`${media}/uploads`, { method: 'POST', body }));
    assert.equal(asset.mimeType, 'image/webp');
    assert.equal(asset.developmentOnly, true);
    assert.equal(asset.publicUse, false);
    assert.equal(
      ok(await request(`${media}/uploads`, { method: 'POST', body })).id,
      asset.id,
    );
    const content = ok(
      await request(`${media}/assets/${asset.id}/content?width=320`),
      200,
    );
    assert.ok(content.dataUrl.startsWith('data:image/webp;base64,'));
    const image = await sharp(
      Buffer.from(content.dataUrl.split(',')[1], 'base64'),
    ).metadata();
    assert.equal(image.width, 320);
    assert.equal(image.exif, undefined);
    for (const body of [
      {
        ...upload(),
        dataBase64: Buffer.from('<svg onload="alert(1)"></svg>').toString(
          'base64',
        ),
      },
      { ...upload(), mimeType: 'image/jpeg' },
      { ...upload(), dataBase64: 'invalid..' },
      { ...upload(), fetchUrl: 'https://example.invalid/remote.png' },
    ])
      assert.equal(
        (await request(`${media}/uploads`, { method: 'POST', body })).status,
        400,
      );
    assert.equal(
      (await request(`${media}/assets/${asset.id}/content?width=9999`)).status,
      400,
    );
  });
  await test('Media rights approval, ordered shared/SKU posters, stale reordering and published references are protected', async () => {
    const draft = await db.productRevision.findFirstOrThrow({
        where: { productId: product.id, status: 'DRAFT' },
        include: { skus: true },
      }),
      assign = `${media}/products/${product.id}/revisions/${draft.id}/assignments`;
    const refs = (assetId, altText) => ({
      assetId,
      purpose: 'DETAIL_POSTER',
      altText,
      caption: null,
      visible: true,
      presentation: {
        fit: 'contain',
        loading: 'lazy',
        alignment: 'center',
        widths: [320, 640],
      },
    });
    asset = ok(
      await request(`${media}/assets/${asset.id}/approve`, {
        method: 'POST',
        body: {
          revision: asset.revision,
          license: 'Synthetic test image created locally; no third-party photo',
          attribution: 'Isolated test fixture',
          scope: 'PUBLIC',
        },
      }),
    );
    assert.equal(asset.publicUse, true);
    secondAsset = ok(
      await request(`${media}/uploads`, {
        method: 'POST',
        body: upload('Second synthetic poster'),
      }),
    );
    secondAsset = ok(
      await request(`${media}/assets/${secondAsset.id}/approve`, {
        method: 'POST',
        body: {
          revision: secondAsset.revision,
          license: 'Synthetic fixture owned by test',
          attribution: 'Isolated fixture',
          scope: 'PUBLIC',
        },
      }),
    );
    const payload = {
      revision: draft.revision,
      references: [
        refs(asset.id, 'First poster'),
        refs(secondAsset.id, 'Second poster'),
      ],
    };
    ok(await request(assign, { method: 'PATCH', body: payload }), 200);
    assert.equal(
      (await request(assign, { method: 'PATCH', body: payload })).status,
      409,
    );
    let current = ok(await request(assign), 200);
    assert.deepEqual(
      current.shared.map((r) => r.assetId),
      [asset.id, secondAsset.id],
    );
    ok(
      await request(assign, {
        method: 'PATCH',
        body: {
          revision: current.revision,
          references: [
            ...payload.references,
            { ...refs(asset.id, 'First gallery image'), purpose: 'GALLERY' },
            {
              ...refs(secondAsset.id, 'Second gallery image'),
              purpose: 'GALLERY',
            },
          ],
        },
      }),
      200,
    );
    current = ok(await request(assign), 200);
    assert.equal(
      current.shared.filter((r) => r.purpose === 'GALLERY').length,
      2,
    );
    assert.equal(
      current.shared.filter((r) => r.purpose === 'DETAIL_POSTER').length,
      2,
    );
    ok(
      await request(
        `${media}/products/${product.id}/revisions/${draft.id}/skus/${draft.skus[0].id}/assignments`,
        {
          method: 'PATCH',
          body: {
            revision: current.revision,
            references: [refs(secondAsset.id, 'Variant poster')],
          },
        },
      ),
      200,
    );
    assert.equal(
      (
        await request(`${media}/assets/${asset.id}`, {
          method: 'PATCH',
          body: {
            revision: asset.revision,
            altText: 'Overwrite approved bytes',
            caption: null,
            intendedPurpose: 'GALLERY',
            sourceUrl: null,
            attribution: '',
          },
        })
      ).status,
      409,
    );
    // Advance only synthetic catalog facts so real relationship guards can be tested.
    const catalogPath = `scopes/tenants/${ids.tenantId}/catalog/products/${product.id}/revisions/${draft.id}`;
    let row = ok(await request(catalogPath), 200);
    for (const action of ['review', 'approve', 'publish'])
      row = ok(
        await request(`${catalogPath}/actions/${action}`, {
          method: 'POST',
          body: { revision: row.revision, rootRevision: row.rootRevision },
        }),
      );
    assert.equal(
      (
        await request(`${media}/assets/${asset.id}/archive`, {
          method: 'POST',
          body: { revision: asset.revision },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(assign, {
          method: 'PATCH',
          body: { revision: row.revision, references: [] },
        })
      ).status,
      409,
    );
  });
  await test('Foreign media, unapproved rights and unauthorized operations fail closed', async () => {
    assert.equal(
      (await request(`${media}/assets`, { session: bToken })).status,
      403,
    );
    assert.equal(
      (await request(`${ops}/skus/${sku.id}/prices`, { session: bToken }))
        .status,
      403,
    );
    const editor = await db.adminUser.findUniqueOrThrow({
        where: { email: 'category-reader@example.invalid' },
      }),
      session = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: editor.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal(
      (
        await request(`${media}/uploads`, {
          method: 'POST',
          body: upload(),
          session,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(pricePath(), {
          method: 'POST',
          body: offer('1'),
          session,
        })
      ).status,
      403,
    );
    assert.equal((await request(`${stock}/history`, { session })).status, 403);
    const uploaded = ok(
      await request(`${media}/uploads`, {
        method: 'POST',
        body: upload('Unapproved reference'),
      }),
    );
    ok(
      await request(`${media}/assets/${uploaded.id}/archive`, {
        method: 'POST',
        body: { revision: uploaded.revision },
      }),
    );
    assert.equal(
      (
        await request(`${media}/assets/${uploaded.id}/approve`, {
          method: 'POST',
          body: {
            revision: uploaded.revision + 1,
            license: 'Cannot approve archived',
            attribution: '',
            scope: 'PUBLIC',
          },
        })
      ).status,
      409,
    );
    const { LocalMediaStorage } = await import('../dist/operations/storage.js');
    const storage = new LocalMediaStorage();
    const previous = process.env.MEDIA_STORAGE_PROVIDER;
    process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary';
    assert.equal(storage.active(), false);
    await assert.rejects(() => storage.read(ids.tenantId, asset.id, 320));
    process.env.MEDIA_STORAGE_PROVIDER = previous;
  });
  await test('ISO minor units accept fractional PKR and JPY store precision without display rounding', async () => {
    const decimal = ok(
      await request(pricePath(), { method: 'POST', body: offer('12.34') }),
    );
    assert.equal(decimal.regularAmount, '12.34');
    await priceAction(decimal, 'archive');
    const settings = ok(await request(ops + '/settings'), 200);
    assert.equal(
      (
        await request(ops + '/settings', {
          method: 'PATCH',
          body: {
            currency: 'USD',
            timeZone: 'UTC',
            expectedCurrency: settings.currency,
            expectedTimeZone: settings.timeZone,
          },
        })
      ).status,
      409,
    );
    const store = await db.store.create({
      data: {
        tenantId: ids.tenantId,
        slug: 'jpy_store',
        name: 'JPY development store',
        currency: 'JPY',
        timeZone: 'Asia/Tokyo',
      },
    });
    await db.storeMembership.create({
      data: { tenantId: ids.tenantId, storeId: store.id, userId: owner.id },
    });
    const role = await db.scopedRole.create({
      data: {
        tenantId: ids.tenantId,
        storeId: store.id,
        scopeKind: 'STORE',
        code: 'JPY_OPERATOR',
        name: 'JPY operator',
      },
    });
    for (const code of [
      'pricing.view',
      'pricing.propose',
      'pricing.approve',
      'pricing.publish',
    ]) {
      const p = await db.permission.findUniqueOrThrow({ where: { code } });
      await db.scopedRolePermission.create({
        data: {
          roleId: role.id,
          permissionId: p.id,
          scopeKind: 'STORE',
          canDelegate: false,
        },
      });
    }
    await db.storeRoleAssignment.create({
      data: {
        tenantId: ids.tenantId,
        storeId: store.id,
        userId: owner.id,
        roleId: role.id,
      },
    });
    assert.equal(
      (
        await request(pricePath(sku.id, store.id), {
          method: 'POST',
          body: offer('1.1', { currency: 'JPY' }),
        })
      ).status,
      400,
    );
    await publish(
      ok(
        await request(pricePath(sku.id, store.id), {
          method: 'POST',
          body: offer('125', { currency: 'JPY' }),
        }),
      ),
      store.id,
    );
    assert.equal(
      ok(await request(pricePath(sku.id, store.id)), 200).effectiveOffer
        .sellingAmount,
      '125',
    );
  });
  await test('Custom store roles cannot approve prices, adjust inventory, escalate or cross stores', async () => {
    const user = await db.adminUser.create({
      data: {
        email: 'operations-reader@example.invalid',
        name: 'Operations reader',
        passwordHash: owner.passwordHash,
      },
    });
    await db.tenantMembership.create({
      data: { tenantId: ids.tenantId, userId: user.id },
    });
    await db.storeMembership.create({ data: { ...ids, userId: user.id } });
    for (const [roleCode, codes] of [
      ['PRICE_PROPOSER', ['pricing.view', 'pricing.propose']],
      ['STOCK_READER', ['inventory.view']],
    ]) {
      const role = await db.scopedRole.create({
        data: { ...ids, scopeKind: 'STORE', code: roleCode, name: roleCode },
      });
      for (const code of codes) {
        const p = await db.permission.findUniqueOrThrow({ where: { code } });
        await db.scopedRolePermission.create({
          data: {
            roleId: role.id,
            permissionId: p.id,
            scopeKind: 'STORE',
            canDelegate: false,
          },
        });
      }
      await db.storeRoleAssignment.create({
        data: { ...ids, userId: user.id, roleId: role.id },
      });
    }
    const session = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal((await request(pricePath(), { session })).status, 200);
    assert.equal(
      (await request(`${ops}/skus/${sku.id}/quote`, { session })).status,
      200,
    );
    assert.equal(
      (
        await request(`${pricePath()}/${published.id}/actions/approve`, {
          session,
          method: 'POST',
          body: { revision: published.revision },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(pricePath(sku.id, other.id), {
          session,
          method: 'POST',
          body: offer('1'),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(stock + '/adjustments', {
          session,
          method: 'POST',
          body: {
            locationId: defaultLocation.id,
            expectedRevision: 5,
            idempotencyKey: randomUUID(),
            mode: 'COUNT',
            quantity: 0,
            reason: 'Forbidden adjustment',
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          `scopes/tenants/${ids.tenantId}/stores/${ids.storeId}/roles`,
          {
            session,
            method: 'POST',
            body: {
              code: 'ESCALATE',
              name: 'Escalate',
              grants: [{ code: 'pricing.approve', canDelegate: true }],
            },
          },
        )
      ).status,
      403,
    );
  });
  await test('Development-only rights allow shared catalog review but cannot enter a public store presentation', async () => {
    let dev = ok(
      await request(media + '/uploads', {
        method: 'POST',
        body: upload('Development rights fixture'),
      }),
    );
    dev = ok(
      await request(`${media}/assets/${dev.id}/approve`, {
        method: 'POST',
        body: {
          revision: dev.revision,
          license: 'Synthetic test fixture authorized for development only',
          attribution: 'Local fixture',
          scope: 'DEVELOPMENT',
        },
      }),
    );
    const prefix = `scopes/tenants/${ids.tenantId}/catalog/products/${product.id}/revisions`,
      source = await db.productRevision.findFirstOrThrow({
        where: { productId: product.id, status: 'PUBLISHED' },
      });
    let row = ok(
      await request(`${prefix}/${source.id}/clone`, {
        method: 'POST',
        body: { revision: source.revision },
      }),
    );
    ok(
      await request(
        `${media}/products/${product.id}/revisions/${row.id}/assignments`,
        {
          method: 'PATCH',
          body: {
            revision: row.revision,
            references: [
              {
                assetId: dev.id,
                purpose: 'DETAIL_POSTER',
                altText: 'Development only poster',
              },
            ],
          },
        },
      ),
      200,
    );
    row = ok(await request(`${prefix}/${row.id}`), 200);
    for (const a of ['review', 'approve'])
      row = ok(
        await request(`${prefix}/${row.id}/actions/${a}`, {
          method: 'POST',
          body: { revision: row.revision, rootRevision: row.rootRevision },
        }),
      );
    const root = await db.storeListing.findUniqueOrThrow({
        where: {
          storeId_productId: { storeId: ids.storeId, productId: product.id },
        },
      }),
      draft = await db.listingRevision.findFirst({
        where: { listingId: root.id, status: 'DRAFT' },
      }),
      listingPrefix = `stores/${ids.storeId}/listings/${root.id}/revisions`;
    let listing = draft
      ? ok(await request(`${listingPrefix}/${draft.id}`), 200)
      : ok(
          await request(`${listingPrefix}/${root.publishedRevisionId}/clone`, {
            method: 'POST',
            body: {
              revision: (
                await db.listingRevision.findUniqueOrThrow({
                  where: { id: root.publishedRevisionId },
                })
              ).revision,
            },
          }),
        );
    const cleared = ok(
      await request(
        `${ops}/listings/${root.id}/revisions/${listing.id}/media`,
        {
          method: 'PATCH',
          body: { revision: listing.revision, references: [] },
        },
      ),
      200,
    );
    listing = ok(
      await request(`${listingPrefix}/${listing.id}`, {
        method: 'PATCH',
        body: {
          revision: cleared.revision,
          title: listing.title,
          slug: listing.slug,
          productRevisionId: row.id,
          categoryIds: listing.categories.map((c) => c.categoryId),
          skuRevisionIds: row.skus.map((s) => s.id),
        },
      }),
      200,
    );
    const sourceMedia = await db.productRevisionMedia.findFirstOrThrow({
      where: { productRevisionId: row.id, assetId: dev.id },
    });
    const assigned = ok(
      await request(
        `${ops}/listings/${listing.listingId}/revisions/${listing.id}/media`,
        {
          method: 'PATCH',
          body: {
            revision: listing.revision,
            references: [
              {
                productMediaId: sourceMedia.id,
                purpose: 'DETAIL_POSTER',
                altText: 'Development only poster',
              },
            ],
          },
        },
      ),
      200,
    );
    assert.equal(
      (
        await request(
          `stores/${ids.storeId}/listings/${listing.listingId}/revisions/${listing.id}/actions/review`,
          {
            method: 'POST',
            body: {
              revision: assigned.revision,
              rootRevision: listing.rootRevision,
            },
          },
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await db.listingRevision.findUniqueOrThrow({
          where: { id: listing.id },
        })
      ).status,
      'DRAFT',
    );
  });
  await test('Foreign media identities, count and byte quotas, traversal and failed-upload cleanup are enforced', async () => {
    const foreign = await db.mediaAsset.create({
      data: {
        tenantId: tenantB.id,
        code: 'foreign_asset',
        mimeType: 'image/png',
        createdBy: member.id,
      },
    });
    const role = await db.scopedRole.create({
      data: {
        tenantId: tenantB.id,
        scopeKind: 'TENANT',
        code: 'MEDIA_FOR_LIMIT_TEST',
        name: 'Media test',
      },
    });
    for (const code of ['media.view', 'media.upload']) {
      const p = await db.permission.findUniqueOrThrow({ where: { code } });
      await db.scopedRolePermission.create({
        data: {
          roleId: role.id,
          permissionId: p.id,
          scopeKind: 'TENANT',
          canDelegate: false,
        },
      });
    }
    await db.tenantRoleAssignment.create({
      data: { tenantId: tenantB.id, userId: member.id, roleId: role.id },
    });
    assert.equal(
      (
        await request(
          `scopes/tenants/${tenantB.id}/media/assets/${asset.id}/content?width=320`,
          { session: bToken },
        )
      ).status,
      404,
    );
    const fresh = await db.productRevision.findFirstOrThrow({
      where: { tenantId: ids.tenantId, status: 'DRAFT' },
    });
    assert.equal(
      (
        await request(
          `${media}/products/${fresh.productId}/revisions/${fresh.id}/assignments`,
          {
            method: 'PATCH',
            body: {
              revision: fresh.revision,
              references: [
                {
                  assetId: foreign.id,
                  purpose: 'GALLERY',
                  altText: 'Forbidden',
                },
              ],
            },
          },
        )
      ).status,
      404,
    );
    await db.mediaAsset.createMany({
      data: Array.from({ length: 499 }, (_, i) => ({
        tenantId: tenantB.id,
        code: `count_limit_${i}`,
        mimeType: 'image/png',
        createdBy: member.id,
      })),
    });
    assert.equal(
      (
        await request(`scopes/tenants/${tenantB.id}/media/uploads`, {
          session: bToken,
          method: 'POST',
          body: upload(),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(media + '/uploads', {
          method: 'POST',
          body: { ...upload(), fileName: '../outside.png' },
        })
      ).status,
      400,
    );
    const quota = await db.mediaAsset.create({
        data: {
          tenantId: ids.tenantId,
          code: 'quota_fixture',
          mimeType: 'image/png',
          storedBytes: 536870912,
          createdBy: owner.id,
        },
      }),
      beforeCount = await db.mediaAsset.count({
        where: { tenantId: ids.tenantId },
      }),
      beforeDirectories = (
        await fs.readdir(`${process.env.MEDIA_LOCAL_ROOT}/${ids.tenantId}`)
      ).length;
    assert.equal(
      (
        await request(media + '/uploads', {
          method: 'POST',
          body: upload('Quota-rejected upload'),
        })
      ).status,
      400,
    );
    assert.equal(
      await db.mediaAsset.count({ where: { tenantId: ids.tenantId } }),
      beforeCount,
    );
    assert.equal(
      (await fs.readdir(`${process.env.MEDIA_LOCAL_ROOT}/${ids.tenantId}`))
        .length,
      beforeDirectories,
    );
    await db.mediaAsset.update({
      where: { id: quota.id },
      data: { storedBytes: 0 },
    });
  });
  return {
    browser: async ({ page, base, cookie }) => {
      await page.goto(base + '/products');
      await page
        .getByLabel('Search catalog products', { exact: true })
        .fill('Browser retail');
      await page
        .getByRole('button', { name: 'Browser retail', exact: true })
        .click();
      await page
        .getByText('Product version 2 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      await page
        .getByLabel('Operational store', { exact: true })
        .selectOption(ids.storeId);
      await page
        .getByLabel('Regular selling amount', { exact: true })
        .fill('2000.00');
      await page
        .getByRole('button', { name: 'Save price proposal', exact: true })
        .click();
      await page
        .getByText('Price version 1 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      for (const [a, state, n] of [
        ['Review', 'IN_REVIEW', 2],
        ['Approve', 'APPROVED', 3],
        ['Publish', 'PUBLISHED', 4],
      ]) {
        await page
          .getByRole('button', { name: `${a} price`, exact: true })
          .click();
        await page
          .getByText(`Price version 1 · ${state} · Revision ${n}`, {
            exact: true,
          })
          .waitFor();
      }
      await page
        .getByLabel('Inventory policy', { exact: true })
        .selectOption('QUANTITY');
      await page
        .getByLabel('Low-stock threshold (optional)', { exact: true })
        .fill('2');
      await page
        .getByRole('button', { name: 'Save inventory policy', exact: true })
        .click();
      await page
        .getByText('Stock: Unknown · QUANTITY', { exact: true })
        .waitFor();
      await page
        .getByLabel('Inventory location', { exact: true })
        .selectOption(defaultLocation.id);
      await page.getByLabel('Adjustment quantity', { exact: true }).fill('7');
      await page
        .getByLabel('Adjustment reason', { exact: true })
        .fill('Browser verified physical count');
      await page
        .getByRole('button', { name: 'Record stock adjustment', exact: true })
        .click();
      const extraLocation = await db.inventoryLocation.findFirstOrThrow({
        where: { storeId: ids.storeId, code: 'warehouse' },
      });
      await page
        .getByLabel('Inventory location', { exact: true })
        .selectOption(extraLocation.id);
      await page.getByLabel('Adjustment quantity', { exact: true }).fill('0');
      await page
        .getByLabel('Adjustment reason', { exact: true })
        .fill('Browser second location physical zero');
      await page
        .getByRole('button', { name: 'Record stock adjustment', exact: true })
        .click();
      await page.getByText('Stock: 7 · QUANTITY', { exact: true }).waitFor();
      await page
        .getByLabel('Upload product images', { exact: true })
        .setInputFiles([
          {
            name: 'Browser poster A.png',
            mimeType: 'image/png',
            buffer: bytes,
          },
          {
            name: 'Browser poster B.png',
            mimeType: 'image/png',
            buffer: bytes,
          },
        ]);
      await page
        .getByText(
          '2 images uploaded privately. Review alternative text and usage rights.',
          { exact: true },
        )
        .waitFor();
      for (const name of ['Browser poster A', 'Browser poster B']) {
        await page
          .getByRole('button', { name: `Inspect media ${name}`, exact: true })
          .click();
        await page
          .getByLabel('Media license or permission evidence', { exact: true })
          .fill(
            'Synthetic image generated locally for isolated browser testing',
          );
        await page
          .getByLabel('I confirm authorization for public use', { exact: true })
          .check();
        await page
          .getByRole('button', { name: 'Approve media rights', exact: true })
          .click();
        await page
          .locator('.media-library-grid > li')
          .filter({ hasText: name })
          .getByText('Public use approved', { exact: false })
          .waitFor();
      }
      await page
        .getByRole('button', { name: 'Assign Browser poster A', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Assign Browser poster B', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Move assignment 2 up', exact: true })
        .click();
      await page
        .getByLabel('Assignment 1 caption', { exact: true })
        .fill('Browser poster B caption');
      await page
        .getByRole('button', {
          name: 'Save ordered media assignments',
          exact: true,
        })
        .click();
      await page
        .getByText('Product version 2 · DRAFT · Revision 2', { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByLabel('Assignment 1 alternative text', { exact: true })
          .inputValue(),
        'Browser poster B',
      );
      const browserProduct = await db.product.findUniqueOrThrow({
          where: {
            tenantId_code: { tenantId: ids.tenantId, code: 'browser_retail' },
          },
        }),
        draft = await db.productRevision.findFirstOrThrow({
          where: { productId: browserProduct.id, status: 'DRAFT' },
          include: { skus: true },
        });
      await page
        .getByLabel('Media assignment target', { exact: true })
        .selectOption(draft.skus[0].id);
      await page
        .getByRole('button', { name: 'Assign Browser poster A', exact: true })
        .click();
      await page
        .getByRole('button', {
          name: 'Save ordered media assignments',
          exact: true,
        })
        .click();
      await page
        .getByText('Product version 2 · DRAFT · Revision 3', { exact: true })
        .waitFor();
      assert.equal(
        await db.sKURevisionMedia.count({
          where: { productRevisionId: draft.id },
        }),
        1,
      );
      await page
        .getByLabel('Selling policy', { exact: true })
        .selectOption('RETAIL');
      await page
        .getByRole('button', { name: 'Save product draft', exact: true })
        .click();
      await page
        .getByText('Product version 2 · DRAFT · Revision 4', { exact: true })
        .waitFor();
      for (const [a, state, n] of [
        ['Review', 'IN_REVIEW', 5],
        ['Approve', 'APPROVED', 6],
      ]) {
        await page
          .getByRole('button', { name: `${a} product`, exact: true })
          .click();
        await page
          .getByText(`Product version 2 · ${state} · Revision ${n}`, {
            exact: true,
          })
          .waitFor();
      }
      await page
        .getByRole('button', {
          name: 'Validate and compare product',
          exact: true,
        })
        .click();
      await page
        .getByRole('heading', {
          name: 'Product validation and differences',
          exact: true,
        })
        .waitFor();
      await page
        .getByRole('button', { name: 'Publish product', exact: true })
        .click();
      await page
        .getByText('Product version 2 · PUBLISHED · Revision 7', {
          exact: true,
        })
        .waitFor();
      await page.goto(base + '/listings');
      await page
        .getByLabel('Search store listings', { exact: true })
        .fill('Browser retail');
      await page
        .getByRole('button', { name: 'Browser retail', exact: true })
        .click();
      await page
        .getByText('Listing version 2 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      await page
        .getByLabel('Approved product revision', { exact: true })
        .selectOption(draft.id);
      await page
        .getByRole('button', { name: 'Save listing draft', exact: true })
        .click();
      await page
        .getByText('Listing version 2 · DRAFT · Revision 2', { exact: true })
        .waitFor();
      const source = await db.productRevisionMedia.findFirstOrThrow({
        where: {
          productRevisionId: draft.id,
          purpose: 'DETAIL_POSTER',
          sortOrder: 0,
        },
      });
      await page
        .getByLabel('Listing media source', { exact: true })
        .selectOption('product:' + source.id);
      await page
        .getByRole('button', {
          name: 'Add listing presentation media',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Save listing media order', exact: true })
        .click();
      await page
        .getByText('Listing version 2 · DRAFT · Revision 3', { exact: true })
        .waitFor();
      for (const [a, state, n] of [
        ['Review', 'IN_REVIEW', 4],
        ['Approve', 'APPROVED', 5],
      ]) {
        await page
          .getByRole('button', { name: `${a} listing`, exact: true })
          .click();
        await page
          .getByText(`Listing version 2 · ${state} · Revision ${n}`, {
            exact: true,
          })
          .waitFor();
      }
      await page
        .getByRole('button', {
          name: 'Validate and compare listing',
          exact: true,
        })
        .click();
      await page
        .getByRole('heading', {
          name: 'Listing validation and differences',
          exact: true,
        })
        .waitFor();
      await page
        .getByRole('button', { name: 'Publish listing', exact: true })
        .click();
      await page
        .getByText('Listing version 2 · PUBLISHED · Revision 6', {
          exact: true,
        })
        .waitFor();
      const quote = ok(
        await request(`${ops}/skus/${draft.skus[0].skuId}/quote`),
        200,
      );
      assert.equal(quote.offer.sellingAmount, '2000');
      assert.equal(quote.inventory.quantity, 7);
      assert.equal(quote.purchasable, false);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
      }
      assert.equal(
        (
          await fetch(`${base}/api/admin/${media}/uploads`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify(upload()),
          })
        ).status,
        403,
      );
      for (const path of [
        `${ops}/sql`,
        `${media}/fetch-url`,
        `${ops}/skus/${sku.id}/inventory/delete`,
      ])
        assert.equal(
          (
            await fetch(`${base}/api/admin/${path}`, {
              headers: { Cookie: cookie },
            })
          ).status,
          404,
        );
      await page.goto(base + '/media');
      await page
        .getByLabel('Media tenant', { exact: true })
        .selectOption(ids.tenantId);
      // setInputFiles bypasses disabled-control actionability; wait for the real
      // user-visible storage capability before selecting a file in this fresh page.
      await page.waitForFunction(()=>{
        const input=document.querySelector('input[type=file]');
        return input&&!input.matches(':disabled');
      });
      await page
        .getByLabel('Upload product images', { exact: true })
        .setInputFiles({
          name: 'Browser rejection fixture.png',
          mimeType: 'image/png',
          buffer: bytes,
        });
      await page
        .getByText(
          '1 images uploaded privately. Review alternative text and usage rights.',
          { exact: true },
        )
        .waitFor();
      await page
        .getByRole('button', {
          name: 'Inspect media Browser rejection fixture',
          exact: true,
        })
        .click();
      await page
        .getByLabel('Rights evidence notes or rejection reason', {
          exact: true,
        })
        .fill(
          'Insufficient commercial authorization for this synthetic review drill',
        );
      await page
        .getByLabel('License conditions and restrictions', { exact: true })
        .fill('Remain private until a new evidence decision');
      await page
        .getByRole('button', { name: 'Reject commercial usage', exact: true })
        .click();
      await page.getByText('REJECT', { exact: true }).waitFor();
      const rejectedAsset = await db.mediaAsset.findFirstOrThrow({
        where: { tenantId: ids.tenantId, altText: 'Browser rejection fixture' },
      });
      assert.equal(rejectedAsset.rights, 'RESTRICTED');
      assert.ok(
        await db.mediaReview.findFirst({
          where: {
            assetId: rejectedAsset.id,
            reviewerId: owner.id,
            decision: 'REJECT',
          },
        }),
      );
      console.log(
        'PASS actual admin rejection form, reviewer history, conditions and publication-blocked status',
      );
      console.log(
        'PASS Real admin price/approval and quantity workflows, two private uploads, rights decisions, poster reorder, variant media, listing presentation and checkout-disabled quote',
      );
    },
  };
}
