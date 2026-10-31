// Owns a fresh, disposable loopback PostgreSQL cluster. Never reads DB credentials
// from .env.local, and never runs migrate/seed against a caller-provided URL.
import EmbeddedPostgres from 'embedded-postgres';
import {spawn, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {Client} from 'pg';

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => {const {port} = s.address(); s.close(() => resolve(port));});
});
const runId = randomBytes(8).toString('hex'), clusterDir = path.resolve('.local', 'foundation', runId);
const password = randomBytes(32).toString('hex'), port = await freePort(), apiPort = await freePort();
const database = `foundation_${runId}_test`, url = `postgresql://foundation:${password}@127.0.0.1:${port}/${database}`;
// Override every connection used by child processes; no production fallback.
Object.assign(process.env, {DATABASE_URL: url, TEST_DATABASE_URL: url, NODE_ENV: 'test', BFF_SHARED_SECRET: randomBytes(64).toString('hex'), ADMIN_ORIGIN: 'http://localhost:3001', STOREFRONT_ORIGIN: 'http://localhost:3000', HOST: '127.0.0.1', PORT: String(apiPort)});
const cluster = new EmbeddedPostgres({databaseDir: clusterDir, user: 'foundation', password, port, persistent: false, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {}});
let db, server, checks = 0;
const results = [];
const test = async (name, run) => {await run(); checks++; results.push(name); console.log(`PASS ${name}`);};
const runCommand = (args) => {
  const child = spawnSync(process.execPath, args, {env: process.env, encoding: 'utf8', stdio: 'pipe'});
  if (child.status !== 0) throw new Error('Isolated migration/test subprocess failed (sensitive diagnostics suppressed).');
};
try {
  await cluster.initialise(); await cluster.start();
  const control = cluster.getPgClient(); await control.connect();
  await control.query(`CREATE DATABASE "${database}"`); await control.end();
  runCommand(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  const controlUrl = new URL(url); controlUrl.pathname = '/postgres';
  const legacy = spawnSync(process.execPath, ['scripts/test-security-fresh.mjs'], {env: {...process.env, DATABASE_URL: controlUrl.href, SECURITY_TEST_PORT: String(await freePort()), SECURITY_REPORT_PATH: 'docs/commerce-foundation-auth-regression.json'}, encoding: 'utf8', stdio: 'pipe'});
  console.log(legacy.stdout.trim());
  if (legacy.status !== 0) throw new Error('Existing authentication regression suite failed.');
  const {createDatabase} = await import('../dist/security/database.js');
  const {seedSecurity, bootstrapOwner} = await import('../dist/security/provision.js');
  const {hashPassword, hashToken} = await import('../dist/security/auth.service.js');
  const {initializeDevelopmentFoundation, assertDevelopmentDatabase} = await import('../dist/security/development-foundation.js');
  const {ScopedAuthorizationService} = await import('../dist/security/scoped-authorization.service.js');
  const {StaffService} = await import('../dist/security/staff.service.js');
  const {SCOPED_PERMISSIONS} = await import('../dist/security/scoped-permissions.js');
  db = createDatabase(url);
  const authz = new ScopedAuthorizationService(db), staff = new StaffService(db, authz);
  const ownerPassword = `Dev!9${randomBytes(20).toString('hex')}`;
  await seedSecurity(db); await bootstrapOwner(db, {name: 'Development Owner', email: 'owner@example.invalid', password: ownerPassword});
  const owner = await db.adminUser.findUniqueOrThrow({where: {email: 'owner@example.invalid'}});
  await test('Additive migration preserves pre-existing legacy database records', async () => {
    const name = `upgrade_${runId}_test`, admin = cluster.getPgClient(); await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); await admin.end();
    const target = new URL(url); target.pathname = '/' + name;
    const upgrade = new Client({connectionString: target.href}); await upgrade.connect();
    try {
      await upgrade.query(await fs.readFile('prisma/migrations/202610290001_admin_security/migration.sql', 'utf8'));
      // A transaction exercises the exact SQL migration on a populated old schema.
      await upgrade.query('INSERT INTO "AdminUser" (id,name,email,"passwordHash",active,"updatedAt") VALUES ($1,$2,$3,$4,true,now())', [owner.id, 'Preserved', 'preserved@example.invalid', owner.passwordHash]);
      const legacy = await db.role.findUniqueOrThrow({where: {code: 'SUPER_ADMIN'}});
      await upgrade.query('INSERT INTO "Role" (id,code,name,description,system) VALUES ($1,$2,$3,$4,true)', [legacy.id, legacy.code, legacy.name, legacy.description]);
      await upgrade.query('INSERT INTO "AdminUserRole" ("userId","roleId") VALUES ($1,$2)', [owner.id, legacy.id]);
      const hash = hashToken(randomBytes(32).toString('hex'));
      await upgrade.query('INSERT INTO "AdminSession" (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'1 hour\')', [crypto.randomUUID(), owner.id, hash]);
      await upgrade.query('BEGIN');
      await upgrade.query(await fs.readFile('prisma/migrations/202611010001_commerce_foundation/migration.sql', 'utf8'));
      await upgrade.query('COMMIT');
      assert.equal((await upgrade.query('SELECT "passwordHash" FROM "AdminUser"')).rows[0].passwordHash, owner.passwordHash);
      assert.equal((await upgrade.query('SELECT "tokenHash" FROM "AdminSession"')).rows[0].tokenHash, hash);
      assert.equal((await upgrade.query('SELECT count(*)::int AS n FROM "AdminUserRole"')).rows[0].n, 1);
      assert.equal((await upgrade.query('SELECT count(*)::int AS n FROM "PlatformRoleAssignment"')).rows[0].n, 0);
    } finally {await upgrade.end();}
  });
  const token = randomBytes(32).toString('hex');
  await db.adminSession.create({data: {userId: owner.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000)}});
  const before = {user: await db.adminUser.findUnique({where: {id: owner.id}}), roles: await db.adminUserRole.findMany(), session: await db.adminSession.findMany()};
  let defaultIds;
  await test('Fresh migrations apply, and development initializer preserves identity, hashes, sessions and assignments', async () => {
    defaultIds = await initializeDevelopmentFoundation(db, url, 'test');
    assert.deepEqual(await initializeDevelopmentFoundation(db, url, 'test'), defaultIds);
    assert.deepEqual(await db.adminUser.findUnique({where: {id: owner.id}}), before.user);
    assert.deepEqual(await db.adminUserRole.findMany(), before.roles);
    assert.deepEqual(await db.adminSession.findMany(), before.session);
    assert.equal(await db.tenant.count(), 1); assert.equal(await db.store.count(), 1);
  });
  await test('Development initialization rejects remote/non-test/production execution', async () => {
    for (const [input, env] of [['postgresql://invalid@neon.example/db_test', 'test'], [url, 'production'], ['postgresql://invalid@localhost/real', 'development']]) assert.throws(() => assertDevelopmentDatabase(input, env));
  });
  const storeCtx = {kind: 'STORE', ...defaultIds}, tenantCtx = {kind: 'TENANT', tenantId: defaultIds.tenantId};
  await test('Legacy Owner retains default tenant/store authority without platform access', async () => {
    assert.ok((await authz.resolve(owner.id, storeCtx)).owner);
    await authz.require(owner.id, tenantCtx, ['product-types.manage']);
    await assert.rejects(() => authz.resolve(owner.id, {kind: 'PLATFORM'}));
    assert.equal(await db.platformRoleAssignment.count(), 0);
  });
  const tenantB = await db.tenant.create({data: {slug: 'tenant-b', name: 'B'}});
  const storeB = await db.store.create({data: {tenantId: tenantB.id, slug: 'store-b', name: 'B'}});
  const storeA2 = await db.store.create({data: {tenantId: defaultIds.tenantId, slug: 'second', name: 'Second'}});
  const ctxB = {kind: 'STORE', tenantId: tenantB.id, storeId: storeB.id};
  const ctxA2 = {kind: 'STORE', tenantId: defaultIds.tenantId, storeId: storeA2.id};
  const member = await db.adminUser.create({data: {name: 'Member', email: 'member@example.invalid', passwordHash: await hashPassword(ownerPassword)}});
  const join = async (userId, ctx) => {
    await db.tenantMembership.upsert({where: {tenantId_userId: {tenantId: ctx.tenantId, userId}}, create: {tenantId: ctx.tenantId, userId}, update: {}});
    await db.storeMembership.create({data: {tenantId: ctx.tenantId, storeId: ctx.storeId, userId}});
  };
  await join(member.id, storeCtx);
  const createRole = (code, codes) => authz.createRole(owner.id, storeCtx, {code, name: code, grants: codes.map(code => ({code, canDelegate: false}))});
  const read = await createRole('READ', ['inventory.view']), update = await createRole('UPDATE', ['inventory.manage']);
  await test('Multiple custom roles union within one explicit context', async () => {
    await authz.assignRoles(owner.id, storeCtx, member.id, [read.id, update.id]);
    await authz.require(member.id, storeCtx, ['inventory.view', 'inventory.manage']);
    await assert.rejects(() => authz.require(member.id, storeCtx, ['roles.manage']));
  });
  await test('Store Owner cannot grant platform or unsupported tenant permissions', async () => {
    for (const code of ['platform.roles.manage', 'products.update', 'unregistered.power']) await assert.rejects(() => createRole('INVALID', [code]));
    await assert.rejects(() => authz.createRole(owner.id, {kind: 'PLATFORM'}, {code: 'BAD', name: 'Bad', grants: []}));
  });
  await test('Tenant A / Store A cannot access or mutate Tenant B / Store B; forged identifiers grant nothing', async () => {
    for (const ctx of [ctxB, ctxA2, {kind: 'STORE', tenantId: defaultIds.tenantId, storeId: storeB.id}, {kind: 'TENANT', tenantId: tenantB.id}]) {
      await assert.rejects(() => authz.require(owner.id, ctx, ['roles.manage']));
      await assert.rejects(() => authz.createRole(owner.id, ctx, {code: 'FORGED', name: 'Forged', grants: []}));
    }
  });
  await test('Composite database FKs reject cross-tenant memberships, assignments and nested writes', async () => {
    await assert.rejects(() => db.storeMembership.create({data: {tenantId: defaultIds.tenantId, storeId: storeB.id, userId: member.id}}));
    await assert.rejects(() => db.scopedRole.create({data: {scopeKind: 'STORE', tenantId: defaultIds.tenantId, storeId: storeB.id, code: 'BAD', name: 'Bad'}}));
    const bRole = await db.scopedRole.create({data: {scopeKind: 'STORE', tenantId: tenantB.id, storeId: storeB.id, code: 'B_ROLE', name: 'B'}});
    await assert.rejects(() => db.storeRoleAssignment.create({data: {...defaultIds, userId: member.id, roleId: bRole.id}}));
    await assert.rejects(() => db.scopedRole.create({data: {scopeKind: 'STORE', ...defaultIds, code: 'NESTED_BAD', name: 'Bad', storeAssignments: {create: {tenantId: tenantB.id, storeId: storeB.id, userId: member.id}}}}));
    assert.equal(await db.scopedRole.count({where: {code: 'NESTED_BAD'}}), 0);
  });
  await test('Database checks enforce role ownership, assignment discriminators and supported permission scopes', async () => {
    await assert.rejects(() => db.scopedRole.create({data: {scopeKind: 'PLATFORM', tenantId: tenantB.id, code: 'BAD_PLATFORM', name: 'Bad'}}));
    await assert.rejects(() => db.platformRoleAssignment.create({data: {userId: member.id, roleId: read.id, scopeKind: 'STORE'}}));
    const product = await db.permission.findUniqueOrThrow({where: {code: 'products.update'}});
    await assert.rejects(() => db.scopedRolePermission.create({data: {roleId: read.id, permissionId: product.id, scopeKind: 'STORE'}}));
    await assert.rejects(() => db.scopedRole.create({data: {scopeKind: 'STORE', ...defaultIds, code: 'READ', name: 'Duplicate'}}));
    await assert.rejects(() => db.auditLog.create({data: {action: 'invalid', resource: 'test', tenantId: tenantB.id}}));
    await assert.rejects(() => db.auditLog.create({data: {action: 'invalid', resource: 'test', scopeKind: 'STORE', tenantId: defaultIds.tenantId, storeId: storeB.id}}));
  });
  await test('Tenant and Platform roles work only inside their explicitly assigned scope', async () => {
    const tenantRole = await authz.createRole(owner.id, tenantCtx, {code: 'TYPE_EDITOR', name: 'Type Editor', grants: [{code: 'product-types.manage', canDelegate: false}]});
    await authz.assignRoles(owner.id, tenantCtx, member.id, [tenantRole.id]);
    await authz.require(member.id, tenantCtx, ['product-types.manage']);
    await assert.rejects(() => authz.require(member.id, storeCtx, ['product-types.manage']));
    const admin = await db.adminUser.create({data: {name: 'Platform fixture', email: 'platform@example.invalid', passwordHash: owner.passwordHash}});
    const role = await db.scopedRole.create({data: {scopeKind: 'PLATFORM', code: 'PLATFORM_FIXTURE', name: 'Fixture'}});
    const capabilities = await db.permission.findMany({where: {code: {in: ['platform.roles.view', 'platform.roles.manage', 'platform.staff.manage']}}});
    await db.scopedRolePermission.createMany({data: capabilities.map(p => ({roleId: role.id, permissionId: p.id, scopeKind: 'PLATFORM', canDelegate: true}))});
    await db.platformRoleAssignment.create({data: {userId: admin.id, roleId: role.id}});
    const platformCtx = {kind: 'PLATFORM'};
    const custom = await authz.createRole(admin.id, platformCtx, {code: 'PLATFORM_READER', name: 'Reader', grants: [{code: 'platform.roles.view', canDelegate: false}]});
    await authz.assignRoles(admin.id, platformCtx, member.id, [custom.id]);
    await authz.require(member.id, platformCtx, ['platform.roles.view']);
    await assert.rejects(() => authz.require(admin.id, storeCtx, ['roles.manage']));
    await assert.rejects(() => authz.assignRoles(owner.id, storeCtx, member.id, [custom.id]));
  });
  await test('Explicit delegation boundary blocks self-escalation and elevated role edits/assignments', async () => {
    const delegate = await authz.createRole(owner.id, storeCtx, {code: 'DELEGATE', name: 'Delegate', grants: [
      {code: 'roles.manage', canDelegate: false}, {code: 'staff.manage', canDelegate: false}, {code: 'inventory.view', canDelegate: true},
    ]});
    await authz.assignRoles(owner.id, storeCtx, member.id, [delegate.id]);
    await assert.rejects(() => authz.createRole(member.id, storeCtx, {code: 'ESCALATE', name: 'Bad', grants: [{code: 'inventory.manage', canDelegate: false}]}));
    await assert.rejects(() => authz.updateRole(member.id, storeCtx, delegate.id, {name: 'Self', grants: [{code: 'roles.manage', canDelegate: true}]}));
    await assert.rejects(() => authz.assignRoles(member.id, storeCtx, member.id, [update.id]));
    await authz.createRole(member.id, storeCtx, {code: 'DELEGATED_READ', name: 'Allowed', grants: [{code: 'inventory.view', canDelegate: false}]});
  });
  await test('Permission edits and membership revocation take effect immediately, without cached grants', async () => {
    await authz.assignRoles(owner.id, storeCtx, member.id, [read.id]);
    await authz.require(member.id, storeCtx, ['inventory.view']);
    await authz.updateRole(owner.id, storeCtx, read.id, {name: 'No grants', grants: []});
    await assert.rejects(() => authz.require(member.id, storeCtx, ['inventory.view']));
    await authz.revokeMembership(owner.id, storeCtx, member.id);
    await assert.rejects(() => authz.resolve(member.id, storeCtx));
  });
  await test('Last legacy Owner cannot be revoked through store or tenant membership administration', async () => {
    await assert.rejects(() => authz.revokeMembership(owner.id, storeCtx, owner.id), error => error.getStatus() === 409);
    await assert.rejects(() => authz.revokeMembership(owner.id, tenantCtx, owner.id), error => error.getStatus() === 409);
    assert.ok((await authz.resolve(owner.id, storeCtx)).owner);
  });
  await test('Scoped Owner cannot be removed, downgraded or edited; concurrent removal preserves one Owner', async () => {
    const ownerRole = await db.scopedRole.create({data: {scopeKind: 'STORE', tenantId: tenantB.id, storeId: storeB.id, code: 'OWNER', name: 'Owner', owner: true, system: true}});
    const permissions = await db.permission.findMany({where: {code: {in: Object.entries(SCOPED_PERMISSIONS).filter(([, scopes]) => scopes.includes('STORE')).map(([code]) => code)}}});
    await db.scopedRolePermission.createMany({data: permissions.map(p => ({roleId: ownerRole.id, permissionId: p.id, scopeKind: 'STORE', canDelegate: true}))});
    const owners = [];
    for (let i = 0; i < 2; i++) {
      const u = await db.adminUser.create({data: {name: 'Scoped Owner', email: `scoped-owner-${i}@example.invalid`, passwordHash: owner.passwordHash}});
      await join(u.id, ctxB); await db.storeRoleAssignment.create({data: {tenantId: tenantB.id, storeId: storeB.id, userId: u.id, roleId: ownerRole.id}}); owners.push(u);
    }
    await assert.rejects(() => authz.updateRole(owners[0].id, ctxB, ownerRole.id, {name: 'Downgrade', grants: []}));
    const outcomes = await Promise.allSettled(owners.map(u => authz.assignRoles(u.id, ctxB, u.id, [])));
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const last = await db.storeRoleAssignment.findFirstOrThrow({where: {roleId: ownerRole.id}});
    await assert.rejects(() => authz.revokeMembership(last.userId, ctxB, last.userId));
    await assert.rejects(() => authz.assignRoles(last.userId, ctxB, last.userId, []));
  });
  await test('Legacy staff API cannot globally disable or change a multi-tenant identity', async () => {
    await join(owner.id, ctxA2);
    await assert.rejects(() => authz.require(owner.id, ctxA2, ['roles.manage']));
    // Test using another legacy administrator; own-account edits already deny.
    const legacyRole = await db.role.findUniqueOrThrow({where: {code: 'SUPER_ADMIN'}});
    const second = await db.adminUser.create({data: {name: 'Second', email: 'second@example.invalid', passwordHash: owner.passwordHash, roles: {create: {roleId: legacyRole.id}}}});
    await join(second.id, storeCtx);
    await assert.rejects(() => staff.update(second.id, owner.id, {active: false}));
    await db.storeMembership.delete({where: {tenantId_storeId_userId: {tenantId: defaultIds.tenantId, storeId: storeA2.id, userId: owner.id}}});
    await db.adminUserRole.delete({where: {userId_roleId: {userId: second.id, roleId: legacyRole.id}}});
  });
  await test('Legacy staff mutations preserve the last authorized Owner despite another revoked Owner', async () => {
    const ownerRole = await db.role.findUniqueOrThrow({where: {code: 'SUPER_ADMIN'}});
    const revoked = await db.adminUser.create({data: {name: 'Revoked owner', email: 'revoked-owner@example.invalid', passwordHash: owner.passwordHash, roles: {create: {roleId: ownerRole.id}}}});
    await join(revoked.id, storeCtx);
    await db.storeMembership.update({where: {tenantId_storeId_userId: {...defaultIds, userId: revoked.id}}, data: {active: false}});
    const delegateRole = await db.role.create({data: {code: 'LEGACY_DELEGATE', name: 'Legacy delegate', description: 'Fixture', permissions: {create: (await db.permission.findMany({where: {code: {in: ['staff.manage', 'roles.manage']}}})).map(p => ({permissionId: p.id}))}}});
    const delegate = await db.adminUser.create({data: {name: 'Legacy delegate', email: 'legacy-delegate@example.invalid', passwordHash: owner.passwordHash, roles: {create: {roleId: delegateRole.id}}}});
    await join(delegate.id, storeCtx);
    await assert.rejects(() => staff.update(delegate.id, owner.id, {active: false}), error => error.getStatus() === 409);
    assert.equal((await db.adminUser.findUniqueOrThrow({where: {id: owner.id}})).active, true);
  });
  // Real Nest HTTP checks, including pre-existing opaque session compatibility.
  server = spawn(process.execPath, ['dist/main.js'], {env: process.env, stdio: 'ignore'});
  const base = `http://127.0.0.1:${apiPort}`;
  for (let i = 0; i < 100; i++) {try {if ((await fetch(base + '/api/health')).status === 200) break;} catch {} if (i === 99) throw new Error('Isolated API startup timeout'); await new Promise(r => setTimeout(r, 100));}
  const call = async (route, {method = 'GET', body, session = token, origin, bff = true, headers = {}} = {}) => fetch(base + '/api/admin/' + route, {method, headers: {'Content-Type': 'application/json', ...(bff ? {'x-admin-bff-key': process.env.BFF_SHARED_SECRET} : {}), ...(session ? {Authorization: `Bearer ${session}`} : {}), ...(origin ? {Origin: origin} : {}), ...headers}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  const route = `scopes/tenants/${defaultIds.tenantId}/stores/${defaultIds.storeId}`;
  await test('Public health and readiness succeed; pre-existing opaque session remains compatible', async () => {
    assert.equal((await fetch(base + '/api/health/ready')).status, 200);
    assert.equal((await call('auth/me')).status, 200);
    assert.equal((await call(route + '/access')).status, 200);
  });
  await test('HTTP routes enforce bridge key, Origin, session, context and strict DTOs', async () => {
    assert.equal((await call(route + '/roles', {bff: false})).status, 401);
    assert.equal((await call(route + '/roles', {origin: 'https://hostile.invalid'})).status, 403);
    assert.equal((await call(route + '/roles', {session: null})).status, 401);
    assert.equal((await call('scopes/platform/access')).status, 403);
    assert.equal((await call(`scopes/tenants/${tenantB.id}/stores/${storeB.id}/roles`)).status, 403);
    assert.equal((await call(route + '/roles', {method: 'POST', body: {code: 'HTTP_BAD', name: 'Bad', grants: [], tenantId: tenantB.id}})).status, 400);
    assert.equal((await call(route + '/roles', {headers: {'x-tenant-id': tenantB.id, 'x-store-id': storeB.id}})).status, 200);
    const contexts = await (await call('contexts')).json(); assert.equal(contexts.some(c => c.tenant.id === tenantB.id), false);
  });
  await test('Legacy protected APIs reject a revoked default membership immediately', async () => {
    await db.storeMembership.update({where: {tenantId_storeId_userId: {...defaultIds, userId: owner.id}}, data: {active: false}});
    assert.equal((await call('staff')).status, 403);
    assert.equal((await call(route + '/access')).status, 403);
    await db.storeMembership.update({where: {tenantId_storeId_userId: {...defaultIds, userId: owner.id}}, data: {active: true}});
    assert.equal((await call('staff')).status, 200);
  });
  await test('Role lists/count boundaries and transactional mutations do not leak or edit another scope', async () => {
    const response = await call(route + '/roles'); const roles = await response.json();
    assert.ok(roles.length > 0); assert.equal(roles.some(r => r.code === 'B_ROLE'), false);
    const other = await db.scopedRole.findFirstOrThrow({where: {tenantId: tenantB.id}});
    assert.equal((await call(route + '/roles/' + other.id, {method: 'PATCH', body: {name: 'Attack', grants: []}})).status, 403);
    assert.equal((await call(route + '/roles', {method: 'POST', body: {code: 'HTTP_READ', name: 'HTTP Read', grants: [{code: 'inventory.view', canDelegate: false}]}})).status, 201);
  });
  const {verifyAdmin} = await import('./foundation-admin-regression.mjs');
  let admin;
  await test('Real admin production build and BFF/CSRF/session regression', async () => {
    admin = await verifyAdmin({apiPort, adminPort: await freePort(), email: owner.email, password: ownerPassword, scopedRoute: route});
  });
  await test('Real login/logout, expired/disabled sessions and membership revocation remain enforced', async () => {
    const response = await call('auth/login', {method: 'POST', session: null, body: {email: owner.email, password: ownerPassword}});
    assert.equal(response.status, 201); const session = (await response.json()).token;
    assert.equal((await call('auth/logout', {method: 'POST', session, body: {}})).status, 201);
    assert.equal((await call('auth/me', {session})).status, 401);
    await db.adminSession.update({where: {tokenHash: hashToken(token)}, data: {expiresAt: new Date(Date.now() - 1000)}});
    assert.equal((await call(route + '/access')).status, 401);
    await db.adminSession.update({where: {tokenHash: hashToken(token)}, data: {expiresAt: new Date(Date.now() + 3600000)}});
    await db.adminUser.update({where: {id: owner.id}, data: {active: false}});
    assert.equal((await call(route + '/access')).status, 401);
    await db.adminUser.update({where: {id: owner.id}, data: {active: true}});
  });
  await test('Scoped audit metadata includes ownership and never contains passwords or session tokens', async () => {
    const events = await db.auditLog.findMany({where: {resource: 'scoped_authorization'}});
    assert.ok(events.length > 0); assert.ok(events.every(e => e.scopeKind === 'PLATFORM' ? !e.tenantId && !e.storeId : e.tenantId && (e.scopeKind === 'TENANT' ? !e.storeId : e.scopeKind === 'STORE' && e.storeId)));
    const text = JSON.stringify(events); assert.equal(text.includes(ownerPassword), false); assert.equal(text.includes(token), false);
  });
  await fs.mkdir('docs', {recursive: true});
  await fs.writeFile('docs/commerce-foundation-verification.json', JSON.stringify({passed: true, checks, admin, database: 'fresh disposable loopback PostgreSQL cluster', postgres: (await db.$queryRaw`SELECT version()`)[0].version.split(' on ')[0], migrations: 'fresh database, both migrations applied', tests: results, credentialsPersisted: false, productionAccess: false}, null, 2) + '\n');
  console.log(`Foundation suite passed: ${checks} checks.`);
} catch (error) {
  // Avoid Prisma error rendering: it can include complete data and connection strings.
  console.error('Foundation suite failed:', error instanceof assert.AssertionError ? `AssertionError (${error.operator})` : error?.constructor?.name, error?.message?.match(/Unknown argument `\w+`|Argument `\w+` is missing/)?.[0] ?? '', 'after', checks, 'checks.');
  process.exitCode = 1;
} finally {
  if (server) {server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));}
  await db?.$disconnect();
  await cluster.stop();
  // Cluster directory is generated below the fixed ignored foundation root.
  const root = path.resolve('.local', 'foundation') + path.sep;
  if (!clusterDir.startsWith(root)) throw new Error('Cleanup path escaped test root.');
  await fs.rm(clusterDir, {recursive: true, force: true});
  console.log('Disposable PostgreSQL stopped and generated test cluster removed.');
}
// Preserve failures despite embedded-postgres's zero-valued beforeExit hook.
// All owned processes/clients are closed above; fetch keep-alives must not keep
// this completed CLI alive or leave CI waiting for idle socket timers.
process.exit(Number(process.exitCode ?? 0));
