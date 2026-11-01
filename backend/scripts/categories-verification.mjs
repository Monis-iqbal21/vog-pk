import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

export async function verifyCategories({
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
  await test('Milestone 3 SQL preserves populated Milestone 2 records on upgrade', async () => {
    const destination = new URL(process.env.DATABASE_URL),
      name = `category_upgrade_${randomBytes(6).toString('hex')}_test`;
    const control = new Client({ connectionString: destination.href });
    await control.connect();
    try {
      await control.query(`CREATE DATABASE "${name}"`);
    } finally {
      await control.end();
    }
    destination.pathname = '/' + name;
    const upgrade = new Client({ connectionString: destination.href });
    await upgrade.connect();
    try {
      const directories = (
        await fs.readdir('prisma/migrations', { withFileTypes: true })
      )
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      for (const dir of directories.filter(
        (d) => d !== '202611010003_categories_filters',
      ))
        await upgrade.query(
          await fs.readFile(`prisma/migrations/${dir}/migration.sql`, 'utf8'),
        );
      const tenant = randomUUID(),
        store = randomUUID(),
        type = randomUUID();
      await upgrade.query(
        'INSERT INTO "Tenant" (id,slug,name) VALUES ($1,$2,$3)',
        [tenant, 'preserved', 'Preserved'],
      );
      await upgrade.query(
        'INSERT INTO "Store" (id,"tenantId",slug,name) VALUES ($1,$2,$3,$4)',
        [store, tenant, 'preserved', 'Preserved'],
      );
      await upgrade.query(
        'INSERT INTO "ProductType" (id,"tenantId",code,label) VALUES ($1,$2,$3,$4)',
        [type, tenant, 'preserved', 'Preserved'],
      );
      const before = (
        await upgrade.query('SELECT * FROM "ProductType" WHERE id=$1', [type])
      ).rows;
      await upgrade.query('BEGIN');
      await upgrade.query(
        await fs.readFile(
          'prisma/migrations/202611010003_categories_filters/migration.sql',
          'utf8',
        ),
      );
      await upgrade.query('COMMIT');
      assert.deepEqual(
        (await upgrade.query('SELECT * FROM "ProductType" WHERE id=$1', [type]))
          .rows,
        before,
      );
      assert.equal(
        (
          await upgrade.query('SELECT currency FROM "Store" WHERE id=$1', [
            store,
          ])
        ).rows[0].currency,
        'PKR',
      );
    } finally {
      await upgrade.end();
    }
  });
  const api = async (
    route,
    { method = 'GET', body, session = token, storeId = ids.storeId } = {},
  ) => {
    const r = await fetch(`${base}/api/admin/stores/${storeId}/${route}`, {
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
      `${r.status}: ${r.data.message ?? 'unexpected response'}`,
    );
    return r.data;
  };
  const input = (code, extra = {}) => ({
    code,
    name: code,
    slug: code.replaceAll('_', '-'),
    description: '',
    ...extra,
  });
  const category = async (code, extra = {}) =>
    ok(await api('categories', { method: 'POST', body: input(code, extra) }));
  const catAction = async (c, name) =>
    ok(
      await api(`categories/${c.id}/actions/${name}`, {
        method: 'POST',
        body: { revision: c.revision },
      }),
    );
  const publish = async (c) =>
    catAction(
      await catAction(await catAction(c, 'review'), 'approve'),
      'activate',
    );
  const historyPath = (c, s) =>
    `categories/${c.id}/filter-sets${s ? `/${s.id}` : ''}`;
  const setAction = async (c, s, name, extra = {}) =>
    ok(
      await api(`${historyPath(c, s)}/actions/${name}`, {
        method: 'POST',
        body: { revision: s.revision, ...extra },
      }),
    );
  const approve = async (c, s) =>
    setAction(c, await setAction(c, s, 'review'), 'approve');
  const save = async (c, s, body) =>
    ok(
      await api(historyPath(c, s), {
        method: 'PATCH',
        body: {
          revision: s.revision,
          includeDescendants: true,
          typeVersionIds: [],
          filters: [],
          ...body,
        },
      }),
      200,
    );
  const filter = (code, source = 'PRICE', extra = {}) => ({
    code,
    label: code,
    description: '',
    source,
    level: source === 'BRAND' ? 'PRODUCT' : 'SKU',
    control: source === 'PRICE' ? 'number_range' : 'checkbox_group',
    operators: source === 'PRICE' ? ['gte', 'lte'] : ['in'],
    displayUnit: source === 'PRICE' ? 'PKR' : null,
    ...extra,
  });
  const other = await db.store.create({
    data: { tenantId: ids.tenantId, slug: 'other', name: 'Other store' },
  });
  const foreign = await db.store.create({
    data: { tenantId: tenantB.id, slug: 'foreign', name: 'Foreign store' },
  });
  let root, child, leaf;
  await test('Category creation, metadata, bounded pagination and cross-store references', async () => {
    root = await category('electronics');
    child = await category('accessories', {
      parentId: root.id,
      seo: { title: 'Accessories', description: 'Metadata' },
      media: {
        imagePath: '/images/test.webp',
        bannerPath: null,
        alt: 'Sample',
      },
    });
    leaf = await category('keyboards', { parentId: child.id });
    assert.equal((await api('categories?pageSize=1')).data.items.length, 1);
    assert.equal(
      (await api('categories/tree?maxDepth=2')).data.truncated,
      true,
    );
    assert.equal((await api('categories?pageSize=100')).status, 400);
    assert.equal((await api('categories', { storeId: other.id })).status, 403);
    assert.equal(
      (await api('categories', { storeId: foreign.id })).status,
      403,
    );
    assert.equal((await api('categories', { session: bToken })).status, 403);
    const foreignCategory = await db.category.create({
      data: {
        tenantId: tenantB.id,
        storeId: foreign.id,
        code: 'foreign',
        name: 'Foreign',
        slug: 'foreign',
        description: '',
        media: {},
        seo: {},
        createdBy: member.id,
        updatedBy: member.id,
      },
    });
    assert.equal(
      (
        await api('categories', {
          method: 'POST',
          body: input('bad_parent', { parentId: foreignCategory.id }),
        })
      ).status,
      400,
    );
    await assert.rejects(() =>
      db.category.update({
        where: { id: root.id },
        data: { parentId: foreignCategory.id },
      }),
    );
  });
  await test('Shared product/category URL reservations and immutable legacy route ownership', async () => {
    await db.catalogRoute.create({
      data: {
        ...ids,
        slug: 'reserved-product',
        ownerKind: 'LEGACY_PRODUCT',
        legacyKey: 'legacy-product',
      },
    });
    assert.equal(
      (
        await api('categories', {
          method: 'POST',
          body: input('reserved', { slug: 'reserved-product' }),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await api('categories', {
          method: 'POST',
          body: input('duplicate', { slug: root.slug }),
        })
      ).status,
      409,
    );
    const route = await db.catalogRoute.findFirstOrThrow({
      where: { storeId: ids.storeId, slug: root.slug },
    });
    await assert.rejects(() =>
      db.catalogRoute.delete({ where: { id: route.id } }),
    );
    await assert.rejects(() =>
      db.catalogRoute.update({
        where: { id: route.id },
        data: { categoryId: child.id },
      }),
    );
  });
  await test('Hierarchy cycles, concurrent moves, subtree bounds and archive dependencies', async () => {
    assert.equal(
      (
        await api(`categories/${root.id}/move`, {
          method: 'POST',
          body: { revision: root.revision, parentId: leaf.id, sortOrder: 0 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(`categories/${root.id}/actions/archive`, {
          method: 'POST',
          body: { revision: root.revision },
        })
      ).status,
      409,
    );
    const a = await category('cycle_a'),
      b = await category('cycle_b');
    const results = await Promise.all(
      [
        [a, b],
        [b, a],
      ].map(([c, p]) =>
        api(`categories/${c.id}/move`, {
          method: 'POST',
          body: { revision: c.revision, parentId: p.id, sortOrder: 2 },
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
    let parent = null;
    for (let i = 1; i <= 32; i++)
      parent = await category(`depth_${i}`, { parentId: parent?.id ?? null });
    assert.equal(
      (
        await api('categories', {
          method: 'POST',
          body: input('depth_33', { parentId: parent.id }),
        })
      ).status,
      400,
    );
    await assert.rejects(() =>
      db.category.update({
        where: { id: root.id },
        data: { parentId: leaf.id },
      }),
    );
  });
  await test('Published hierarchy snapshots survive draft edits and stale writes are rejected', async () => {
    root = await publish(root);
    child = await publish(child);
    leaf = await publish(leaf);
    const body = {
      revision: child.revision,
      name: 'Draft accessories',
      slug: 'draft-accessories',
      description: '',
      media: child.media,
      seo: child.seo,
      visible: true,
      inNavigation: false,
      compatibility: 'ANY',
      productTypeIds: [],
    };
    child = ok(
      await api(`categories/${child.id}`, { method: 'PATCH', body }),
      200,
    );
    assert.equal(child.status, 'DRAFT');
    const published = ok(
      await api('categories/tree?view=active&maxDepth=32'),
      200,
    );
    assert.equal(
      published.nodes.find((n) => n.id === child.id).name,
      'accessories',
    );
    assert.equal(
      (await api(`categories/${child.id}`, { method: 'PATCH', body })).status,
      409,
    );
    child = await publish(child);
    assert.ok(
      await db.catalogRoute.findFirst({
        where: {
          storeId: ids.storeId,
          slug: 'accessories',
          categoryId: child.id,
        },
      }),
    );
  });
  const color = await create('option-sets', {
    code: 'category_color',
    label: 'Category color',
    values: [
      { code: 'black', label: 'Black' },
      { code: 'white', label: 'White' },
    ],
  });
  const attr = await create(
    'attributes',
    attribute('category_color', 'SINGLE_SELECT', {
      optionSetId: color.id,
      allowedScopes: ['SKU'],
      axisEligible: true,
    }),
  );
  const numeric = await create(
    'attributes',
    attribute('category_frequency', 'NUMBER', {
      canonicalUnit: 'Hz',
      rules: { min: '0', max: '8000' },
    }),
  );
  const bool = await create(
    'attributes',
    attribute('category_wireless', 'BOOLEAN'),
  );
  const privateAttr = await create(
    'attributes',
    attribute('category_private', 'TEXT', {
      visibility: { admin: true, storefront: false },
    }),
  );
  const t1 = await makeType('category_keyboard', 'Category keyboard', [
    attr,
    numeric,
    bool,
    privateAttr,
  ]);
  const t2 = await makeType('category_shirt', 'Category shirt', [attr]);
  for (const t of [t1, t2])
    t.version = await action(
      await action(t.version, t.type, 'review'),
      t.type,
      'approve',
    );
  const versions = [t1.version.id, t2.version.id];
  let config, active;
  const colorFilter = filter('color', 'ATTRIBUTE', {
    attributeId: attr.id,
    level: 'SKU',
    allowedValues: ['black', 'white'],
  });
  const price = filter('price');
  const draftBody = {
    typeVersionIds: versions,
    filters: [colorFilter, price, filter('availability', 'AVAILABILITY')],
  };
  await test('Multiple compatible Product Types and shared SKU attribute filter compilation', async () => {
    const c = await category('mixed', {
      compatibility: 'ALLOW_LIST',
      productTypeIds: [t1.type.id, t2.type.id],
    });
    assert.equal(c.allowedTypes.length, 2);
    config = ok(await api(historyPath(root), { method: 'POST', body: {} }));
    config = await save(root, config, draftBody);
    assert.equal(
      config.filters.find((f) => f.attributeId === attr.id).snapshot.bindings
        .length,
      2,
    );
    const eligible = ok(await api('filter-schemas?pageSize=25'), 200);
    assert.ok(
      !eligible.items
        .flatMap((s) => s.attributes)
        .some((a) => a.attributeId === privateAttr.id),
    );
  });
  await test('Invalid operators, numeric units/ranges, private and foreign schema references fail closed', async () => {
    const n = filter('frequency', 'ATTRIBUTE', {
      attributeId: numeric.id,
      level: 'PRODUCT',
      control: 'number_range',
      operators: ['gte', 'lte'],
      displayUnit: 'kHz',
      typeVersionIds: [t1.version.id],
    });
    for (const f of [
      { ...colorFilter, control: 'number_range', operators: ['gte', 'lte'] },
      { ...price, operators: ['eq'] },
      { ...price, displayUnit: 'USD' },
      { ...price, min: '10', max: '1' },
      { ...n, displayUnit: 'kg' },
      { ...n, min: '0', max: '9' },
      filter('private', 'ATTRIBUTE', {
        attributeId: privateAttr.id,
        level: 'PRODUCT',
        allowedValues: ['x'],
      }),
      { ...colorFilter, typeVersionIds: [randomUUID()] },
    ])
      assert.equal(
        (
          await api(historyPath(root, config), {
            method: 'PATCH',
            body: {
              revision: config.revision,
              includeDescendants: true,
              typeVersionIds: versions,
              filters: [f],
            },
          })
        ).status,
        400,
      );
    const foreignVersion = await db.productTypeVersion.findFirst({
      where: { tenantId: tenantB.id },
    });
    assert.equal(
      (
        await api(historyPath(root, config), {
          method: 'PATCH',
          body: {
            revision: config.revision,
            includeDescendants: true,
            typeVersionIds: [foreignVersion?.id ?? randomUUID()],
            filters: [price],
          },
        })
      ).status,
      400,
    );
    config = await save(root, config, {
      typeVersionIds: [t1.version.id],
      filters: [n],
    });
    assert.equal(config.filters[0].snapshot.max, '8');
    config = await save(root, config, draftBody);
  });
  await test('Immutable active filters, independent drafts, published aliases and optimistic activation', async () => {
    config = await approve(root, config);
    let impact = ok(await api(`${historyPath(root, config)}/impact`), 200);
    active = await setAction(root, config, 'activate', {
      categoryRevision: impact.filterRevision,
    });
    assert.equal(
      (
        await api(historyPath(root, active), {
          method: 'PATCH',
          body: {
            revision: active.revision,
            includeDescendants: true,
            ...draftBody,
          },
        })
      ).status,
      409,
    );
    await assert.rejects(() =>
      db.categoryFilter.update({
        where: { id: active.filters[0].id },
        data: { label: 'Tamper' },
      }),
    );
    await assert.rejects(() =>
      db.categoryFilterSet.update({
        where: { id: active.id },
        data: { includeDescendants: false },
      }),
    );
    let draft = ok(
      await api(`${historyPath(root, active)}/clone`, {
        method: 'POST',
        body: { revision: active.revision },
      }),
    );
    const saved = (
      await import('../dist/categories/filters.service.js')
    ).CategoryFiltersService.prototype.definition.call({}, draft);
    const savedColor = saved.filters.find((f) => f.attributeId === attr.id);
    savedColor.code = 'finish';
    savedColor.aliases = ['color', 'new_finish'];
    draft = await save(root, draft, saved);
    assert.equal(
      (
        await api(`categories/${root.id}/active-filters`)
      ).data.active.filters.find((f) => f.attributeId === attr.id).code,
      'color',
    );
    const unpublished = await db.categoryFilterRoute.findFirst({
      where: { categoryId: root.id, code: 'new_finish' },
    });
    assert.equal(unpublished.published, false);
    draft = await approve(root, draft);
    let rival = ok(
      await api(`${historyPath(root, active)}/clone`, {
        method: 'POST',
        body: { revision: active.revision },
      }),
    );
    rival = await approve(root, rival);
    impact = ok(await api(`${historyPath(root, draft)}/impact`), 200);
    const result = await Promise.all(
      [draft, rival].map((s) =>
        api(`${historyPath(root, s)}/actions/activate`, {
          method: 'POST',
          body: {
            revision: s.revision,
            categoryRevision: impact.filterRevision,
          },
        }),
      ),
    );
    assert.deepEqual(result.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      await db.categoryFilterSet.count({
        where: { categoryId: root.id, status: 'ACTIVE' },
      }),
      1,
    );
    active = result.find((r) => r.status === 201).data;
    assert.equal(
      (
        await api(`${historyPath(root, active)}/preview`, {
          method: 'POST',
          body: { fixture: 'fashion', query: { color: ['black'] } },
        })
      ).status,
      201,
    );
    await assert.rejects(() =>
      db.categoryFilterKey.update({
        where: { id: active.filters[0].keyId },
        data: { semanticHash: 'tamper' },
      }),
    );
    await assert.rejects(() =>
      db.category.update({
        where: { id: root.id },
        data: { activeFilterSetId: null },
      }),
    );
  });
  await test('Synthetic preview supports multiple industries, descendants, mixed types and canonical URLs', async () => {
    for (const fixture of ['hardware', 'fashion', 'vehicles']) {
      const r = ok(
        await api(`${historyPath(root, active)}/preview`, {
          method: 'POST',
          body: {
            fixture,
            query: {
              color: ['white', 'black'],
              price: ['0..200'],
              availability: ['in_stock'],
            },
          },
        }),
      );
      assert.equal(r.mode, 'SYNTHETIC_ONLY');
      assert.equal(r.facetCounts, 'NOT_IMPLEMENTED');
      assert.equal(r.plan.skuPredicate.quantifier, 'EXISTS_SAME_SKU');
      assert.ok(r.plan.category.ids.includes(leaf.id));
      assert.equal(r.matchedIds.length, 2);
    }
    assert.equal(
      (
        await api(`${historyPath(root, active)}/preview`, {
          method: 'POST',
          body: { query: { unknown: ['x'] } },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await api(`${historyPath(root, active)}/preview`, {
          method: 'POST',
          body: { query: { price: ['-1..200'] } },
        })
      ).status,
      400,
    );
  });
  await test('Custom store roles restrict category/filter creation, approvals, tenant edits and store reassignment', async () => {
    const user = await db.adminUser.create({
      data: {
        email: 'category-reader@example.invalid',
        name: 'Category reader',
        passwordHash: owner.passwordHash,
      },
    });
    await db.tenantMembership.create({
      data: { tenantId: ids.tenantId, userId: user.id },
    });
    await db.storeMembership.create({ data: { ...ids, userId: user.id } });
    const role = await db.scopedRole.create({
      data: {
        ...ids,
        scopeKind: 'STORE',
        code: 'CATEGORY_READER',
        name: 'Category reader',
      },
    });
    for (const code of ['categories.view', 'category-filters.view']) {
      const permission = await db.permission.findUniqueOrThrow({
        where: { code },
      });
      await db.scopedRolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          scopeKind: 'STORE',
          canDelegate: false,
        },
      });
    }
    await db.storeRoleAssignment.create({
      data: { ...ids, userId: user.id, roleId: role.id },
    });
    const session = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(session),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal((await api('categories', { session })).status, 200);
    assert.equal((await api('filter-schemas', { session })).status, 200);
    assert.equal(
      (
        await api('categories', {
          session,
          method: 'POST',
          body: input('denied'),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api(`categories/${leaf.id}/actions/approve`, {
          session,
          method: 'POST',
          body: { revision: leaf.revision },
        })
      ).status,
      403,
    );
    assert.equal(
      (await api(historyPath(root), { session, method: 'POST', body: {} }))
        .status,
      403,
    );
    assert.equal(
      (await api('categories', { session, storeId: other.id })).status,
      403,
    );
    assert.equal(
      (
        await call('attributes', {
          session,
          method: 'POST',
          body: attribute('denied_category'),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await api('categories', {
          method: 'POST',
          body: input('reassign', { storeId: other.id }),
        })
      ).status,
      400,
    );
  });
  await test('Archived/private dependencies invalidate public contracts; archive preserves identities and history', async () => {
    for (const data of [
      { status: 'ARCHIVED' },
      { status: 'ACTIVE', visibility: { admin: true, storefront: false } },
    ]) {
      await db.attributeDefinition.update({ where: { id: attr.id }, data });
      const contract = ok(
        await api(`categories/${root.id}/active-filters`),
        200,
      );
      assert.equal(contract.publicContract, null);
      assert.ok(contract.warnings.length > 0);
      const impact = ok(await api(`${historyPath(root, active)}/impact`), 200);
      assert.ok(impact.blockingReasons.length > 0);
    }
    await db.attributeDefinition.update({
      where: { id: attr.id },
      data: { visibility: { admin: true, storefront: true } },
    });
    assert.ok(
      (await api(`categories/${root.id}/active-filters`)).data.publicContract,
    );
    const archived = await category('archive_leaf');
    const result = await catAction(archived, 'archive');
    assert.equal(result.status, 'ARCHIVED');
    assert.ok(
      await db.catalogRoute.findFirst({ where: { categoryId: archived.id } }),
    );
    assert.equal(
      (
        await api(`categories/${root.id}/actions/archive`, {
          method: 'POST',
          body: { revision: root.revision },
        })
      ).status,
      409,
    );
    const incompatible = await category('restricted', {
      compatibility: 'ALLOW_LIST',
      productTypeIds: [t1.type.id],
    });
    const candidate = ok(
      await api(historyPath(incompatible), { method: 'POST', body: {} }),
    );
    assert.equal(
      (
        await api(historyPath(incompatible, candidate), {
          method: 'PATCH',
          body: { revision: 1, includeDescendants: true, ...draftBody },
        })
      ).status,
      400,
    );
  });
  await test('Category/filter events remain store-audited and static 12-category/84-product URLs are unchanged', async () => {
    const events = await db.auditLog.findMany({
      where: { action: { startsWith: 'category.' } },
    });
    assert.ok(events.length > 20);
    assert.ok(
      events.every((e) => e.scopeKind === 'STORE' && e.storeId === ids.storeId),
    );
    for (const name of ['products.js', 'catalogue-products.js']) {
      const file = `frontend/src/data/${name}`;
      assert.equal(
        (await fs.readFile(`../${file}`, 'utf8')).replaceAll('\r\n', '\n'),
        execFileSync('git', ['show', `c25d111:${file}`], {
          encoding: 'utf8',
          cwd: '..',
        }).replaceAll('\r\n', '\n'),
      );
    }
    const data = await import('../../frontend/src/data/products.js');
    assert.equal(data.productCategories.length, 12);
    assert.equal(data.products.length, 84);
    const { legacyRouteManifest, reserveLegacyRoutes } =
      await import('./reserve-legacy-routes.mjs');
    const manifest = legacyRouteManifest(data);
    assert.equal(manifest.length, 96);
    assert.equal(
      (
        await reserveLegacyRoutes(
          db,
          { tenantId: ids.tenantId, storeId: other.id },
          manifest,
        )
      ).reserved,
      96,
    );
    await reserveLegacyRoutes(
      db,
      { tenantId: ids.tenantId, storeId: other.id },
      manifest,
    );
    assert.equal(
      await db.catalogRoute.count({ where: { storeId: other.id } }),
      96,
    );
  });
  return {
    browser: async ({ page, base, cookie }) => {
      await page.goto(base + '/categories');
      await page
        .getByRole('heading', { name: 'Categories & Filters' })
        .waitFor();
      await page
        .getByRole('button', { name: 'Add category', exact: true })
        .click();
      await page
        .getByLabel('Category code', { exact: true })
        .fill('browser_category');
      await page
        .getByLabel('Category name', { exact: true })
        .fill('Browser category');
      await page
        .getByLabel('Category slug', { exact: true })
        .fill('browser-category');
      await page.getByLabel('SEO title', { exact: true }).fill('Browser SEO');
      await page
        .getByRole('button', { name: 'Save category', exact: true })
        .click();
      await page
        .getByText('Status: DRAFT · Revision 1', { exact: true })
        .waitFor();
      await page
        .getByLabel('Parent category', { exact: true })
        .selectOption(root.id);
      await page.getByLabel('Display order', { exact: true }).fill('4');
      await page
        .getByRole('button', { name: 'Save hierarchy and order', exact: true })
        .click();
      await page
        .getByText('Status: DRAFT · Revision 2', { exact: true })
        .waitFor();
      for (const action of ['Review', 'Approve', 'Activate']) {
        await page
          .getByRole('button', { name: `${action} category`, exact: true })
          .click();
        await page
          .getByText(
            `Status: ${action === 'Review' ? 'REVIEW' : action === 'Approve' ? 'APPROVED' : 'ACTIVE'} · Revision ${action === 'Review' ? 3 : action === 'Approve' ? 4 : 5}`,
            { exact: true },
          )
          .waitFor();
      }
      await page
        .getByRole('button', { name: 'Create filter draft', exact: true })
        .click();
      await page
        .getByText('Version 1 · DRAFT · Revision 1', { exact: true })
        .waitFor();
      await page
        .getByRole('button', { name: 'Add filter', exact: true })
        .click();
      await page
        .getByRole('group', {
          name: 'Approved Product Type versions',
          exact: true,
        })
        .getByLabel('Category keyboard · v1', { exact: true })
        .check();
      await page
        .getByLabel('Add filter source', { exact: true })
        .selectOption(`${attr.id}:SKU`);
      await page
        .getByRole('button', { name: 'Add filter', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Save filter draft', exact: true })
        .click();
      await page
        .getByText('Version 1 · DRAFT · Revision 2', { exact: true })
        .waitFor();
      await page
        .getByLabel('Preview Approved selling price (min..max)', {
          exact: true,
        })
        .fill('0..200');
      await page
        .getByRole('button', { name: 'Run fixture preview', exact: true })
        .click();
      await page.getByText('Matched fixtures:', { exact: false }).waitFor();
      for (const [action, state, revision] of [
        ['Review', 'REVIEW', 3],
        ['Approve', 'APPROVED', 4],
      ]) {
        await page
          .getByRole('button', { name: `${action} filters`, exact: true })
          .click();
        await page
          .getByText(`Version 1 · ${state} · Revision ${revision}`, {
            exact: true,
          })
          .waitFor();
      }
      await page
        .getByRole('button', {
          name: 'Validate and compare filters',
          exact: true,
        })
        .click();
      await page
        .getByRole('heading', { name: 'Validation and differences' })
        .waitFor();
      await page
        .getByRole('button', { name: 'Activate filters', exact: true })
        .click();
      await page
        .getByText('Version 1 · ACTIVE · Revision 5', { exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Save filter draft', exact: true })
          .isDisabled(),
        true,
      );
      await page
        .getByRole('button', { name: 'Clone as filter draft', exact: true })
        .click();
      await page
        .getByText('Version 2 · DRAFT · Revision 1', { exact: true })
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
      assert.equal(
        (
          await fetch(`${base}/api/admin/stores/${ids.storeId}/categories`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
        403,
      );
      for (const route of [
        `stores/${ids.storeId}/categories/${root.id}/delete`,
        `stores/${ids.storeId}/secrets`,
        `stores/${ids.storeId}/categories/${root.id}/filter-sets/${active.id}/sql`,
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
        'PASS Real category/filter forms, lifecycle, fixture preview, cloning, responsive layouts and BFF restrictions',
      );
    },
  };
}
