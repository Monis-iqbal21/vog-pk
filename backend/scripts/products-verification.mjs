import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { Client } from 'pg';
export async function verifyProducts({
  db,
  ids,
  owner,
  token,
  bToken,
  tenantB,
  member,
  base,
  test,
  call,
  create,
  attribute,
  makeType,
  action,
  hashToken,
}) {
  await test('Milestone 4 additive SQL preserves existing users, categories and schema records on upgrade', async () => {
    const dest = new URL(process.env.DATABASE_URL),
      database = `product_upgrade_${randomBytes(6).toString('hex')}_test`,
      control = new Client({ connectionString: dest.href });
    await control.connect();
    try {
      await control.query(`CREATE DATABASE "${database}"`);
    } finally {
      await control.end();
    }
    dest.pathname = '/' + database;
    const pg = new Client({ connectionString: dest.href });
    await pg.connect();
    try {
      for (const dir of (
        await fs.readdir('prisma/migrations', { withFileTypes: true })
      )
        .filter(
          (d) => d.isDirectory() && d.name < '202611010004_catalog_products',
        )
        .map((d) => d.name)
        .sort())
        await pg.query(
          await fs.readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'),
        );
      const tid = randomUUID(),
        sid = randomUUID(),
        cid = randomUUID(),
        pt = randomUUID();
      await pg.query(
        'INSERT INTO "AdminUser" (id,name,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,now())',
        [
          owner.id,
          'Preserved user',
          'preserved-product-test@example.invalid',
          owner.passwordHash,
        ],
      );
      await pg.query('INSERT INTO "Tenant" (id,slug,name) VALUES ($1,$2,$3)', [
        tid,
        'preserved',
        'Preserved',
      ]);
      await pg.query(
        'INSERT INTO "Store" (id,"tenantId",slug,name) VALUES ($1,$2,$3,$4)',
        [sid, tid, 'preserved', 'Preserved'],
      );
      await pg.query(
        'INSERT INTO "Category" (id,"tenantId","storeId",code,name,slug,media,seo,"createdBy","updatedBy","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,now())',
        [
          cid,
          tid,
          sid,
          'preserved',
          'Preserved',
          'preserved',
          '{}',
          '{}',
          owner.id,
        ],
      );
      await pg.query(
        'INSERT INTO "ProductType" (id,"tenantId",code,label) VALUES ($1,$2,$3,$4)',
        [pt, tid, 'preserved', 'Preserved'],
      );
      const beforeUser = (await pg.query('SELECT * FROM "AdminUser"')).rows,
        beforeCategory = (await pg.query('SELECT * FROM "Category"')).rows,
        beforeType = (await pg.query('SELECT * FROM "ProductType"')).rows;
      await pg.query('BEGIN');
      await pg.query(
        await fs.readFile(
          'prisma/migrations/202611010004_catalog_products/migration.sql',
          'utf8',
        ),
      );
      await pg.query('COMMIT');
      assert.equal(JSON.stringify((await pg.query('SELECT * FROM "AdminUser"')).rows)===JSON.stringify(beforeUser),true,'Existing identity records remain unchanged.');
      assert.deepEqual(
        (await pg.query('SELECT * FROM "Category"')).rows,
        beforeCategory,
      );
      assert.deepEqual(
        (await pg.query('SELECT * FROM "ProductType"')).rows,
        beforeType,
      );
    } finally {
      await pg.end();
    }
  });
  const api = async (
    route,
    {
      method = 'GET',
      body,
      tenantId = ids.tenantId,
      session = token,
      storeId,
    } = {},
  ) => {
    const r = await fetch(
      `${base}/api/admin/${storeId ? `stores/${storeId}/` : `scopes/tenants/${tenantId}/catalog/`}${route}`,
      {
        method,
        headers: {
          'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
          Authorization: `Bearer ${session}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    return { status: r.status, data: await r.json() };
  };
  const ok = (r, status = 201) => {
    assert.equal(
      r.status,
      status,
      `${r.status}: ${r.data.message ?? 'unexpected catalog response'}`,
    );
    return r.data;
  };
  const path = (r) => `products/${r.productId}/revisions/${r.id}`;
  const transition = async (r, a) =>
    ok(
      await api(`${path(r)}/actions/${a}`, {
        method: 'POST',
        body: {
          revision: r.revision,
          rootRevision:
            r.rootRevision ??
            (await db.product.findUniqueOrThrow({ where: { id: r.productId } }))
              .revision,
        },
      }),
    );
  const approve = async (r) =>
    transition(await transition(r, 'review'), 'approve');
  const publish = async (r) => transition(await approve(r), 'publish');
  const set = await create('option-sets', {
    code: 'product_color',
    label: 'Product color',
    values: ['black', 'white', 'orange'].map((code) => ({ code, label: code })),
  });
  const switches = await create('option-sets', {
    code: 'product_switch',
    label: 'Product switch',
    values: ['stormrise', 'lingyun'].map((code) => ({ code, label: code })),
  });
  const color = await create(
    'attributes',
    attribute('product_color', 'SINGLE_SELECT', {
      optionSetId: set.id,
      allowedScopes: ['SKU'],
      axisEligible: true,
    }),
  );
  const sw = await create(
    'attributes',
    attribute('product_switch', 'SINGLE_SELECT', {
      optionSetId: switches.id,
      allowedScopes: ['SKU'],
      axisEligible: true,
    }),
  );
  const sensor = await create(
    'attributes',
    attribute('product_sensor', 'TEXT', { allowedScopes: ['SKU'] }),
  );
  const power = await create(
    'attributes',
    attribute('product_power', 'NUMBER', {
      canonicalUnit: 'W',
      rules: { min: '0', max: '1000' },
    }),
  );
  const wireless = await create(
    'attributes',
    attribute('product_wireless', 'BOOLEAN'),
  );
  const option = (s, code) => s.values.find((v) => v.code === code).id;
  const finishType = async (t) => {
    t.version = await action(
      await action(t.version, t.type, 'review'),
      t.type,
      'approve',
    );
    return t;
  };
  const retail = await finishType(
    await makeType('catalog_retail', 'Catalog retail', [power, wireless]),
  );
  const keyboard = await finishType(
    await makeType('catalog_keyboard', 'Catalog keyboard', [color, sw]),
  );
  const mouse = await finishType(
    await makeType('catalog_mouse', 'Catalog mouse', [color, sensor]),
  );
  const apparel = await finishType(
    await makeType('catalog_apparel', 'Catalog apparel', [color]),
  );
  let vehicle = await makeType('catalog_vehicle', 'Catalog vehicle', [power]);
  vehicle.version = ok(
    await call(
      `product-types/${vehicle.type.id}/versions/${vehicle.version.id}`,
      {
        method: 'PATCH',
        body: {
          ...vehicle.draft,
          revision: vehicle.version.revision,
          allowNoSku: true,
        },
      },
    ),
    200,
  );
  vehicle = await finishType(vehicle);
  const body = (code, type, extra = {}) => ({
    code,
    name: code,
    slug: code.replaceAll('_', '-'),
    schemaVersionId: type.version.id,
    sellingMode: 'REFERENCE',
    values: [],
    axisIds: [],
    skus: [],
    ...extra,
  });
  const sku = (code, values = []) => ({
    code,
    manufacturerPartNumber: `MPN-${code}`,
    state: 'ACTIVE',
    values,
  });
  const defaults = body('default_product', retail, {
    values: [
      { attributeId: power.id, number: '0' },
      { attributeId: wireless.id, boolean: false },
    ],
    skus: [sku('DEFAULT-ONE')],
  });
  let normal, key, ms, shirt, inquiry;
  await test('Default retail SKU, typed false/zero/missing and required schema validation', async () => {
    normal = ok(await api('products', { method: 'POST', body: defaults }));
    normal = await publish(normal);
    assert.equal(normal.skus.length, 1);
    assert.ok(normal.values.some((v) => v.booleanValue === false));
    assert.ok(normal.values.some((v) => v.numberValue === '0'));
    let invalid = ok(
      await api('products', {
        method: 'POST',
        body: body('missing_product', retail),
      }),
    );
    assert.equal(
      (
        await api(`${path(invalid)}/actions/review`, {
          method: 'POST',
          body: { revision: invalid.revision },
        })
      ).status,
      400,
    );
    for (const values of [
      [{ attributeId: power.id, boolean: false }],
      [{ attributeId: power.id, number: '-1' }],
      [{ attributeId: color.id, options: [option(set, 'black')] }],
      [{ attributeId: wireless.id, boolean: false, text: 'x' }],
    ])
      assert.equal(
        (
          await api('products', {
            method: 'POST',
            body: {
              ...defaults,
              code: 'invalid_product',
              slug: 'invalid-product',
              values,
            },
          })
        ).status,
        400,
      );
  });
  const keyboardBody = body('explicit_keyboard', keyboard, {
    axisIds: [color.id, sw.id],
    skus: [
      sku('KB-BLACK', [
        { attributeId: color.id, options: [option(set, 'black')] },
        { attributeId: sw.id, options: [option(switches, 'stormrise')] },
      ]),
      sku('KB-WHITE', [
        { attributeId: color.id, options: [option(set, 'white')] },
        { attributeId: sw.id, options: [option(switches, 'lingyun')] },
      ]),
      sku('KB-ORANGE', [
        { attributeId: color.id, options: [option(set, 'orange')] },
        { attributeId: sw.id, options: [option(switches, 'stormrise')] },
      ]),
    ],
  });
  await test('Only explicit keyboard combinations exist; duplicate combinations and tenant SKU codes reject', async () => {
    key = ok(await api('products', { method: 'POST', body: keyboardBody }));
    key = await publish(key);
    assert.equal(key.skus.length, 3);
    assert.equal(
      (
        await api('products', {
          method: 'POST',
          body: {
            ...keyboardBody,
            code: 'dup_keyboard',
            slug: 'dup-keyboard',
            skus: [
              keyboardBody.skus[0],
              { ...keyboardBody.skus[0], code: 'DIFFERENT' },
            ],
          },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api('products', {
          method: 'POST',
          body: { ...defaults, code: 'duplicate_sku', slug: 'duplicate-sku' },
        })
      ).status,
      409,
    );
    const resolve = async (selection, extra = {}) =>
      ok(
        await api(`${path(key)}/resolve`, {
          method: 'POST',
          body: { selection, ...extra },
        }),
      );
    const exact = await resolve([
      { attributeId: color.id, optionId: option(set, 'black') },
      { attributeId: sw.id, optionId: option(switches, 'stormrise') },
    ]);
    assert.equal(exact.status, 'RESOLVED');
    assert.equal(exact.matchingSku.code, 'KB-BLACK');
    assert.equal(exact.pricing, null);
    assert.equal(exact.inventory, null);
    const missing = await resolve([
      { attributeId: color.id, optionId: option(set, 'black') },
      { attributeId: sw.id, optionId: option(switches, 'lingyun') },
    ]);
    assert.equal(missing.status, 'NONEXISTENT');
    const changed = await resolve(
      [
        { attributeId: color.id, optionId: option(set, 'white') },
        { attributeId: sw.id, optionId: option(switches, 'stormrise') },
      ],
      { changedAttributeId: color.id },
    );
    assert.deepEqual(changed.clearedAttributeIds, [sw.id]);
    assert.equal(changed.selection[color.id], option(set, 'white'));
  });
  await test('Derived mouse sensors and apparel variants resolve without inventing selectable axes', async () => {
    ms = ok(
      await api('products', {
        method: 'POST',
        body: body('sensor_mouse', mouse, {
          axisIds: [color.id],
          skus: [
            sku('MOUSE-BLACK', [
              { attributeId: color.id, options: [option(set, 'black')] },
              { attributeId: sensor.id, text: 'Sensor A' },
            ]),
            sku('MOUSE-WHITE', [
              { attributeId: color.id, options: [option(set, 'white')] },
              { attributeId: sensor.id, text: 'Sensor B' },
            ]),
          ],
        }),
      }),
    );
    ms = await publish(ms);
    const resolved = ok(
      await api(`${path(ms)}/resolve`, {
        method: 'POST',
        body: {
          selection: [
            { attributeId: color.id, optionId: option(set, 'white') },
          ],
        },
      }),
    );
    assert.equal(
      resolved.matchingSku.specifications.find(
        (v) => v.attributeId === sensor.id,
      ).text,
      'Sensor B',
    );
    assert.equal(resolved.nextOptions.length, 1);
    shirt = ok(
      await api('products', {
        method: 'POST',
        body: body('apparel_fixture', apparel, {
          axisIds: [color.id],
          skus: [
            sku('SHIRT-BLACK', [
              { attributeId: color.id, options: [option(set, 'black')] },
            ]),
          ],
        }),
      }),
    );
    shirt = await approve(shirt);
  });
  await test('Inquiry-only SKU-free policy is schema-approved and cannot bypass retail SKU validation', async () => {
    inquiry = ok(
      await api('products', {
        method: 'POST',
        body: body('inquiry_vehicle', vehicle, {
          sellingMode: 'RFQ',
          values: [{ attributeId: power.id, number: '0' }],
        }),
      }),
    );
    inquiry = await publish(inquiry);
    assert.equal(inquiry.skus.length, 0);
    const noSku = ok(
      await api('products', {
        method: 'POST',
        body: body('no_sku_retail', vehicle, {
          sellingMode: 'RETAIL',
          values: [{ attributeId: power.id, number: '0' }],
        }),
      }),
    );
    assert.equal(
      (
        await api(`${path(noSku)}/actions/review`, {
          method: 'POST',
          body: { revision: noSku.revision },
        })
      ).status,
      400,
    );
  });
  let draft;
  const draftInput = (r) => ({
    revision: r.revision,
    schemaVersionId: r.schemaVersionId,
    name: r.name,
    slug: r.slug,
    description: r.description,
    content: r.content,
    brandId: r.brandId,
    sellingMode: r.sellingMode,
    axisIds: r.bindings.filter((b) => b.axis).map((b) => b.attributeId),
    values: r.values.map((v) => ({
      attributeId: v.binding.attributeId,
      ...(v.textValue !== null
        ? { text: v.textValue }
        : v.numberValue !== null
          ? { number: v.numberValue }
          : v.booleanValue !== null
            ? { boolean: v.booleanValue }
            : { options: v.choices.map((c) => c.optionId) }),
    })),
    skus: r.skus.map((s) => ({
      id: s.skuId,
      code: s.sku.code,
      manufacturerPartNumber: s.sku.manufacturerPartNumber,
      state: s.state,
      values: s.values.map((v) => ({
        attributeId: v.binding.attributeId,
        ...(v.textValue !== null
          ? { text: v.textValue }
          : v.numberValue !== null
            ? { number: v.numberValue }
            : v.booleanValue !== null
              ? { boolean: v.booleanValue }
              : { options: v.choices.map((c) => c.optionId) }),
      })),
    })),
  });
  await test('Published facts and physical SKU identities are immutable; stale edits and competing publication conflict', async () => {
    await assert.rejects(() =>
      db.productRevision.update({
        where: { id: normal.id },
        data: { name: 'Tamper' },
      }),
    );
    await assert.rejects(() =>
      db.productAttributeValue.update({
        where: { id: normal.values[0].id },
        data: { numberValue: '1' },
      }),
    );
    await assert.rejects(() =>
      db.sKU.update({
        where: { id: normal.skus[0].skuId },
        data: { code: 'REWRITE' },
      }),
    );
    draft = ok(
      await api(`${path(normal)}/clone`, {
        method: 'POST',
        body: { revision: normal.revision },
      }),
    );
    const update = draftInput(draft);
    update.name = 'Reviewed correction';
    const saved = ok(
      await api(path(draft), { method: 'PATCH', body: update }),
      200,
    );
    assert.equal(
      (await api(path(draft), { method: 'PATCH', body: update })).status,
      409,
    );
    draft = await approve(saved);
    const rival = await approve(
      ok(
        await api(`${path(normal)}/clone`, {
          method: 'POST',
          body: { revision: normal.revision },
        }),
      ),
    );
    const rootRevision = (
      await db.product.findUniqueOrThrow({ where: { id: normal.productId } })
    ).revision;
    const results = await Promise.all(
      [draft, rival].map((r) =>
        api(`${path(r)}/actions/publish`, {
          method: 'POST',
          body: { revision: r.revision, rootRevision },
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    normal = results.find((r) => r.status === 201).data;
    const cloned = ok(
      await api(`${path(key)}/clone`, {
        method: 'POST',
        body: { revision: key.revision },
      }),
    );
    const invalid = draftInput(cloned);
    invalid.skus[0].manufacturerPartNumber = 'NEW-PHYSICAL-PART';
    assert.equal(
      (await api(path(cloned), { method: 'PATCH', body: invalid })).status,
      400,
    );
  });
  const c = await db.category.findFirstOrThrow({
      where: { ...ids, status: 'ACTIVE', code: 'electronics' },
    }),
    child = await db.category.findFirstOrThrow({
      where: { ...ids, status: 'ACTIVE', code: 'accessories' },
    });
  let listing;
  const listingPath = (r) => `listings/${r.listingId}/revisions/${r.id}`;
  const listAction = async (r, a, storeId = ids.storeId) =>
    ok(
      await api(`${listingPath(r)}/actions/${a}`, {
        storeId,
        method: 'POST',
        body: { revision: r.revision, rootRevision: r.rootRevision },
      }),
    );
  await test('Store listings pin exact approved revisions, multiple categories and SKU facts', async () => {
    listing = ok(
      await api('listings', {
        storeId: ids.storeId,
        method: 'POST',
        body: {
          code: 'default_listing',
          title: normal.name,
          slug: 'default-store-listing',
          productRevisionId: normal.id,
          categoryIds: [c.id, child.id],
          skuRevisionIds: normal.skus.map((s) => s.id),
        },
      }),
    );
    listing = await listAction(
      await listAction(await listAction(listing, 'review'), 'approve'),
      'publish',
    );
    assert.equal(listing.categories.length, 2);
    assert.equal(listing.productRevisionId, normal.id);
    assert.equal(
      (await api(`${listingPath(listing)}/impact`, { storeId: ids.storeId }))
        .data.purchasable,
      false,
    );
    await assert.rejects(() =>
      db.listingCategory.deleteMany({
        where: { listingRevisionId: listing.id },
      }),
    );
    const wrong = await api('listings', {
      storeId: ids.storeId,
      method: 'POST',
      body: {
        code: 'wrong_pin',
        title: 'Wrong',
        slug: 'wrong-pin',
        productRevisionId: key.id,
        categoryIds: [c.id],
        skuRevisionIds: normal.skus.map((s) => s.id),
      },
    });
    assert.equal(wrong.status, 400);
    const inquiryListing = ok(
      await api('listings', {
        storeId: ids.storeId,
        method: 'POST',
        body: {
          code: 'inquiry_listing',
          title: 'Inquiry',
          slug: 'inquiry-listing',
          productRevisionId: inquiry.id,
          categoryIds: [c.id],
          skuRevisionIds: [],
        },
      }),
    );
    assert.equal(inquiryListing.skus.length, 0);
    const orderInput = {
      title: inquiryListing.title,
      slug: inquiryListing.slug,
      productRevisionId: inquiryListing.productRevisionId,
      categoryIds: [c.id],
      skuRevisionIds: [],
      revision: inquiryListing.revision,
      catalogOrder: 42,
    };
    let ordered = ok(
      await api(listingPath(inquiryListing), {
        storeId: ids.storeId,
        method: 'PATCH',
        body: orderInput,
      }),
      200,
    );
    assert.equal(ordered.catalogOrder, 42);
    delete orderInput.catalogOrder;
    ordered = ok(
      await api(listingPath(ordered), {
        storeId: ids.storeId,
        method: 'PATCH',
        body: { ...orderInput, revision: ordered.revision },
      }),
      200,
    );
    assert.equal(
      ordered.catalogOrder,
      42,
      'Older admin payloads must preserve imported general order',
    );
    ordered = ok(
      await api(listingPath(ordered), {
        storeId: ids.storeId,
        method: 'PATCH',
        body: { ...orderInput, revision: ordered.revision, catalogOrder: null },
      }),
      200,
    );
    assert.equal(
      ordered.catalogOrder,
      null,
      'Explicit clear remains supported',
    );
    const collision = await api('listings', {
      storeId: ids.storeId,
      method: 'POST',
      body: {
        code: 'collision',
        title: 'Collision',
        slug: c.slug,
        productRevisionId: key.id,
        categoryIds: [c.id],
        skuRevisionIds: key.skus.map((s) => s.id),
      },
    });
    assert.equal(collision.status, 409);
  });
  await test('Schema impact reports real products/SKUs/listings and blocks unsafe required field activation', async () => {
    const newAttr = await create('attributes', attribute('new_required_fact'));
    let clone = ok(
      await call(
        `product-types/${retail.type.id}/versions/${retail.version.id}/clone`,
        { method: 'POST', body: { revision: retail.version.revision } },
      ),
    );
    const body = {
      ...retail.draft,
      revision: clone.revision,
      fields: [
        ...retail.draft.fields,
        {
          attributeId: newAttr.id,
          groupCode: 'specifications',
          level: 'PRODUCT',
          required: true,
          variantAxis: false,
          sortOrder: 5,
          widget: 'text',
          rules: {},
          visibility: { admin: true, storefront: true },
        },
      ],
    };
    clone = ok(
      await call(`product-types/${retail.type.id}/versions/${clone.id}`, {
        method: 'PATCH',
        body,
      }),
      200,
    );
    clone = await action(
      await action(clone, retail.type, 'review'),
      retail.type,
      'approve',
    );
    const impact = ok(
      await call(`product-types/${retail.type.id}/versions/${clone.id}/impact`),
      200,
    );
    assert.ok(impact.usage.referencedProducts > 0);
    assert.ok(impact.usage.affected.skuRevisionCount > 0);
    assert.ok(impact.usage.affected.listingRevisionCount > 0);
    assert.ok(impact.usage.blockingReasons.length > 0);
    assert.equal(
      (
        await call(
          `product-types/${retail.type.id}/versions/${clone.id}/actions/activate`,
          {
            method: 'POST',
            body: {
              revision: clone.revision,
              typeRevision: impact.typeRevision,
            },
          },
        )
      ).status,
      409,
    );
    const impactCategory = (
      await api(`categories/${c.id}/impact`, { storeId: ids.storeId })
    ).data;
    assert.equal(impactCategory.usage.mode, 'LISTING_REFERENCES');
    assert.ok(impactCategory.usage.assignments > 0);
  });
  await test('Tenant/store isolation, scoped custom roles, forbidden references and schema privileges fail closed', async () => {
    assert.equal((await api('products', { session: bToken })).status, 403);
    assert.equal(
      (await api(path(normal), { tenantId: tenantB.id, session: bToken }))
        .status,
      403,
    );
    const other = await db.store.findFirstOrThrow({
      where: { tenantId: ids.tenantId, slug: 'other' },
    });
    assert.equal((await api('listings', { storeId: other.id })).status, 403);
    const user = await db.adminUser.findUniqueOrThrow({
      where: { email: 'category-reader@example.invalid' },
    });
    const session = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal(
      (await api('products', { session, method: 'POST', body: defaults }))
        .status,
      403,
    );
    assert.equal(
      (
        await api(`${listingPath(listing)}/actions/publish`, {
          storeId: ids.storeId,
          session,
          method: 'POST',
          body: {
            revision: listing.revision,
            rootRevision: listing.rootRevision,
          },
        })
      ).status,
      403,
    );
    const foreignCategory = await db.category.findFirstOrThrow({
      where: { tenantId: tenantB.id },
    });
    const bad = await api('listings', {
      storeId: ids.storeId,
      method: 'POST',
      body: {
        code: 'foreign',
        title: 'Foreign',
        slug: 'foreign-listing',
        productRevisionId: key.id,
        categoryIds: [foreignCategory.id],
        skuRevisionIds: key.skus.map((s) => s.id),
      },
    });
    assert.equal(bad.status, 400);
  });
  await test('New catalog publications preserve old listing pins; listing repins are explicit and concurrency checked', async () => {
    const oldPin = listing.productRevisionId;
    let next = ok(
      await api(`${path(normal)}/clone`, {
        method: 'POST',
        body: { revision: normal.revision },
      }),
    );
    const update = draftInput(next);
    update.name = 'New shared revision';
    next = ok(await api(path(next), { method: 'PATCH', body: update }), 200);
    next = await publish(next);
    assert.equal(
      ok(
        await api(`${path(normal)}/resolve`, {
          method: 'POST',
          body: { selection: [] },
        }),
      ).status,
      'RESOLVED',
    );
    assert.equal(
      (await api(listingPath(listing), { storeId: ids.storeId })).data
        .productRevisionId,
      oldPin,
    );
    assert.equal(
      (
        await api(`products/${normal.productId}/archive`, {
          method: 'POST',
          body: { revision: next.rootRevision },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          `products/${normal.productId}/skus/${next.skus[0].skuId}/archive`,
          { method: 'POST', body: { revision: next.rootRevision } },
        )
      ).status,
      409,
    );
    let clone = ok(
      await api(`${listingPath(listing)}/clone`, {
        storeId: ids.storeId,
        method: 'POST',
        body: { revision: listing.revision },
      }),
    );
    const input = {
      revision: clone.revision,
      productRevisionId: next.id,
      title: 'Explicit store update',
      slug: clone.slug,
      visible: clone.visible,
      seo: clone.seo,
      categoryIds: clone.categories.map((c) => c.categoryId),
      skuRevisionIds: next.skus.map((s) => s.id),
      featuredOrder: null,
      newArrivalOrder: null,
    };
    clone = ok(
      await api(listingPath(clone), {
        storeId: ids.storeId,
        method: 'PATCH',
        body: input,
      }),
      200,
    );
    assert.equal(
      (
        await api(listingPath(clone), {
          storeId: ids.storeId,
          method: 'PATCH',
          body: input,
        })
      ).status,
      409,
    );
    listing = await listAction(
      await listAction(await listAction(clone, 'review'), 'approve'),
      'publish',
    );
    assert.equal(listing.productRevisionId, next.id);
    normal = next;
    assert.equal(
      (await api(`products/${normal.productId}/revisions?pageSize=1&page=2`))
        .data.items.length,
      1,
    );
  });
  await test('Tenant catalog editor custom role cannot approve, publish, add SKUs or edit tenant schemas', async () => {
    const user = await db.adminUser.findUniqueOrThrow({
      where: { email: 'category-reader@example.invalid' },
    });
    const role = await db.scopedRole.create({
      data: {
        tenantId: ids.tenantId,
        scopeKind: 'TENANT',
        code: 'CATALOG_EDITOR_ONLY',
        name: 'Catalog editor only',
      },
    });
    for (const code of ['products.view', 'products.update', 'skus.update']) {
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
      data: { tenantId: ids.tenantId, userId: user.id, roleId: role.id },
    });
    const session = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal((await api(path(normal), { session })).status, 200);
    for (const a of ['approve', 'publish'])
      assert.equal(
        (
          await api(`${path(normal)}/actions/${a}`, {
            session,
            method: 'POST',
            body: {
              revision: normal.revision,
              rootRevision: normal.rootRevision,
            },
          })
        ).status,
        403,
      );
    const clone = ok(
      await api(`${path(normal)}/clone`, {
        session,
        method: 'POST',
        body: { revision: normal.revision },
      }),
    );
    const update = draftInput(clone);
    delete update.skus[0].id;
    update.skus[0].code = 'UNAUTHORIZED-SKU';
    assert.equal(
      (await api(path(clone), { session, method: 'PATCH', body: update }))
        .status,
      403,
    );
    assert.equal(
      (
        await call('attributes', {
          session,
          method: 'POST',
          body: attribute('forbidden_from_editor'),
        })
      ).status,
      403,
    );
  });
  await test('Shared gallery/poster, variant and listing media references are ordered, scoped and immutable after review', async () => {
    let r = ok(
      await api('products', {
        method: 'POST',
        body: {
          ...defaults,
          code: 'poster_fixture',
          slug: 'poster-fixture',
          skus: [sku('POSTER-DEFAULT')],
        },
      }),
    );
    const asset = await db.mediaAsset.create({
      data: {
        tenantId: ids.tenantId,
        code: 'synthetic-reference-only',
        mimeType: 'image/webp',
        width: 1200,
        height: 2400,
        sourceUrl: 'https://example.invalid/synthetic-fixture',
        rightsMetadata: { synthetic: true, developmentOnly: true },
        createdBy: owner.id,
      },
    });
    const common = {
      tenantId: ids.tenantId,
      productRevisionId: r.id,
      assetId: asset.id,
      altText: 'Synthetic poster metadata; no image file',
      presentation: {
        widths: [480, 768, 1200],
        fit: 'contain',
        loading: 'lazy',
      },
    };
    await db.productRevisionMedia.create({
      data: { ...common, purpose: 'GALLERY', sortOrder: 0 },
    });
    const poster = await db.productRevisionMedia.create({
      data: { ...common, purpose: 'DETAIL_POSTER', sortOrder: 0 },
    });
    await db.productRevisionMedia.create({
      data: {
        ...common,
        purpose: 'DETAIL_POSTER',
        sortOrder: 1,
        altText: 'Second synthetic poster',
      },
    });
    const variantPoster = await db.sKURevisionMedia.create({
      data: {
        ...common,
        productId: r.productId,
        skuRevisionId: r.skus[0].id,
        purpose: 'DETAIL_POSTER',
        sortOrder: 0,
      },
    });
    assert.equal(
      (
        await api(`${path(r)}/actions/review`, {
          method: 'POST',
          body: { revision: r.revision },
        })
      ).status,
      400,
    );
    await db.mediaAsset.update({
      where: { id: asset.id },
      data: {
        rights: 'APPROVED',publicUse:true,developmentOnly:false,
        rightsMetadata: {
          synthetic: true,
          developmentOnly: true,
          permission: 'test-metadata-only',
        },
      },
    });
    r = await publish(r);
    await assert.rejects(() =>
      db.productRevisionMedia.update({
        where: { id: poster.id },
        data: { sortOrder: 4 },
      }),
    );
    await assert.rejects(() =>
      db.sKURevisionMedia.update({
        where: { id: variantPoster.id },
        data: { altText: 'Changed' },
      }),
    );
    await assert.rejects(() =>
      db.mediaAsset.update({
        where: { id: asset.id },
        data: { sourceUrl: 'https://example.invalid/replacement' },
      }),
    );
    const clone = ok(
      await api(`${path(r)}/clone`, {
        method: 'POST',
        body: { revision: r.revision },
      }),
    );
    assert.equal(clone.media.length, 3);
    assert.equal(clone.skus[0].media.length, 1);
    let l = ok(
      await api('listings', {
        storeId: ids.storeId,
        method: 'POST',
        body: {
          code: 'poster_listing',
          title: 'Poster fixture',
          slug: 'poster-fixture-listing',
          productRevisionId: r.id,
          categoryIds: [c.id],
          skuRevisionIds: r.skus.map((s) => s.id),
        },
      }),
    );
    const presentation = {
      tenantId: ids.tenantId,
      storeId: ids.storeId,
      listingRevisionId: l.id,
      productId: r.productId,
      productRevisionId: r.id,
      purpose: 'DETAIL_POSTER',
      altText: 'Approved synthetic poster',
    };
    const pin = await db.listingRevisionMedia.create({
      data: { ...presentation, productMediaId: poster.id, sortOrder: 0 },
    });
    await db.listingRevisionMedia.create({
      data: { ...presentation, skuMediaId: variantPoster.id, sortOrder: 1 },
    });
    l = await listAction(
      await listAction(await listAction(l, 'review'), 'approve'),
      'publish',
    );
    await assert.rejects(() =>
      db.listingRevisionMedia.update({
        where: { id: pin.id },
        data: { visible: false },
      }),
    );
    const cloned = ok(
      await api(`${listingPath(l)}/clone`, {
        storeId: ids.storeId,
        method: 'POST',
        body: { revision: l.revision },
      }),
    );
    assert.equal(cloned.media.length, 2);
    await assert.rejects(() =>
      db.listingRevisionMedia.create({
        data: {
          ...presentation,
          listingRevisionId: cloned.id,
          storeId: randomUUID(),
          productMediaId: poster.id,
          sortOrder: 2,
        },
      }),
    );
  });
  await test('Actual foreign product/store identities cannot cross compound catalog boundaries', async () => {
    const type = await db.productType.create({
      data: {
        tenantId: tenantB.id,
        code: 'foreign_catalog',
        label: 'Foreign catalog',
      },
    });
    const product = await db.product.create({
      data: {
        tenantId: tenantB.id,
        productTypeId: type.id,
        code: 'foreign_product',
        createdBy: member.id,
      },
    });
    assert.equal((await api(`products/${product.id}`)).status, 404);
    await assert.rejects(() =>
      db.storeListing.create({
        data: {
          ...ids,
          productId: product.id,
          code: 'foreign_attach',
          createdBy: owner.id,
        },
      }),
    );
    const other = await db.store.findFirstOrThrow({
      where: { tenantId: ids.tenantId, slug: 'other' },
    });
    const foreignListing = await db.storeListing.create({
      data: {
        tenantId: ids.tenantId,
        storeId: other.id,
        productId: normal.productId,
        code: 'other_store_listing',
        createdBy: owner.id,
      },
    });
    assert.equal(
      (
        await api(`listings/${foreignListing.id}/archive`, {
          storeId: ids.storeId,
          method: 'POST',
          body: { revision: 1 },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await api(
          `listings/${foreignListing.id}/revisions/${listing.id}/actions/publish`,
          {
            storeId: other.id,
            method: 'POST',
            body: { revision: 1, rootRevision: 1 },
          },
        )
      ).status,
      403,
    );
    const plan = (
      await import('./plan-legacy-catalog.mjs')
    ).legacyCatalogPlan();
    assert.equal(plan.products, 84);
    assert.equal(plan.categories, 12);
    assert.ok(
      plan.records.every(
        (r) =>
          r.skuConfigurations === 'NOT_INFERRED' &&
          !r.purchasable &&
          !r.referencePrice.approved &&
          r.media.posters.length === 0,
      ),
    );
  });
  return {
    browser: async ({ page, base, cookie }) => {
      await page.goto(base + '/products');
      await page
        .getByRole('heading', { name: 'Products & SKU Variants', exact: true })
        .waitFor();
      await page.getByRole('button',{name:'Review imported catalog decisions',exact:true}).click();
      await page.getByText('No imported source decisions in this tenant.',{exact:true}).waitFor();
      await page
        .getByRole('button', { name: 'Create product', exact: true })
        .click();
      await page
        .getByLabel('Product code', { exact: true })
        .fill('browser_retail');
      await page
        .getByLabel('Product name', { exact: true })
        .fill('Browser retail');
      await page
        .getByLabel('Product slug', { exact: true })
        .fill('browser-retail');
      await page
        .getByLabel('Approved catalog schema', { exact: true })
        .selectOption(retail.version.id);
      await page
        .getByLabel('Product: product power (required) (W)', { exact: true })
        .fill('0');
      await page
        .getByLabel('Product: product wireless', { exact: true })
        .selectOption('false');
      await page
        .getByRole('button', { name: 'Add explicit SKU', exact: true })
        .click();
      await page
        .getByLabel('SKU 1 code', { exact: true })
        .fill('BROWSER-DEFAULT');
      await page
        .getByLabel('SKU 1 manufacturer part number', { exact: true })
        .fill('BROWSER-PART');
      await page
        .getByRole('button', { name: 'Save product draft', exact: true })
        .click();
      await page
        .getByText('Product version 1 · DRAFT · Revision 2', { exact: true })
        .waitFor();
      for (const [a, state, n] of [
        ['Review', 'IN_REVIEW', 3],
        ['Approve', 'APPROVED', 4],
      ]) {
        await page
          .getByRole('button', { name: `${a} product`, exact: true })
          .click();
        await page
          .getByText(`Product version 1 · ${state} · Revision ${n}`, {
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
        .getByText('Product version 1 · PUBLISHED · Revision 5', {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Save product draft', exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole('button', { name: 'Resolve saved SKU', exact: true })
        .click();
      await page
        .getByText('Resolution: RESOLVED. Matching SKU: BROWSER-DEFAULT.', {
          exact: true,
        })
        .waitFor();
      const p = await db.product.findUniqueOrThrow({
        where: {
          tenantId_code: { tenantId: ids.tenantId, code: 'browser_retail' },
        },
      });
      await page
        .getByRole('button', { name: 'Clone product draft', exact: true })
        .click();
      await page
        .getByText('Product version 2 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      await page.goto(base + '/listings');
      await page
        .getByRole('heading', { name: 'Store Listings', exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'Create store listing', exact: true })
        .click();
      await page
        .getByLabel('Listing code', { exact: true })
        .fill('browser_listing');
      await page
        .getByLabel('Approved product revision', { exact: true })
        .selectOption(p.publishedRevisionId);
      await page
        .getByLabel('Listing slug', { exact: true })
        .fill('browser-store-listing');
      await page
        .getByRole('group', { name: 'Listing categories', exact: true })
        .getByLabel('electronics', { exact: true })
        .check();
      await page
        .getByRole('button', { name: 'Save listing draft', exact: true })
        .click();
      await page
        .getByText('Listing version 1 · DRAFT · Revision 2', { exact: true })
        .waitFor();
      for (const [a, state, n] of [
        ['Review', 'IN_REVIEW', 3],
        ['Approve', 'APPROVED', 4],
      ]) {
        await page
          .getByRole('button', { name: `${a} listing`, exact: true })
          .click();
        await page
          .getByText(`Listing version 1 · ${state} · Revision ${n}`, {
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
        .getByText('Listing version 1 · PUBLISHED · Revision 5', {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Save listing draft', exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole('button', { name: 'Clone listing draft', exact: true })
        .click();
      await page
        .getByText('Listing version 2 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
      }
      for (const route of [
        `scopes/tenants/${ids.tenantId}/catalog/products`,
        `stores/${ids.storeId}/listings`,
      ])
        assert.equal(
          (
            await fetch(`${base}/api/admin/${route}`, {
              method: 'POST',
              headers: { Cookie: cookie, 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).status,
          403,
        );
      for (const route of [
        `scopes/tenants/${ids.tenantId}/catalog/sql`,
        `stores/${ids.storeId}/listings/${listing.listingId}/revisions/${listing.id}/actions/reset`,
      ])
        assert.equal(
          (
            await fetch(`${base}/api/admin/${route}`, {
              headers: { Cookie: cookie },
            })
          ).status,
          404,
        );
      console.log(
        'PASS Real product/SKU and listing forms, typed zero/false, explicit SKU resolution, approval/publication, clones, responsive layouts and protected BFF',
      );
    },
  };
}
