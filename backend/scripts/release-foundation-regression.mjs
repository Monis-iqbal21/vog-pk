// Destructive fixtures are permitted only on caller-provisioned isolated test DBs.
import assert from 'node:assert/strict';
import { initializeReleaseFoundation } from './catalog-release-core.mjs';
import { digest } from './legacy-catalog-manifest.mjs';
import { SCOPED_PERMISSIONS } from '../dist/security/scoped-permissions.js';
import { ScopedAuthorizationService } from '../dist/security/scoped-authorization.service.js';

const tables = [
  'Permission',
  'PermissionScope',
  'Tenant',
  'Store',
  'TenantMembership',
  'StoreMembership',
  'LegacyStoreBridge',
  'ScopedRole',
  'ScopedRolePermission',
  'TenantRoleAssignment',
  'StoreRoleAssignment',
  'PlatformRoleAssignment',
  'AuditLog',
];
const authTables = [
  'AdminUser',
  'AdminSession',
  'AdminUserRole',
  'Role',
  'RolePermission',
  'LoginThrottle',
];
async function fingerprint(db, names) {
  return digest(
    await Promise.all(
      names.map(async (name) => {
        const rows = await db.$queryRawUnsafe(
          `SELECT row_to_json(t) AS row FROM "${name}" t`,
        );
        return rows.map((r) => JSON.stringify(r.row)).sort();
      }),
    ),
  );
}
export async function verifyFoundationRegression(db, plan) {
  const [target] =
    await db.$queryRaw`SELECT current_database() AS name, inet_server_addr()::text AS address`;
  assert.match(target.name, /_test$/);
  assert.ok(
    target.address === null ||
      target.address === '127.0.0.1' ||
      target.address === '::1',
  );
  assert.equal(
    await db.tenant.count(),
    0,
    'Requires fresh isolated migrated fixture',
  );
  const before = await fingerprint(db, tables),
    auth = await fingerprint(db, authTables);
  const partial = await db.permission.findUnique({
    where: { code: 'media.approve' },
  });
  const existingPermissions = await db.permission.findMany();
  const failing = {
    $transaction: (run, options) =>
      db.$transaction(
        (tx) =>
          run(
            new Proxy(tx, {
              get: (object, key) =>
                key === 'permissionScope'
                  ? {
                      createMany: () => {
                        throw Object.assign(Error('Injected test failure'), {
                          code: 'TEST_FAILURE',
                        });
                      },
                    }
                  : object[key],
            }),
          ),
        options,
      ),
  };
  let failure;
  try {
    await initializeReleaseFoundation(failing, plan, { apply: true });
  } catch (e) {
    failure = e;
  }
  assert.equal(failure?.code, 'TEST_FAILURE');
  assert.equal(failure.foundationDiagnostic.step, 'permission-scopes');
  assert.ok(failure.foundationDiagnostic.elapsedMs >= 0);
  assert.equal(
    await fingerprint(db, tables),
    before,
    'Injected failure must rollback all writes',
  );
  assert.equal((await initializeReleaseFoundation(db, plan)).dryRun, true);
  assert.equal(await fingerprint(db, tables), before);
  await initializeReleaseFoundation(db, plan, { apply: true });
  const expectedCodes = Object.keys(SCOPED_PERMISSIONS);
  const registrations = await db.permissionScope.findMany({
    include: { permission: true },
  });
  assert.deepEqual(
    registrations.map((r) => r.permission.code + ':' + r.scopeKind).sort(),
    Object.entries(SCOPED_PERMISSIONS)
      .flatMap(([code, scopes]) => scopes.map((scope) => code + ':' + scope))
      .sort(),
  );
  assert.equal(
    await db.permission.count({ where: { code: { in: expectedCodes } } }),
    expectedCodes.length,
  );
  if (partial)
    assert.deepEqual(
      await db.permission.findUnique({ where: { code: 'media.approve' } }),
      partial,
    );
  const currentPermissions = new Map(
    (await db.permission.findMany()).map((permission) => [
      permission.id,
      permission,
    ]),
  );
  for (const permission of existingPermissions)
    assert.deepEqual(currentPermissions.get(permission.id), permission);
  assert.equal(await db.tenant.count(), 1);
  assert.equal(await db.store.count(), 1);
  assert.equal(await db.legacyStoreBridge.count(), 1);
  assert.equal(await db.tenantMembership.count(), plan.memberIds.length);
  assert.equal(await db.storeMembership.count(), plan.memberIds.length);
  assert.equal(await db.scopedRole.count(), 0);
  assert.equal(await db.platformRoleAssignment.count(), 0);
  const identity = await fingerprint(
    db,
    tables.filter((t) => t !== 'AuditLog'),
  );
  const auditCount = await db.auditLog.count();
  await initializeReleaseFoundation(db, plan, { apply: true });
  assert.equal(await db.auditLog.count(), auditCount + 1);
  assert.equal(
    await fingerprint(
      db,
      tables.filter((t) => t !== 'AuditLog'),
    ),
    identity,
  );
  assert.equal(
    await fingerprint(db, authTables),
    auth,
    'Owner, sessions and legacy RBAC must be byte-preserved',
  );
  const access = new ScopedAuthorizationService(db);
  const tenant = await access.resolve(plan.actorId, {
    kind: 'TENANT',
    tenantId: plan.tenantId,
  });
  const store = await access.resolve(plan.actorId, {
    kind: 'STORE',
    tenantId: plan.tenantId,
    storeId: plan.storeId,
  });
  assert.equal(tenant.owner, true);
  assert.equal(store.owner, true);
  assert.ok(tenant.permissions.includes('media.approve'));
  assert.ok(store.permissions.includes('listings.publish'));
  await assert.rejects(
    () => access.resolve(plan.actorId, { kind: 'PLATFORM' }),
    (e) => e.getStatus() === 403,
  );
  assert.equal(await fingerprint(db, authTables), auth);
  return {
    partialPermissionPreserved: !!partial,
    injectedFailureAtomic: true,
    dryRunReadOnly: true,
    idempotent: true,
    onlyIntentionalAuditAddedOnRerun: true,
    permissions: expectedCodes.length,
    scopes: registrations.length,
    ownerSessionsLegacyRbacPreserved: true,
    tenantStoreOwner: true,
    platformDenied: true,
  };
}
