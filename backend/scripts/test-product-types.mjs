import EmbeddedPostgres from 'embedded-postgres';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { verifyAdmin } from './foundation-admin-regression.mjs';

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
const runId = randomBytes(8).toString('hex'),
  port = await freePort(),
  apiPort = await freePort(),
  parent = path.resolve('.local/product-types'),
  directory = path.join(parent, runId);
const password = randomBytes(32).toString('hex'),
  url = `postgresql://schema_test:${password}@127.0.0.1:${port}/schema_${runId}_test`;
Object.assign(process.env, {
  DATABASE_URL: url,
  TEST_DATABASE_URL: url,
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  BFF_SHARED_SECRET: randomBytes(64).toString('hex'),
  ADMIN_ORIGIN: 'http://localhost:3001',
  STOREFRONT_ORIGIN: 'http://localhost:3000',
});
if(process.env.VOG_TEST_OPERATIONS==='1'){process.env.MEDIA_LOCAL_ROOT=path.resolve('.local/operations',`media-${runId}`);process.env.MEDIA_STORAGE_PROVIDER='local-development';}
const cluster = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'schema_test',
  password,
  port,
  persistent: false,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
let db,
  server,
  phase = 'startup',
  checks = 0,
  report;
const tests = [];
const test = async (name, run) => {
  phase = name;
  await run();
  checks++;
  tests.push(name);
  console.log('PASS ' + name);
};
try {
  await cluster.initialise();
  await cluster.start();
  const c = cluster.getPgClient();
  await c.connect();
  await c.query(`CREATE DATABASE "schema_${runId}_test"`);
  await c.end();
  const migrate = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, stdio: 'pipe', encoding: 'utf8' },
  );
  if (migrate.status !== 0) throw Error('Disposable migration failed.');
  const { createDatabase } = await import('../dist/security/database.js');
  const { seedSecurity, bootstrapOwner } =
    await import('../dist/security/provision.js');
  const { initializeDevelopmentFoundation } =
    await import('../dist/security/development-foundation.js');
  const { hashToken } = await import('../dist/security/auth.service.js');
  const { SCOPED_PERMISSIONS } =
    await import('../dist/security/scoped-permissions.js');
  db = createDatabase(url);
  await seedSecurity(db);
  const ownerPassword = `Schema!9${randomBytes(20).toString('hex')}`;
  await bootstrapOwner(db, {
    name: 'Schema Owner',
    email: 'schema-owner@example.invalid',
    password: ownerPassword,
  });
  const owner = await db.adminUser.findUniqueOrThrow({
      where: { email: 'schema-owner@example.invalid' },
    }),
    ids = await initializeDevelopmentFoundation(db, url, 'test');
  if(process.env.VOG_TEST_STOREFRONT==='1')Object.assign(process.env,{PUBLIC_CATALOG_MODE:'development',PUBLIC_CATALOG_STORE_ID:ids.storeId,PUBLIC_MEDIA_DEVELOPMENT:'1'});
  const token = randomBytes(32).toString('hex');
  await db.adminSession.create({
    data: {
      userId: owner.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const tenantB = await db.tenant.create({
    data: { slug: 'schema_b', name: 'Tenant B' },
  });
  const member = await db.adminUser.create({
    data: {
      name: 'Tenant B Admin',
      email: 'tenant-b@example.invalid',
      passwordHash: owner.passwordHash,
    },
  });
  await db.tenantMembership.create({
    data: { tenantId: tenantB.id, userId: member.id },
  });
  const role = await db.scopedRole.create({
    data: {
      scopeKind: 'TENANT',
      tenantId: tenantB.id,
      code: 'SCHEMA_CONFIG',
      name: 'Schema configuration',
    },
  });
  const codes = Object.entries(SCOPED_PERMISSIONS)
    .filter(
      ([code, scopes]) =>
        scopes.includes('TENANT') &&
        /^(attributes|option-sets|product-types)\./.test(code),
    )
    .map(([code]) => code);
  const capabilities = await db.permission.findMany({
    where: { code: { in: codes } },
  });
  await db.scopedRolePermission.createMany({
    data: capabilities.map((p) => ({
      roleId: role.id,
      permissionId: p.id,
      scopeKind: 'TENANT',
      canDelegate: false,
    })),
  });
  await db.tenantRoleAssignment.create({
    data: { tenantId: tenantB.id, userId: member.id, roleId: role.id },
  });
  const bToken = randomBytes(32).toString('hex');
  await db.adminSession.create({
    data: {
      userId: member.id,
      tokenHash: hashToken(bToken),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  server = spawn(process.execPath, ['dist/main.js'], {
    env: process.env,
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${apiPort}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).status === 200) break;
    } catch {}
    if (i === 99) throw Error('API startup timeout');
    await new Promise((r) => setTimeout(r, 100));
  }
  const call = async (
    route,
    { body, method = 'GET', session = token, tenantId = ids.tenantId } = {},
  ) => {
    const r = await fetch(
      `${base}/api/admin/scopes/tenants/${tenantId}/schema/${route}`,
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
  const create = async (resource, body, options = {}) => {
    const r = await call(resource, { method: 'POST', body, ...options });
    assert.equal(r.status, 201, `${resource} create`);
    return r.data;
  };
  const attribute = (code, dataType = 'TEXT', extra = {}) => ({
    code,
    label: code.replaceAll('_', ' '),
    description: '',
    dataType,
    canonicalUnit: dataType === 'NUMBER' ? 'one' : null,
    optionSetId: null,
    widget: {
      TEXT: 'text',
      NUMBER: 'number',
      BOOLEAN: 'checkbox',
      SINGLE_SELECT: 'select',
      MULTI_SELECT: 'multiselect',
    }[dataType],
    allowedScopes: ['PRODUCT', 'SKU'],
    axisEligible: false,
    visibility: { admin: true, storefront: true },
    rules: {},
    ...extra,
  });
  await test('All reviewed additive Prisma migrations apply to a fresh isolated database', async () => {
    assert.equal(
      (
        await db.$queryRaw`SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`
      )[0].n,
      (await fs.readdir('prisma/migrations', {withFileTypes:true})).filter((e)=>e.isDirectory()).length,
    );
  });
  const colors = await create('option-sets', {
    code: 'color',
    label: 'Color',
    values: [
      { code: 'black', label: 'Black', swatch: '#000000' },
      { code: 'white', label: 'White', swatch: '#ffffff' },
      { code: 'blue', label: 'Blue', swatch: '#0055ff' },
    ],
  });
  const color = await create(
    'attributes',
    attribute('color', 'SINGLE_SELECT', {
      optionSetId: colors.id,
      widget: 'swatch',
      axisEligible: true,
    }),
  );
  const layout = await create('attributes', attribute('layout'));
  await assert.rejects(()=>db.$executeRaw`UPDATE "AttributeDefinition" SET "allowedScopes"=NULL WHERE id=${layout.id}::uuid`);
  await assert.rejects(()=>db.$executeRaw`UPDATE "AttributeDefinition" SET "allowedScopes"=ARRAY['PRODUCT','PRODUCT']::"AttributeLevel"[] WHERE id=${layout.id}::uuid`);
  const polling = await create(
    'attributes',
    attribute('polling_rate', 'NUMBER', {
      canonicalUnit: 'Hz',
      rules: { min: '125', max: '8000', step: '125' },
    }),
  );
  const boolean = await create('attributes', attribute('wireless', 'BOOLEAN'));
  const connections = await create('option-sets', {
    code: 'connectivity',
    label: 'Connectivity',
    values: [
      { code: 'usb', label: 'USB' },
      { code: 'rf', label: 'RF' },
      { code: 'bluetooth', label: 'Bluetooth' },
    ],
  });
  const multi = await create(
    'attributes',
    attribute('connectivity', 'MULTI_SELECT', {
      optionSetId: connections.id,
      widget: 'checkboxes',
      rules: { minItems: 1, maxItems: 3 },
    }),
  );
  await test('Attributes are reusable; duplicate tenant codes reject while another tenant can reuse the code', async () => {
    assert.equal(
      (await call('attributes', { method: 'POST', body: attribute('color') }))
        .status,
      409,
    );
    await create('attributes', attribute('color'), {
      tenantId: tenantB.id,
      session: bToken,
    });
    const rows = (await call('attributes?search=color&pageSize=1')).data;
    assert.equal(rows.total, 1);
    assert.equal(rows.items.length, 1);
    assert.equal(rows.items[0].id, color.id);
  });
  await test('Invalid types, executable metadata, malformed swatches, units and ranges reject', async () => {
    const invalid = [
      attribute('bad', 'CODE'),
      attribute('bad', 'NUMBER', { canonicalUnit: 'eval()' }),
      attribute('bad', 'NUMBER', { rules: { min: '10', max: '1' } }),
      attribute('bad', 'NUMBER', { rules: { step: '0' } }),
      attribute('bad', 'NUMBER', {
        rules: { min: '0', max: '2', allowedValues: ['3'] },
      }),
      attribute('bad', 'TEXT', { widget: 'remote-template' }),
      attribute('bad', 'TEXT', { rules: { pattern: '(a+)+' } }),
      attribute('bad', 'TEXT', { label: '<script>alert(1)</script>' }),
      attribute('bad', 'SINGLE_SELECT', {
        optionSetId: connections.id,
        widget: 'swatch',
      }),
    ];
    for (const body of invalid)
      assert.equal(
        (await call('attributes', { method: 'POST', body })).status,
        400,
      );
    assert.equal(
      (
        await call('option-sets', {
          method: 'POST',
          body: {
            code: 'bad',
            label: 'Bad',
            values: [
              { code: 'bad', label: 'Bad', swatch: 'url(javascript:alert(1))' },
            ],
          },
        })
      ).status,
      400,
    );
    assert.equal((await call('attributes?sort=passwordHash')).status, 400);
  });
  const makeType = async (code, label, attrs) => {
    const type = await create('product-types', { code, label });
    const draft = {
      revision: 1,
      label,
      description: 'Demonstration fixture only',
      groups: [
        { code: 'specifications', label: 'Specifications', sortOrder: 0 },
      ],
      fields: attrs.map((a, i) => ({
        attributeId: a.id,
        groupCode: 'specifications',
        level:
          a.axisEligible || !a.allowedScopes.includes('PRODUCT')
            ? 'SKU'
            : 'PRODUCT',
        required: i === 0,
        variantAxis: a.axisEligible,
        sortOrder: i,
        widget: a.widget,
        rules: {},
        visibility: a.visibility,
      })),
    };
    const saved = await call(
      `product-types/${type.id}/versions/${type.versions[0].id}`,
      { method: 'PATCH', body: draft },
    );
    assert.equal(saved.status, 200);
    return { type, version: saved.data, draft };
  };
  const keyboard = await makeType(
    'mechanical_keyboard',
    'Mechanical Keyboard',
    [layout, color, polling, boolean, multi],
  );
  const material = await create('attributes', attribute('material'));
  const sizeSet = await create('option-sets', {
    code: 'clothing_size',
    label: 'Clothing size',
    values: ['xs', 's', 'm', 'l', 'xl'].map((code) => ({
      code,
      label: code.toUpperCase(),
    })),
  });
  const size = await create(
    'attributes',
    attribute('size', 'SINGLE_SELECT', {
      optionSetId: sizeSet.id,
      allowedScopes: ['SKU'],
      axisEligible: true,
    }),
  );
  const shirt = await makeType('t_shirt', 'T-Shirt', [material, color, size]);
  const maker = await create('attributes', attribute('manufacturer')),
    model = await create('attributes', attribute('model')),
    year = await create(
      'attributes',
      attribute('year', 'NUMBER', {
        rules: { min: '1900', max: '2100', step: '1' },
      }),
    ),
    mileage = await create(
      'attributes',
      attribute('mileage', 'NUMBER', {
        canonicalUnit: 'km',
        rules: { min: '0', step: '1' },
      }),
    );
  await makeType('used_vehicle', 'Used Vehicle', [maker, model, year, mileage]);
  await test('Industry-independent keyboard, clothing and vehicle schema fixtures reuse the same attribute identity', async () => {
    assert.equal(
      keyboard.version.attributes.find((f) => f.attributeId === color.id)
        .attributeId,
      shirt.version.attributes.find((f) => f.attributeId === color.id)
        .attributeId,
    );
    assert.equal(size.allowedScopes[0], 'SKU');
    assert.equal(
      (await call('product-types?pageSize=2&sort=label')).data.total,
      3,
    );
  });
  await test('Duplicate bindings, widened validation, foreign attributes and incorrect axis/scope reject', async () => {
    const path = `product-types/${keyboard.type.id}/versions/${keyboard.version.id}`;
    for (const fields of [
      [keyboard.draft.fields[0], keyboard.draft.fields[0]],
      [{ ...keyboard.draft.fields[2], rules: { min: '0' } }],
      [{ ...keyboard.draft.fields[0], variantAxis: true }],
      [{ ...keyboard.draft.fields[0], groupCode: 'missing' }],
    ])
      assert.equal(
        (
          await call(path, {
            method: 'PATCH',
            body: {
              ...keyboard.draft,
              revision: keyboard.version.revision,
              fields,
            },
          })
        ).status,
        400,
      );
    const foreign = await create('attributes', attribute('foreign'), {
      tenantId: tenantB.id,
      session: bToken,
    });
    assert.equal(
      (
        await call(path, {
          method: 'PATCH',
          body: {
            ...keyboard.draft,
            revision: keyboard.version.revision,
            fields: [{ ...keyboard.draft.fields[0], attributeId: foreign.id }],
          },
        })
      ).status,
      400,
    );
    await assert.rejects(() =>
      db.productTypeAttribute.create({
        data: {
          tenantId: tenantB.id,
          versionId: keyboard.version.id,
          attributeId: foreign.id,
          groupId: keyboard.version.groups[0].id,
          level: 'PRODUCT',
          snapshot: {},
        },
      }),
    );
  });
  const action = async (version, type, action, extra = {}) => {
    const r = await call(
      `product-types/${type.id}/versions/${version.id}/actions/${action}`,
      { method: 'POST', body: { revision: version.revision, ...extra } },
    );
    assert.equal(r.status, 201, action);
    return r.data;
  };
  keyboard.version = await action(keyboard.version, keyboard.type, 'review');
  keyboard.version = await action(keyboard.version, keyboard.type, 'approve');
  const impact = (
    await call(
      `product-types/${keyboard.type.id}/versions/${keyboard.version.id}/impact`,
    )
  ).data;
  keyboard.version = await action(keyboard.version, keyboard.type, 'activate', {
    typeRevision: impact.typeRevision,
  });
  await test('Active schema and nested fields/groups/options are immutable in both API and PostgreSQL', async () => {
    assert.equal(
      (
        await call(
          `product-types/${keyboard.type.id}/versions/${keyboard.version.id}`,
          {
            method: 'PATCH',
            body: { ...keyboard.draft, revision: keyboard.version.revision },
          },
        )
      ).status,
      409,
    );
    await assert.rejects(() =>
      db.productTypeVersion.update({
        where: { id: keyboard.version.id },
        data: { label: 'Tamper' },
      }),
    );
    await assert.rejects(() =>
      db.productTypeAttribute.update({
        where: { id: keyboard.version.attributes[0].id },
        data: { required: false },
      }),
    );
    await assert.rejects(() =>
      db.specificationGroup.update({
        where: { id: keyboard.version.groups[0].id },
        data: { label: 'Tamper' },
      }),
    );
    await assert.rejects(() =>
      db.productTypeAttributeOption.deleteMany({
        where: {
          bindingId: keyboard.version.attributes.find(
            (f) => f.attributeId === color.id,
          ).id,
        },
      }),
    );
    await assert.rejects(() =>
      db.productType.update({
        where: { id: keyboard.type.id },
        data: { activeVersionId: null },
      }),
    );
  });
  await test('Referenced options cannot be deleted/archived and approved snapshots retain vocabulary meaning', async () => {
    const body = {
      revision: colors.revision,
      label: colors.label,
      description: colors.description,
      status: 'ACTIVE',
      values: colors.values.map(
        ({ id, code, label, sortOrder, swatch, status }) => ({
          id,
          code,
          label,
          sortOrder,
          swatch,
          status,
        }),
      ),
    };
    assert.equal(
      (
        await call('option-sets/' + colors.id, {
          method: 'PATCH',
          body: { ...body, values: body.values.slice(1) },
        })
      ).status,
      409,
    );
    await assert.rejects(() =>
      db.optionValue.delete({ where: { id: colors.values[0].id } }),
    );
    const values = body.values.map(
      ({ id, code, label, sortOrder, swatch, status }) => ({
        id,
        code,
        label,
        sortOrder,
        swatch,
        status,
      }),
    );
    assert.equal(
      (
        await call('option-sets/' + colors.id, {
          method: 'PATCH',
          body: {
            ...body,
            values: values.map((v, i) =>
              i === 0 ? { ...v, status: 'ARCHIVED' } : v,
            ),
          },
        })
      ).status,
      409,
    );
    const changed = await call('option-sets/' + colors.id, {
      method: 'PATCH',
      body: {
        ...body,
        values: values.map((v, i) =>
          i === 0 ? { ...v, label: 'Jet Black' } : v,
        ),
      },
    });
    assert.equal(changed.status, 200);
    const active = (
      await call(
        `product-types/${keyboard.type.id}/versions/${keyboard.version.id}`,
      )
    ).data;
    assert.equal(
      active.attributes
        .find((f) => f.attributeId === color.id)
        .snapshot.options.find((o) => o.id === colors.values[0].id).label,
      'Black',
    );
  });
  await test('Cloning creates a separate draft; stale writes and concurrent activation conflict safely', async () => {
    const path = `product-types/${keyboard.type.id}/versions/${keyboard.version.id}/clone`;
    let a = await create(path, { revision: keyboard.version.revision });
    let b;
    a = await action(
      await action(a, keyboard.type, 'review'),
      keyboard.type,
      'approve',
    );
    b = await create(path, { revision: keyboard.version.revision });
    b = await action(
      await action(b, keyboard.type, 'review'),
      keyboard.type,
      'approve',
    );
    assert.notEqual(a.id, keyboard.version.id);
    assert.deepEqual(
      a.attributes.map((f) => f.snapshot),
      keyboard.version.attributes.map((f) => f.snapshot),
    );
    const revision = (
      await call(`product-types/${keyboard.type.id}/versions/${a.id}/impact`)
    ).data.typeRevision;
    const results = await Promise.all(
      [a, b].map((v) =>
        call(
          `product-types/${keyboard.type.id}/versions/${v.id}/actions/activate`,
          {
            method: 'POST',
            body: { revision: v.revision, typeRevision: revision },
          },
        ),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      await db.productTypeVersion.count({
        where: { productTypeId: keyboard.type.id, status: 'ACTIVE' },
      }),
      1,
    );
    const history = (
      await call(`product-types/${keyboard.type.id}/versions?page=2&pageSize=1`)
    ).data;
    assert.equal(history.total, 3);
    assert.equal(history.items[0].number, 2);
  });
  await test('Tenant A/B reads, edits, approval and activation remain isolated', async () => {
    for (const route of [
      'attributes',
      'product-types',
      `product-types/${keyboard.type.id}/versions/${keyboard.version.id}`,
    ])
      assert.equal(
        (await call(route, { tenantId: ids.tenantId, session: bToken })).status,
        403,
      );
    assert.equal(
      (
        await call('attributes/' + color.id, {
          tenantId: tenantB.id,
          session: bToken,
          method: 'PATCH',
          body: {
            ...attribute('unused'),
            code: undefined,
            dataType: undefined,
            status: 'ACTIVE',
            revision: 1,
          },
        })
      ).status,
      404,
    );
    const bList = (
      await call('product-types', { tenantId: tenantB.id, session: bToken })
    ).data;
    assert.equal(bList.total, 0);
  });
  await test('Store-only and narrowly delegated multiple roles cannot approve, activate or escalate schema rights', async () => {
    const user = await db.adminUser.create({
      data: {
        name: 'Scoped Editor',
        email: 'editor@example.invalid',
        passwordHash: owner.passwordHash,
      },
    });
    await db.tenantMembership.create({
      data: { tenantId: ids.tenantId, userId: user.id },
    });
    await db.storeMembership.create({ data: { ...ids, userId: user.id } });
    const storeRole = await db.scopedRole.create({
      data: {
        ...ids,
        scopeKind: 'STORE',
        code: 'STORE_ADMIN',
        name: 'Store administrator',
      },
    });
    await db.storeRoleAssignment.create({
      data: { ...ids, userId: user.id, roleId: storeRole.id },
    });
    const storeCapabilities = await db.permission.findMany({
      where: {
        code: {
          in: [
            'categories.manage',
            'inventory.manage',
            'settings.manage',
            'staff.manage',
            'roles.manage',
          ],
        },
      },
    });
    await db.scopedRolePermission.createMany({
      data: storeCapabilities.map((p) => ({
        roleId: storeRole.id,
        permissionId: p.id,
        scopeKind: 'STORE',
        canDelegate: true,
      })),
    });
    const token = randomBytes(32).toString('hex');
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    assert.equal(
      (
        await call('attributes', {
          session: token,
          method: 'POST',
          body: attribute('denied'),
        })
      ).status,
      403,
    );
    for (const [code, permissions] of [
      ['SCHEMA_READER', ['product-types.view', 'attributes.view']],
      ['ATTRIBUTE_CREATOR', ['attributes.create']],
    ]) {
      const role = await db.scopedRole.create({
        data: { scopeKind: 'TENANT', tenantId: ids.tenantId, code, name: code },
      });
      const ps = await db.permission.findMany({
        where: { code: { in: permissions } },
      });
      await db.scopedRolePermission.createMany({
        data: ps.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
          scopeKind: 'TENANT',
          canDelegate: false,
        })),
      });
      await db.tenantRoleAssignment.create({
        data: { tenantId: ids.tenantId, userId: user.id, roleId: role.id },
      });
    }
    await create('attributes', attribute('delegated_create'), {
      session: token,
    });
    assert.equal(
      (
        await call(
          `product-types/${shirt.type.id}/versions/${shirt.version.id}`,
          {
            session: token,
            method: 'PATCH',
            body: { ...shirt.draft, revision: shirt.version.revision },
          },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call('attributes/' + layout.id, {
          session: token,
          method: 'PATCH',
          body: {
            ...attribute('unused'),
            code: undefined,
            dataType: undefined,
            revision: layout.revision,
            status: 'ACTIVE',
          },
        })
      ).status,
      403,
    );
    for (const action of ['approve', 'activate'])
      assert.equal(
        (
          await call(
            `product-types/${shirt.type.id}/versions/${shirt.version.id}/actions/${action}`,
            {
              session: token,
              method: 'POST',
              body: { revision: shirt.version.revision, typeRevision: 1 },
            },
          )
        ).status,
        403,
      );
    const forged = await fetch(
      `${base}/api/admin/scopes/tenants/${ids.tenantId}/roles`,
      {
        method: 'POST',
        headers: {
          'x-admin-bff-key': process.env.BFF_SHARED_SECRET,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'ESCALATE',
          name: 'Escalate',
          grants: [{ code: 'product-types.approve', canDelegate: true }],
        }),
      },
    );
    assert.equal(forged.status, 403);
  });
  let categories;
  if (process.env.VOG_TEST_CATEGORIES === '1') {
    const {verifyCategories} = await import('./categories-verification.mjs');
    categories = await verifyCategories({db, ids, owner, token, bToken, tenantB, member, base, test, call, create, attribute, makeType, action, hashToken});
  }
  let catalog;
  if(process.env.VOG_TEST_PRODUCTS==='1'){
    const {verifyProducts}=await import('./products-verification.mjs');
    catalog=await verifyProducts({db,ids,owner,token,bToken,tenantB,member,base,test,call,create,attribute,makeType,action,hashToken});
  }
  let operations;
  if(process.env.VOG_TEST_OPERATIONS==='1'){const {verifyOperations}=await import('./operations-verification.mjs');operations=await verifyOperations({db,ids,owner,token,bToken,tenantB,member,base,test,hashToken});}
  let storefront;
  if(process.env.VOG_TEST_STOREFRONT==='1'){phase='storefront fixture preparation';const {verifyStorefront}=await import('./storefront-verification.mjs');storefront=await verifyStorefront({db,ids,owner,token,tenantB,base,test,create,attribute,makeType,action});}
  phase = 'admin production build and browser workflows';
  const admin = await verifyAdmin({
    apiPort,
    adminPort: await freePort(),
    email: owner.email,
    password: ownerPassword,
    scopedRoute: `scopes/tenants/${ids.tenantId}/stores/${ids.storeId}`,
    exercise: async ({ base, cookie }) => {
      const browser = await chromium.launch({
        channel: 'msedge',
        headless: true,
      });
      let browserChecks = 0,
        debugPage;
      try {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        await context.addCookies(
          cookie.split('; ').map((pair) => {
            const at = pair.indexOf('=');
            return {
              name: pair.slice(0, at),
              value: pair.slice(at + 1),
              url: base,
              httpOnly: true,
              sameSite: 'Strict',
            };
          }),
        );
        const page = await context.newPage();
        debugPage = page;
        const errors = [];
        page.on('pageerror', () => errors.push('pageerror'));
        phase = 'browser: open attributes';
        await page.goto(base + '/attributes');
        await page
          .getByRole('heading', { name: 'Attributes & Options', exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: 'Create attribute', exact: true })
          .click();
        phase = 'browser: create numeric attribute';
        await page
          .getByLabel('Internal code', { exact: true })
          .fill('ui_weight');
        await page.getByLabel('Label', { exact: true }).fill('UI Weight');
        await page
          .getByLabel('Data type', { exact: true })
          .selectOption('NUMBER');
        await page
          .getByLabel('Canonical unit', { exact: true })
          .selectOption('kg');
        await page.getByLabel('Minimum', { exact: true }).fill('0');
        await page
          .getByRole('button', { name: 'Save configuration', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Configuration saved' })
          .waitFor();
        browserChecks++;
        console.log('PASS browser numeric attribute');
        phase = 'browser: create option vocabulary';
        await page
          .getByRole('button', { name: 'Option sets', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Create option set', exact: true })
          .click();
        await page
          .getByLabel('Internal code', { exact: true })
          .fill('ui_finish');
        await page.getByLabel('Label', { exact: true }).fill('UI Finish');
        await page.getByLabel('Option code', { exact: true }).fill('matte');
        await page.getByLabel('Option label', { exact: true }).fill('Matte');
        await page
          .getByRole('button', { name: 'Save configuration', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Configuration saved' })
          .waitFor();
        browserChecks++;
        console.log('PASS browser option vocabulary');
        phase = 'browser: create Product Type';
        await page.goto(base + '/product-types');
        await page
          .getByRole('button', { name: 'Create Product Type', exact: true })
          .click();
        await page
          .getByLabel('Internal code', { exact: true })
          .fill('ui_furniture');
        await page
          .getByLabel('Product Type label', { exact: true })
          .fill('Side Table');
        await page
          .getByRole('button', { name: 'Create draft', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Add specification group', exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: 'Add specification group', exact: true })
          .click();
        await page
          .getByLabel('Add reusable attribute', { exact: true })
          .selectOption({ label: 'UI Weight (ui_weight)' });
        await page.getByLabel('Group code', { exact: true }).fill('dimensions');
        await page
          .getByRole('button', { name: 'Save draft', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Draft saved' })
          .waitFor();
        browserChecks++;
        console.log('PASS browser Product Type draft');
        const preview = page.getByRole('region', {
          name: 'Generated form preview',
        });
        assert.equal(await preview.locator('input[type=number]').count(), 1);
        assert.equal(
          await preview.locator('input[type=number]').getAttribute('min'),
          '0',
        );
        browserChecks++;
        await page
          .getByRole('button', {
            name: 'Submit saved draft for review',
            exact: true,
          })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'now REVIEW' })
          .waitFor();
        await page
          .getByRole('button', { name: 'Approve schema', exact: true })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'now APPROVED' })
          .waitFor();
        await page
          .getByRole('button', {
            name: 'Compare saved version & analyze impact',
            exact: true,
          })
          .click();
        await page
          .getByRole('heading', { name: 'Saved schema comparison' })
          .waitFor();
        await page
          .getByRole('button', {
            name: 'Activate compared schema',
            exact: true,
          })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'now ACTIVE' })
          .waitFor();
        assert.equal(
          await page
            .getByRole('button', { name: 'Save draft', exact: true })
            .isDisabled(),
          true,
        );
        browserChecks++;
        await page
          .getByRole('button', {
            name: 'Create new draft from version',
            exact: true,
          })
          .click();
        await page
          .getByRole('status')
          .filter({ hasText: 'new draft was created' })
          .waitFor();
        assert.equal(
          await page
            .getByRole('button', { name: 'Save draft', exact: true })
            .isEnabled(),
          true,
        );
        browserChecks++;
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          browserChecks++;
        }
        assert.equal(errors.length, 0);
        if (categories) await categories.browser({page, base, cookie});
        if (catalog) await catalog.browser({page,base,cookie});
        if(operations)await operations.browser({page,base,cookie});
        assert.equal(errors.length,0);
        await context.close();
        return {
          passed: true,
          browserChecks,
          headlessBrowser: 'Microsoft Edge',
          realForms: true,
          noPageErrors: true,
          ...(catalog?{catalogBrowser:{passed:true,productAndSkuForms:true,typedFalseAndZero:true,dependentResolution:true,listingPins:true,separateApprovalAndPublication:true,clonedRevisions:true,responsiveWidths:[1440,390],missingCsrfRejected:true,invalidBffPathsRejected:true}}:{}),
          ...(operations?{operationsBrowser:{passed:true}}:{}),
        };
      } catch (error) {
        if (debugPage) {
          await fs.mkdir(parent, { recursive: true });
          await debugPage.screenshot({
            path: path.join(parent, 'ui-failure.png'),
            fullPage: true,
          });
          await fs.writeFile(
            path.join(parent, 'ui-failure.json'),
            JSON.stringify(
              {
                phase,
                alerts: await debugPage.getByRole('alert').allTextContents(),
                controls: await debugPage
                  .locator('input,select,textarea')
                  .evaluateAll((nodes) =>
                    nodes.map((n) => ({
                      label: n.getAttribute('aria-label'),
                      type: n.type,
                      valid: n.validity.valid,
                      message: n.validationMessage,
                    })),
                  ),
                locator: error.message.split('\n').slice(0, 3),
              },
              null,
              2,
            ),
          );
        }
        throw error;
      } finally {
        await browser.close();
      }
    },
  });
  checks++;
  if(storefront){phase='dynamic storefront production build and browser';await storefront.browser();}
  tests.push(
    'Real admin attribute/option/type creation, form preview, lifecycle, clone and responsive browser workflows',
  );
  await test('Privileged mutations are tenant-audited without tokens, passwords or database URLs', async () => {
    const events = await db.auditLog.findMany({
      where: { action: { startsWith: 'schema.' } },
    });
    assert.ok(events.length >= 20);
    assert.ok(events.every((e) => e.scopeKind === 'TENANT' && e.tenantId));
    const text = JSON.stringify(events);
    for (const secret of [ownerPassword, token, bToken, url])
      assert.equal(text.includes(secret), false);
  });
  report = {
    passed: true,
    checks,
    tests,
    admin,
    postgres: (await db.$queryRaw`SELECT version()`)[0].version.split(
      ' on ',
    )[0],
    database: 'fresh disposable loopback database',
    productionAccess: false,
    credentialsPersisted: false,
  };
} catch (error) {
  if (error.constructor.name === 'AssertionError') console.error(error.message);
  console.error(
    'Schema verification failed at:',
    phase,
    'error:',
    error.constructor.name,
  );
  process.exitCode = 1;
  report = {
    passed: false,
    checks,
    failedPhase: phase,
    productionAccess: false,
  };
} finally {
  if (server) {
    server.kill();
    await new Promise((resolve) =>
      server.exitCode !== null ? resolve() : server.once('exit', resolve),
    );
  }
  await db?.$disconnect();
  await cluster.stop();
  if (path.dirname(directory) !== parent) throw Error('Unsafe test cleanup');
  await fs.rm(directory, { recursive: true, force: true,maxRetries:8,retryDelay:150 });
  if(process.env.VOG_TEST_OPERATIONS==='1'){const target=path.resolve(process.env.MEDIA_LOCAL_ROOT),root=path.resolve('.local/operations');if(!target.startsWith(root+path.sep)||!path.basename(target).startsWith('media-'))throw Error('Unsafe media fixture cleanup');await fs.rm(target,{recursive:true,force:true});}
  await fs.mkdir('docs', { recursive: true });
  await fs.writeFile(
    process.env.VOG_TEST_STOREFRONT==='1'?'docs/storefront-verification.json':process.env.VOG_TEST_OPERATIONS==='1'?'docs/operations-verification.json':process.env.VOG_TEST_PRODUCTS==='1'?'docs/products-verification.json':process.env.VOG_TEST_CATEGORIES === '1' ? 'docs/categories-verification.json' : 'docs/product-types-verification.json',
    JSON.stringify(
      {
        ...report,
        cleanup:
          'temporary API and PostgreSQL stopped; generated cluster and admin fixture removed',
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Disposable schema test infrastructure cleaned up.');
}
process.exit(Number(process.exitCode ?? 0));
