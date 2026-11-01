import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import sharp from 'sharp';
export async function verifyStorefront({
  db,
  ids,
  owner,
  token,
  tenantB,
  base,
  test,
  create,
  attribute,
  makeType,
  action,
}) {
  const call = async (route, { body, method = body ? 'POST' : 'GET' } = {}) => {
    const r = await fetch(base + '/api/admin/' + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
        Authorization: 'Bearer ' + token,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await r.json();
    assert.ok(
      r.status === 200 || r.status === 201,
      `${method} ${route.replace(/[a-f0-9-]{36}/g, ':id')}: ${r.status} ${json.message ?? ''}`,
    );
    return json;
  };
  const publicGet = async (route, status = 200, headers = {}) => {
    const r = await fetch(base + '/api/catalog/' + route, { headers });
    assert.equal(r.status, status, `Public ${route}: ${r.status}`);
    return status === 200 ? r.json() : null;
  };
  const store = `stores/${ids.storeId}`,
    catalog = `scopes/tenants/${ids.tenantId}/catalog`,
    media = `scopes/tenants/${ids.tenantId}/media`;
  const catAction = async (c, a) =>
    call(`${store}/categories/${c.id}/actions/${a}`, {
      body: { revision: c.revision },
    });
  const category = async (code, parentId = null) => {
    let c = await call(`${store}/categories`, {
      body: {
        code,
        name:
          code === 'storefront_fixtures'
            ? 'Storefront fixtures'
            : code === 'storefront_keyboards'
              ? 'Keyboards'
              : 'Apparel',
        slug: code.replaceAll('_', '-'),
        parentId,
      },
    });
    for (const a of ['review', 'approve', 'activate'])
      c = await catAction(c, a);
    return c;
  };
  const root = await category('storefront_fixtures'),
    keyCategory = await category('storefront_keyboards', root.id),
    fashionCategory = await category('storefront_apparel', root.id);
  const types = await db.productType.findMany({
      where: { tenantId: ids.tenantId, code: { startsWith: 'catalog_' } },
      include: {
        versions: {
          where: { status: { in: ['APPROVED', 'ACTIVE'] } },
          include: { attributes: true },
        },
      },
    }),
    type = (code) => {
      if (code === 'catalog_retail') return retail.version;
      const t = types.find((t) => t.code === code);
      assert.ok(t);
      return t.versions[0];
    };
  const color = await db.attributeDefinition.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'product_color' },
      },
      include: { optionSet: { include: { values: true } } },
    }),
    sw = await db.attributeDefinition.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'product_switch' },
      },
      include: { optionSet: { include: { values: true } } },
    }),
    sensor = await db.attributeDefinition.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'product_sensor' },
      },
    }),
    power = await db.attributeDefinition.findUniqueOrThrow({
      where: {
        tenantId_code: { tenantId: ids.tenantId, code: 'product_power' },
      },
    });
  const option = (a, code) =>
      a.optionSet.values.find((v) => v.code === code).id,
    choice = (a, code) => ({ attributeId: a.id, options: [option(a, code)] }),
    sku = (code, values = []) => ({ code, values, state: 'ACTIVE' });
  const publicFlag = await create(
    'attributes',
    attribute('storefront_flag', 'BOOLEAN'),
  );
  const brand = await call(`${catalog}/brands`, {
    body: { code: 'fixture_brand', name: 'Fixture brand' },
  });
  let retail = await makeType(
    'storefront_retail',
    'Storefront general product',
    [power, publicFlag],
  );
  retail.version = await action(
    await action(retail.version, retail.type, 'review'),
    retail.type,
    'approve',
  );
  const sizeSet = await create('option-sets', {
      code: 'storefront_size',
      label: 'Size',
      values: ['s', 'm', 'l'].map((code) => ({
        code,
        label: code.toUpperCase(),
      })),
    }),
    size = await create(
      'attributes',
      attribute('storefront_size', 'SINGLE_SELECT', {
        optionSetId: sizeSet.id,
        allowedScopes: ['SKU'],
        axisEligible: true,
      }),
    );
  let fashion = await makeType('storefront_apparel', 'Apparel', [color, size]);
  fashion.version = await action(
    await action(fashion.version, fashion.type, 'review'),
    fashion.type,
    'approve',
  );
  const productAction = async (p, a) =>
    call(`${catalog}/products/${p.productId}/revisions/${p.id}/actions/${a}`, {
      body: { revision: p.revision, rootRevision: p.rootRevision },
    });
  const products = [];
  async function makeProduct(
    code,
    schema,
    skus,
    values = [],
    axisIds = [],
    mode = 'RETAIL',
    categoryId = root.id,
    withMedia = false,
  ) {
    let p = await call(`${catalog}/products`, {
      body: {
        code,
        name: code.replaceAll('_', ' '),
        slug: code.replaceAll('_', '-'),
        schemaVersionId: schema.id,
        description: 'Synthetic development fixture',
        sellingMode: mode,
        skus,
        values:
          schema.id === retail.version.id
            ? [...values, { attributeId: publicFlag.id, boolean: false }]
            : values,
        axisIds,
        brandId: brand.id,
      },
    });
    if (withMedia) {
      const bytes = await sharp({
          create: {
            width: 800,
            height: 1400,
            channels: 3,
            background: '#244477',
          },
        })
          .png()
          .toBuffer(),
        assets = [];
      for (const name of [
        'Shared gallery',
        'Poster first',
        'Poster second',
        'Variant poster',
        'Variant gallery',
      ]) {
        let a = await call(media + '/uploads', {
          body: {
            uploadKey: randomUUID(),
            fileName: name + '.png',
            mimeType: 'image/png',
            dataBase64: bytes.toString('base64'),
            altText: name,
            intendedPurpose: name.includes('gallery')
              ? 'GALLERY'
              : 'DETAIL_POSTER',
          },
        });
        a = await call(`${media}/assets/${a.id}/approve`, {
          body: {
            revision: a.revision,
            license:
              'Synthetic fixture generated by the isolated test; public reuse permitted',
            attribution: 'Test fixture',
            scope: 'PUBLIC',
          },
        });
        assets.push(a);
      }
      const refs = assets.slice(0, 3).map((a, i) => ({
        assetId: a.id,
        purpose: i === 0 ? 'GALLERY' : 'DETAIL_POSTER',
        altText: a.altText,
        caption: i === 0 ? null : `Feature ${i}`,
      }));
      let update = await call(
        `${media}/products/${p.productId}/revisions/${p.id}/assignments`,
        { method: 'PATCH', body: { revision: p.revision, references: refs } },
      );
      await call(
        `${media}/products/${p.productId}/revisions/${p.id}/skus/${(p.skus.find((s) => s.sku.code === 'SF-BLACK') ?? p.skus[0]).id}/assignments`,
        {
          method: 'PATCH',
          body: {
            revision: update.revision,
            references: [
              {
                assetId: assets[3].id,
                purpose: 'DETAIL_POSTER',
                altText: 'Variant poster',
              },
              {
                assetId: assets[4].id,
                purpose: 'GALLERY',
                altText: 'Variant gallery',
              },
            ],
          },
        },
      );
      p = await call(`${catalog}/products/${p.productId}/revisions/${p.id}`);
      p.fixtureAssetIds = assets.map((a) => a.id);
    }
    const assetIds = p.fixtureAssetIds;
    for (const a of ['review', 'approve', 'publish'])
      p = await productAction(p, a);
    let l = await call(store + '/listings', {
      body: {
        code,
        title: p.name,
        slug: code.replaceAll('_', '-'),
        productRevisionId: p.id,
        categoryIds: [categoryId],
        skuRevisionIds: p.skus.map((s) => s.id),
        featuredOrder: products.length,
        newArrivalOrder: products.length,
      },
    });
    for (const a of ['review', 'approve', 'publish'])
      l = await call(
        `${store}/listings/${l.listingId}/revisions/${l.id}/actions/${a}`,
        { body: { revision: l.revision, rootRevision: l.rootRevision } },
      );
    const result = { p, l, assetIds };
    products.push(result);
    return result;
  }
  const keyboard = await makeProduct(
    'storefront_keyboard',
    type('catalog_keyboard'),
    [
      sku('SF-BLACK', [choice(color, 'black'), choice(sw, 'stormrise')]),
      sku('SF-WHITE', [choice(color, 'white'), choice(sw, 'lingyun')]),
      sku('SF-ORANGE', [choice(color, 'orange'), choice(sw, 'stormrise')]),
    ],
    [],
    [color.id, sw.id],
    'RETAIL',
    keyCategory.id,
    true,
  );
  const mouse = await makeProduct(
    'storefront_mouse',
    type('catalog_mouse'),
    [
      sku('SF-MOUSE-B', [
        choice(color, 'black'),
        { attributeId: sensor.id, text: 'Sensor A' },
      ]),
      sku('SF-MOUSE-W', [
        choice(color, 'white'),
        { attributeId: sensor.id, text: 'Sensor B' },
      ]),
    ],
    [],
    [color.id],
  );
  const clothing = await makeProduct(
    'storefront_clothing',
    fashion.version,
    [
      sku('SF-APPAREL-S', [
        choice(color, 'black'),
        {
          attributeId: size.id,
          options: [sizeSet.values.find((v) => v.code === 's').id],
        },
      ]),
      sku('SF-APPAREL-M', [
        choice(color, 'white'),
        {
          attributeId: size.id,
          options: [sizeSet.values.find((v) => v.code === 'm').id],
        },
      ]),
    ],
    [],
    [color.id, size.id],
    'RETAIL',
    fashionCategory.id,
  );
  const vehicle = await makeProduct(
    'storefront_vehicle',
    type('catalog_vehicle'),
    [],
    [{ attributeId: power.id, number: '125' }],
    [],
    'RFQ',
  );
  const single = await makeProduct(
    'storefront_single',
    type('catalog_retail'),
    [sku('SF-SINGLE')],
    [{ attributeId: power.id, number: '0' }],
  );
  const reference = await makeProduct(
    'storefront_reference',
    type('catalog_retail'),
    [sku('SF-REFERENCE')],
    [{ attributeId: power.id, number: '25' }],
    [],
    'REFERENCE',
  );
  const locations = await call(`${store}/operations/locations`);
  for (const [index, fixture] of products.entries())
    for (const [n, s] of fixture.p.skus.entries()) {
      const position =
        fixture === keyboard
          ? { 'SF-BLACK': 0, 'SF-WHITE': 1, 'SF-ORANGE': 2 }[s.sku.code]
          : n;
      const ops = `${store}/operations/skus/${s.skuId}`;
      let offer = await call(ops + '/prices', {
        body: {
          currency: 'PKR',
          regularAmount: String(1000 + index * 100 + position * 1000),
          promotions: [],
        },
      });
      for (const a of ['review', 'approve', 'publish'])
        offer = await call(`${ops}/prices/${offer.id}/actions/${a}`, {
          body: {
            revision: offer.revision,
            rootRevision: offer.rootRevision ?? offer.price.revision,
          },
        });
      await call(ops + '/inventory', {
        method: 'PATCH',
        body: { revision: 0, policy: 'QUANTITY', lowStockThreshold: 2 },
      });
      if (
        fixture !== reference &&
        !(fixture === keyboard && s.sku.code === 'SF-ORANGE')
      )
        for (const l of locations)
          await call(ops + '/inventory/adjustments', {
            body: {
              locationId: l.id,
              expectedRevision: 0,
              idempotencyKey: randomUUID(),
              mode: 'COUNT',
              quantity:
                fixture === keyboard && s.sku.code === 'SF-BLACK' ? 0 : 5,
              reason: 'Synthetic physical verification',
            },
          });
    }
  let filterSet = await call(
    `${store}/categories/${keyCategory.id}/filter-sets`,
    { body: {} },
  );
  const filter = (code, source, extra = {}) => ({
    code,
    label:
      code === 'color'
        ? 'Color'
        : code === 'switch'
          ? 'Switch'
          : code === 'price'
            ? 'Price'
            : 'Availability',
    description: '',
    group: 'Filters',
    source,
    level: 'SKU',
    control: source === 'PRICE' ? 'number_range' : 'checkbox_group',
    operators: source === 'PRICE' ? ['gte', 'lte'] : ['in'],
    displayUnit: source === 'PRICE' ? 'PKR' : null,
    ...extra,
  });
  filterSet = await call(
    `${store}/categories/${keyCategory.id}/filter-sets/${filterSet.id}`,
    {
      method: 'PATCH',
      body: {
        revision: filterSet.revision,
        includeDescendants: true,
        typeVersionIds: [keyboard.p.schemaVersionId],
        filters: [
          filter('color', 'ATTRIBUTE', {
            attributeId: color.id,
            aliases: ['colour'],
          }),
          filter('switch', 'ATTRIBUTE', { attributeId: sw.id }),
          filter('price', 'PRICE'),
          filter('availability', 'AVAILABILITY'),
        ],
      },
    },
  );
  for (const a of ['review', 'approve', 'activate'])
    filterSet = await call(
      `${store}/categories/${keyCategory.id}/filter-sets/${filterSet.id}/actions/${a}`,
      {
        body: {
          revision: filterSet.revision,
          categoryRevision: keyCategory.filterRevision,
        },
      },
    );
  await test('Public projection includes only published pinned store data and rejects forged scope, Host and internal fields', async () => {
    const nav = await publicGet('navigation'),
      listed = await publicGet('listings?pageSize=24');
    assert.equal(nav.store.name, 'VOGPK');
    assert.ok(listed.items.some((i) => i.slug === keyboard.l.slug));
    await publicGet('listings?storeId=' + ids.storeId, 400);
    await publicGet('listings?tenantId=' + tenantB.id, 400);
    await publicGet('listings?pageSize=25', 400);
    await publicGet('listings?sort=DROP', 400);
    const hostile = await publicGet('navigation', 200, {
      Host: 'hostile.invalid',
      'x-store-id': tenantB.id,
    });
    assert.deepEqual(hostile, nav);
    const text = JSON.stringify(listed);
    for (const forbidden of [
      'createdBy',
      'approvedBy',
      'tenantId',
      'passwordHash',
      'rightsMetadata',
      'storageReference',
      'procurement',
      'rootRevision',
    ])
      assert.equal(text.includes('"' + forbidden + '"'), false);
    assert.equal(
      (
        await fetch(base + '/api/catalog/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      404,
    );
  });
  const listing = async (filters, extra = {}) =>
    publicGet(
      'listings?' +
        new URLSearchParams({
          category: keyCategory.slug,
          filters: new URLSearchParams(filters).toString(),
          ...extra,
        }),
    );
  await test('Real filters use one offered SKU for color, dependent switch, approved price and verified stock; facets count distinct products', async () => {
    assert.equal(
      (await listing({ color: 'black', availability: 'in_stock' })).total,
      0,
    );
    assert.equal(
      (await listing({ color: 'white', switch: 'stormrise' })).total,
      0,
    );
    assert.equal((await listing({ color: 'white', price: '..1500' })).total, 0);
    const yes = await listing({
      color: 'white',
      switch: 'lingyun',
      availability: 'in_stock',
      price: '1500..2500',
    });
    assert.equal(yes.total, 1);
    assert.equal(yes.items[0].offer.amount, '2000');
    assert.equal(
      (await listing({ color: 'orange', availability: 'in_stock' })).total,
      0,
    );
    const or = await listing([
      ['color', 'black'],
      ['color', 'white'],
    ]);
    assert.equal(or.total, 1);
    assert.equal(
      or.facets
        .find((f) => f.code === 'color')
        .values.find((v) => v.code === 'white').count,
      1,
    );
    assert.equal(
      (await listing({ colour: 'white' })).canonicalFilters,
      'color=white',
    );
    for (const filter of [
      { unknown: 'x' },
      { color: 'purple' },
      { price: '1W..2W' },
      { constructor: 'x' },
      { color: 'black', colour: 'white' },
    ])
      await publicGet(
        'listings?' +
          new URLSearchParams({
            category: keyCategory.slug,
            filters: new URLSearchParams(filter).toString(),
          }),
        400,
      );
  });
  await test('Parent categories, mixed industries, pagination, reference-only prices and unknown inventory remain truthful', async () => {
    const parent = await publicGet(
      'listings?' +
        new URLSearchParams({ category: root.slug, pageSize: '24' }),
    );
    assert.equal(parent.total, products.length);
    assert.ok(parent.items.find((p) => p.slug === vehicle.l.slug && !p.offer));
    const ref = await publicGet('products/' + reference.l.slug);
    assert.equal(ref.offer, null);
    assert.ok(ref.variants.every((v) => v.offer === null));
    assert.equal(ref.purchasable, false);
    const first = await publicGet(
        `listings?category=${root.slug}&sort=price-asc&pageSize=2`,
      ),
      second = await publicGet(
        `listings?category=${root.slug}&sort=price-asc&pageSize=2&page=2`,
      );
    assert.equal(
      first.items.some((a) => second.items.some((b) => b.id === a.id)),
      false,
    );
    assert.deepEqual(
      (
        await publicGet(
          `listings?category=${root.slug}&sort=price-asc&pageSize=2`,
        )
      ).items,
      first.items,
    );
  });
  await test('Dependent SKU details expose actual options, sensors and apparel combinations without private specifications', async () => {
    const k = await publicGet('products/' + keyboard.l.slug);
    assert.equal(k.variants.length, 3);
    assert.equal(k.axes.length, 2);
    assert.equal(
      k.variants.some(
        (v) => v.code === 'SF-BLACK' && v.availability === 'out_of_stock',
      ),
      true,
    );
    const ms = await publicGet(
      'products/' + mouse.l.slug + '?variant=SF-MOUSE-W',
    );
    assert.equal(ms.selectedVariant, 'SF-MOUSE-W');
    assert.ok(
      ms.variants
        .find((v) => v.code === 'SF-MOUSE-W')
        .specifications.flatMap((g) => g.fields)
        .some((f) => f.value === 'Sensor B'),
    );
    const apparel = await publicGet('products/' + clothing.l.slug);
    assert.equal(apparel.axes.length, 2);
    assert.equal(apparel.variants.length, 2);
    const one = await publicGet('products/' + single.l.slug);
    assert.equal(one.axes.length, 0);
    assert.equal(one.variants.length, 1);
    assert.equal(
      (await publicGet('products/' + vehicle.l.slug)).variants.length,
      0,
    );
    await publicGet('products/' + keyboard.l.slug + '?variant=SF-FAKE', 404);
    await publicGet(
      'products/' + keyboard.l.slug + '?tenantId=' + tenantB.id,
      400,
    );
  });
  await test('Approved shared gallery and ordered variant posters are delivered through checked public media, never private storage', async () => {
    const data = await publicGet('products/' + keyboard.l.slug),
      v = data.variants.find((v) => v.code === 'SF-BLACK');
    assert.deepEqual(
      data.media.filter((m) => m.purpose === 'DETAIL_POSTER').map((m) => m.alt),
      ['Poster first', 'Poster second'],
    );
    assert.equal(
      v.media.filter((m) => m.purpose === 'DETAIL_POSTER').length,
      3,
    );
    assert.equal(v.media.filter((m) => m.purpose === 'GALLERY').length, 2);
    const r = await fetch(
      `${base}/api/catalog/media/${keyboard.l.slug}/${keyboard.assetIds[0]}?width=320`,
    );
    assert.equal(r.status, 200);
    assert.equal(
      (await sharp(Buffer.from(await r.arrayBuffer())).metadata()).width,
      320,
    );
    const privateAsset = await db.mediaAsset.findFirstOrThrow({
      where: { tenantId: ids.tenantId, developmentOnly: true },
    });
    await publicGet(`media/${keyboard.l.slug}/${privateAsset.id}`, 404);
    await publicGet(`media/${keyboard.l.slug}/${randomUUID()}`, 404);
    await publicGet(
      `media/${keyboard.l.slug}/${keyboard.assetIds[0]}?width=999`,
      400,
    );
  });
  await test('Mixed-type filters preserve shared attribute meaning, canonical units, false values and registered brand semantics', async () => {
    let set = await call(`${store}/categories/${root.id}/filter-sets`, {
      body: {},
    });
    set = await call(`${store}/categories/${root.id}/filter-sets/${set.id}`, {
      method: 'PATCH',
      body: {
        revision: set.revision,
        includeDescendants: true,
        typeVersionIds: [
          keyboard.p.schemaVersionId,
          mouse.p.schemaVersionId,
          clothing.p.schemaVersionId,
          vehicle.p.schemaVersionId,
          retail.version.id,
        ],
        filters: [
          filter('color', 'ATTRIBUTE', {
            attributeId: color.id,
            typeVersionIds: [
              keyboard.p.schemaVersionId,
              mouse.p.schemaVersionId,
              clothing.p.schemaVersionId,
            ],
          }),
          filter('power', 'ATTRIBUTE', {
            attributeId: power.id,
            level: 'PRODUCT',
            control: 'number_range',
            operators: ['gte', 'lte'],
            displayUnit: 'kW',
            typeVersionIds: [retail.version.id, vehicle.p.schemaVersionId],
          }),
          filter('flag', 'ATTRIBUTE', {
            attributeId: publicFlag.id,
            level: 'PRODUCT',
            control: 'boolean_toggle',
            operators: ['eq'],
            typeVersionIds: [retail.version.id],
          }),
          filter('brand', 'BRAND', {
            level: 'PRODUCT',
            control: 'single_select',
            operators: ['eq'],
            allowedValues: ['fixture_brand', 'other_brand'],
          }),
        ],
      },
    });
    for (const a of ['review', 'approve', 'activate'])
      set = await call(
        `${store}/categories/${root.id}/filter-sets/${set.id}/actions/${a}`,
        {
          body: {
            revision: set.revision,
            categoryRevision: root.filterRevision,
          },
        },
      );
    const get = (filters) =>
      publicGet(
        'listings?' +
          new URLSearchParams({
            category: root.slug,
            filters: new URLSearchParams(filters).toString(),
            pageSize: '24',
          }),
      );
    assert.equal((await get({ color: 'white' })).total, 3);
    assert.equal((await get({ power: '0..0' })).total, 1);
    assert.equal((await get({ flag: 'false' })).total, 2);
    assert.equal((await get({ brand: 'other_brand' })).total, 0);
    assert.equal((await get({ brand: 'fixture_brand' })).total, 6);
    const one = await publicGet('products/' + single.l.slug);
    assert.ok(
      one.specifications
        .flatMap((g) => g.fields)
        .some((f) => f.value === false),
    );
  });
  await test('Public query stays bounded with 200 extra published records and an equally published foreign-store twin', async () => {
    const seed = async (tenantId, storeId, count, foreign = false) =>
      db.$transaction(
        async (tx) => {
          const kind = await tx.productType.create({
              data: {
                tenantId,
                code: foreign ? 'foreign_public' : 'performance_public',
                label: 'Inquiry fixture',
              },
            }),
            schema = await tx.productTypeVersion.create({
              data: {
                tenantId,
                productTypeId: kind.id,
                number: 1,
                label: 'Inquiry fixture',
                allowNoSku: true,
                status: 'APPROVED',
                approvedAt: new Date(),
                approvedBy: owner.id,
              },
            });
          const categoryId = foreign
            ? (
                await tx.category.create({
                  data: {
                    tenantId,
                    storeId,
                    code: 'public_twin',
                    name: 'Foreign private store',
                    slug: 'storefront-keyboards',
                    media: {},
                    seo: {},
                    createdBy: owner.id,
                    updatedBy: owner.id,
                    activeSnapshot: {
                      name: 'Foreign private store',
                      slug: 'storefront-keyboards',
                      description: '',
                      visible: true,
                      inNavigation: true,
                      sortOrder: 0,
                      media: {},
                      seo: {},
                      compatibility: 'ANY',
                      productTypeIds: [],
                    },
                    status: 'ACTIVE',
                  },
                })
              ).id
            : root.id;
          for (let i = 0; i < count; i++) {
            const code = foreign ? 'storefront_keyboard' : `perf_${i}`,
              slug = code.replaceAll('_', '-'),
              product = await tx.product.create({
                data: {
                  tenantId,
                  productTypeId: kind.id,
                  code,
                  createdBy: owner.id,
                },
              }),
              pr = await tx.productRevision.create({
                data: {
                  tenantId,
                  productId: product.id,
                  productTypeId: kind.id,
                  schemaVersionId: schema.id,
                  number: 1,
                  name: foreign ? 'FOREIGN SECRET TITLE' : `Performance ${i}`,
                  slug,
                  sellingMode: 'RFQ',
                  createdBy: owner.id,
                  updatedBy: owner.id,
                },
              }),
              listing = await tx.storeListing.create({
                data: {
                  tenantId,
                  storeId,
                  productId: product.id,
                  code,
                  createdBy: owner.id,
                },
              }),
              lr = await tx.listingRevision.create({
                data: {
                  tenantId,
                  storeId,
                  listingId: listing.id,
                  productId: product.id,
                  productRevisionId: pr.id,
                  number: 1,
                  title: foreign ? 'FOREIGN SECRET TITLE' : `Performance ${i}`,
                  slug,
                  sellingMode: 'RFQ',
                  createdBy: owner.id,
                  updatedBy: owner.id,
                },
              });
            await tx.listingCategory.create({
              data: { tenantId, storeId, listingRevisionId: lr.id, categoryId },
            });
            for (const state of ['IN_REVIEW', 'APPROVED', 'PUBLISHED']) {
              const data = {
                status: state,
                revision: { increment: 1 },
                ...(state === 'APPROVED'
                  ? { approvedBy: owner.id, approvedAt: new Date() }
                  : {}),
                ...(state === 'PUBLISHED'
                  ? { publishedBy: owner.id, publishedAt: new Date() }
                  : {}),
              };
              await tx.productRevision.update({ where: { id: pr.id }, data });
              await tx.listingRevision.update({ where: { id: lr.id }, data });
            }
            await tx.product.update({
              where: { id: product.id },
              data: { publishedRevisionId: pr.id, revision: { increment: 1 } },
            });
            await tx.storeListing.update({
              where: { id: listing.id },
              data: { publishedRevisionId: lr.id, revision: { increment: 1 } },
            });
            await tx.catalogRoute.create({
              data: {
                tenantId,
                storeId,
                slug,
                ownerKind: 'LISTING',
                published: true,
                listingId: listing.id,
              },
            });
          }
        },
        { timeout: 60000 },
      );
    const foreignStore = await db.store.findFirstOrThrow({
      where: { tenantId: tenantB.id },
    });
    await seed(tenantB.id, foreignStore.id, 1, true);
    await seed(ids.tenantId, ids.storeId, 200);
    const started = performance.now(),
      result = await publicGet(`listings?category=${root.slug}&pageSize=24`),
      durationMs = Math.round(performance.now() - started);
    assert.equal(result.total, 206);
    assert.equal(result.items.length, 24);
    assert.ok(durationMs < 8000);
    assert.equal(
      JSON.stringify(result).includes('FOREIGN SECRET TITLE'),
      false,
    );
    assert.equal(
      (await publicGet('products/' + keyboard.l.slug)).name,
      'storefront keyboard',
    );
    const [
      { StorefrontService },
      { CategoryService },
      { CategoryFiltersService },
      { CategoryUsageService },
      { ScopedAuthorizationService },
      { LocalMediaStorage },
      { Prisma },
      { offerCte },
      { query },
    ] = await Promise.all([
      import('../dist/storefront/storefront.service.js'),
      import('../dist/categories/category.service.js'),
      import('../dist/categories/filters.service.js'),
      import('../dist/categories/usage.service.js'),
      import('../dist/security/scoped-authorization.service.js'),
      import('../dist/operations/storage.js'),
      import('../dist/generated/prisma/client.js'),
      import('../dist/storefront/sql.js'),
      import('../dist/storefront/query.js'),
    ]);
    const service = new StorefrontService(
      db,
      new CategoryFiltersService(
        new CategoryService(
          db,
          new ScopedAuthorizationService(db),
          new CategoryUsageService(),
        ),
      ),
      new LocalMediaStorage(),
    );
    const explain = await service.read(async (tx, ctx) => {
      const q = query.parse({
          category: keyCategory.slug,
          filters: 'color=white&availability=in_stock',
        }),
        c = await service.contract(tx, ctx, q),
        result = await tx.$queryRaw(
          Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${offerCte(ctx.storeId, ctx.tenantId, new Date())} ${service.matchingSql(ctx, q, c, [...c.plan.productPredicates.items, ...c.plan.skuPredicate.items])}`,
        );
      return result[0]['QUERY PLAN'][0];
    });
    const nodes = [];
    const visit = (node) => {
      nodes.push({
        type: node['Node Type'],
        rows: node['Actual Rows'],
        ...(node['Index Name'] ? { index: node['Index Name'] } : {}),
      });
      for (const child of node.Plans ?? []) visit(child);
    };
    visit(explain.Plan);
    await fs.mkdir('docs', { recursive: true });
    await fs.writeFile(
      'docs/storefront-query-performance.json',
      JSON.stringify(
        {
          passed: true,
          additionalPublishedFixtures: 200,
          foreignPublishedTwin: true,
          pageSize: 24,
          total: result.total,
          durationMs,
          explain: {
            planningMs: explain['Planning Time'],
            executionMs: explain['Execution Time'],
            nodes,
          },
          queryDesign:
            'SQL pagination and sorting; one batched disjunctive-count query; no per-product queries',
          productionAccess: false,
        },
        null,
        2,
      ) + '\n',
    );
  });
  return {
    browser: async () =>
      verifyBrowser({
        base,
        publicGet,
        products,
        keyboard,
        keyCategory,
        mouse,
        vehicle,
        clothing,
        root,
        test,
        makeProduct,
        type,
        sku,
        power,
        call,
        store,
        db,
        ids,
      }),
  };
}

async function verifyBrowser({
  base,
  publicGet,
  products,
  keyboard,
  keyCategory,
  mouse,
  vehicle,
  clothing,
  root,
  test,
  makeProduct,
  type,
  sku,
  power,
  call,
  store,
  db,
  ids,
}) {
  const parent = path.resolve('.local/storefront'),
    repo = path.resolve('..');
  await fs.mkdir(parent, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(parent, 'frontend-')),
    port = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
  const env = Object.fromEntries(
    [
      'PATH',
      'Path',
      'SystemRoot',
      'SYSTEMROOT',
      'COMSPEC',
      'ComSpec',
      'USERPROFILE',
      'TEMP',
      'TMP',
      'APPDATA',
      'LOCALAPPDATA',
    ]
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  Object.assign(env, {
    NODE_ENV: 'production',
    CATALOG_MODE: 'dynamic-development',
    CATALOG_DEVELOPMENT: '1',
    CATALOG_API_ORIGIN: base,
    NEXT_TELEMETRY_DISABLED: '1',
  });
  let server,
    browser,
    page,
    runtimeLog = '';
  try {
    for (const name of [
      'src',
      'public',
      'package.json',
      'package-lock.json',
      'jsconfig.json',
      'next.config.mjs',
    ])
      await fs.cp(path.join(repo, 'frontend', name), path.join(fixture, name), {
        recursive: true,
      });
    await fs.symlink(
      path.join(repo, 'frontend/node_modules'),
      path.join(fixture, 'node_modules'),
      'junction',
    );
    const config = path.join(fixture, 'next.config.mjs');
    await fs.writeFile(
      config,
      (await fs.readFile(config, 'utf8')).replace(
        'turbopack: {',
        `turbopack: { root: ${JSON.stringify(repo)},`,
      ),
    );
    const cli = path.join(repo, 'frontend/node_modules/next/dist/bin/next'),
      build = spawn(process.execPath, [cli, 'build'], {
        cwd: fixture,
        env,
        stdio: 'pipe',
      });
    let diagnostics = '';
    build.stdout.on('data', (c) => (diagnostics += c));
    build.stderr.on('data', (c) => (diagnostics += c));
    const timer = setTimeout(() => build.kill(), 180000);
    try {
      assert.equal((await once(build, 'exit'))[0], 0, diagnostics.slice(-5000));
    } finally {
      clearTimeout(timer);
    }
    server = spawn(
      process.execPath,
      [cli, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: fixture, env, stdio: 'pipe' },
    );
    server.stdout.on('data', (c) => {
      runtimeLog = (runtimeLog + c).slice(-10000);
    });
    server.stderr.on('data', (c) => {
      runtimeLog = (runtimeLog + c).slice(-10000);
    });
    const site = `http://127.0.0.1:${port}`;
    for (let n = 0; n < 100; n++) {
      try {
        if ((await fetch(site)).status === 200) break;
      } catch {}
      if (n === 99) throw Error('Storefront fixture timeout');
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.name));
    await test('Real production-built dynamic storefront filters, dependent variants, posters, responsive layouts, SEO and homepage limits pass', async () => {
      await page.goto(`${site}/products/${keyCategory.slug}`);
      await page
        .getByRole('heading', { name: 'Keyboards', exact: true })
        .waitFor();
      console.log('PASS browser dynamic category rendered');
      await page.getByLabel('white', { exact: false }).first().check();
      await page.waitForURL(/f.color=white/);
      console.log('PASS browser dynamic URL filters');
      await page
        .getByRole('link', { name: /storefront keyboard/ })
        .first()
        .click();
      await page
        .getByRole('heading', { name: 'storefront keyboard', exact: true })
        .waitFor();
      const colors = page.getByLabel('product color', { exact: true }),
        switches = page.getByLabel('product switch', { exact: true });
      await colors.selectOption({ label: 'white' });
      assert.equal(await switches.locator('option').count(), 2);
      await switches.selectOption({ label: 'lingyun' });
      await page.getByText('SKU: SF-WHITE', { exact: true }).waitFor();
      console.log('PASS browser dynamic dependent SKU');
      assert.equal(await page.locator('.catalog-posters figure').count(), 2);
      await colors.selectOption({ label: 'black' });
      assert.equal(await switches.inputValue(), '');
      await switches.selectOption({ label: 'stormrise' });
      await page.getByText('Out of stock', { exact: true }).waitFor();
      assert.equal(await page.locator('.catalog-posters figure').count(), 3);
      assert.ok(
        await page
          .locator('.catalog-posters img')
          .evaluateAll((images) =>
            images.every(
              (i) => i.loading === 'lazy' && i.style.objectFit === 'contain',
            ),
          ),
      );
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
      }
      await page.goto(`${site}/products/${mouse.l.slug}?variant=SF-MOUSE-W`);
      await page.getByText('Sensor B', { exact: true }).waitFor();
      await page.goto(`${site}/products/${vehicle.l.slug}`);
      await page
        .getByText('Listing: Request for quote', { exact: true })
        .waitFor();
      assert.equal(
        await page.getByRole('button', { name: /add to cart/i }).count(),
        0,
      );
      const invalid = await page.goto(
        `${site}/products/${keyboard.l.slug}?variant=NOT-REAL`,
      );
      assert.equal(invalid.status(), 404);
      await page.goto(site);
      for (const id of ['featured', 'new-arrivals']) {
        const track = page.locator(`#${id}-track`);
        assert.ok((await track.locator('.product-card').count()) <= 7);
        assert.equal(
          await track.locator('a[href^="/collections/"]').count(),
          1,
        );
      }
      const html = await (
        await fetch(`${site}/products/${keyboard.l.slug}`)
      ).text();
      assert.ok(html.includes('rel="canonical"'));
      assert.ok(html.includes('noindex'));
      assert.equal(/"offers":/.test(html), false);
      assert.equal(errors.length, 0);
    });
    await test('Runtime publication resolves without rebuilding, routes reject collisions and sitemap reflects published records', async () => {
      const added = await makeProduct(
        'storefront_runtime',
        type('catalog_retail'),
        [sku('SF-RUNTIME')],
        [{ attributeId: power.id, number: '1' }],
      );
      const response = await page.goto(`${site}/products/${added.l.slug}`);
      assert.equal(response.status(), 200);
      await page
        .getByRole('heading', { name: 'storefront runtime', exact: true })
        .waitFor();
      const map = await (await fetch(site + '/sitemap.xml')).text();
      assert.ok(map.includes('/products/' + added.l.slug));
      const route = await publicGet('routes/' + added.l.slug);
      assert.equal(route.kind, 'product');
      const prefix = `${store}/listings/${added.l.listingId}/revisions`,
        draft = await call(`${prefix}/${added.l.id}/clone`, {
          body: { revision: added.l.revision },
        });
      const payload = {
        revision: draft.revision,
        title: draft.title,
        slug: keyCategory.slug,
        productRevisionId: draft.productRevisionId,
        categoryIds: draft.categories.map((c) => c.categoryId),
        skuRevisionIds: draft.skus.map((s) => s.skuRevisionId),
      };
      const collision = await fetch(
        base + '/api/admin/' + `${prefix}/${draft.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
          },
          body: JSON.stringify(payload),
        },
      );
      // The actual authenticated helper below exercises the collision. A public
      // request cannot gain mutation authority by selecting a catalog route.
      assert.equal(collision.status, 401);
      await assert.rejects(
        () => call(`${prefix}/${draft.id}`, { method: 'PATCH', body: payload }),
        /409/,
      );
      let updated = await call(`${prefix}/${draft.id}`, {
        method: 'PATCH',
        body: { ...payload, slug: 'storefront-runtime-renamed' },
      });
      await publicGet('routes/storefront-runtime-renamed', 404);
      for (const action of ['review', 'approve', 'publish'])
        updated = await call(`${prefix}/${draft.id}/actions/${action}`, {
          body: {
            revision: updated.revision,
            rootRevision: updated.rootRevision,
          },
        });
      assert.equal((await publicGet('routes/' + added.l.slug)).redirect, true);
      const alias = await fetch(`${site}/products/${added.l.slug}`, {
        redirect: 'manual',
      });
      assert.equal(alias.status, 308);
      await call(`${prefix}/${draft.id}/actions/archive`, {
        body: {
          revision: updated.revision,
          rootRevision: updated.rootRevision,
        },
      });
      await publicGet('products/storefront-runtime-renamed', 404);
      const after = await (await fetch(site + '/sitemap.xml')).text();
      assert.equal(
        after.includes('/products/storefront-runtime-renamed'),
        false,
      );
    });
    await test('Unavailable dynamic backend shows no static price or stock fallback', async () => {
      await db.store.update({
        where: { id: ids.storeId },
        data: { active: false },
      });
      try {
        await page.goto(`${site}/products`);
        await page
          .getByRole('heading', { name: 'Catalog unavailable', exact: true })
          .waitFor();
        assert.equal(await page.locator('.product-card').count(), 0);
        assert.equal(
          (await page.locator('main').textContent()).includes('317,000'),
          false,
        );
      } finally {
        await db.store.update({
          where: { id: ids.storeId },
          data: { active: true },
        });
      }
    });
  } catch (error) {
    if (page) {
      await page
        .screenshot({
          path: path.join(parent, 'last-failure.png'),
          fullPage: true,
        })
        .catch(() => {});
      console.error(
        'Public browser diagnostic:',
        error.message?.slice(0, 600),
        'runtime:',
        runtimeLog.slice(-3000),
        'headings:',
        await page
          .locator('h1')
          .allTextContents()
          .catch(() => []),
      );
    }
    throw error;
  } finally {
    await browser?.close();
    if (server && server.exitCode === null) {
      const done = once(server, 'exit');
      server.kill();
      await done;
    }
    await fs.unlink(path.join(fixture, 'node_modules')).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
    if (path.dirname(fixture) !== parent)
      throw Error('Unsafe storefront cleanup');
    await fs.rm(fixture, { recursive: true, force: true });
  }
}
