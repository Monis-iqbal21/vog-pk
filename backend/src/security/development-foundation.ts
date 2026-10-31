import type {PrismaClient} from '../generated/prisma/client.js';
import {SCOPED_PERMISSIONS} from './scoped-permissions.js';

export function assertDevelopmentDatabase(url: string | undefined, environment: string | undefined) {
  if (!url || !['development', 'test'].includes(environment ?? '')) throw new Error('Explicit development/test environment required.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid development database configuration.'); }
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !/^\/[a-z0-9_]+_(dev|test)$/.test(parsed.pathname)) throw new Error('A disposable loopback development/test database is required.');
}

// Explicitly invoked only; never called by application startup or a migration.
// Existing users, hashes, sessions, roles and legacy assignments are not updated.
export async function initializeDevelopmentFoundation(db: PrismaClient, url: string, environment: string) {
  assertDevelopmentDatabase(url, environment);
  const actual = await db.$queryRaw<{name: string; address: string}[]>`SELECT current_database() AS name, host(inet_server_addr()) AS address`;
  if (actual[0]?.name !== new URL(url).pathname.slice(1) || !['127.0.0.1', '::1'].includes(actual[0]?.address)) throw new Error('Database connection does not match the approved loopback development destination.');
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
    for (const [code, scopes] of Object.entries(SCOPED_PERMISSIONS)) {
      const permission = await tx.permission.upsert({where: {code}, create: {code, description: code}, update: {}});
      for (const scopeKind of scopes) await tx.permissionScope.upsert({where: {permissionId_scopeKind: {permissionId: permission.id, scopeKind}}, create: {permissionId: permission.id, scopeKind}, update: {}});
    }
    const tenant = await tx.tenant.upsert({where: {slug: 'vogpk'}, create: {slug: 'vogpk', name: 'VOGPK'}, update: {}});
    const store = await tx.store.upsert({where: {tenantId_slug: {tenantId: tenant.id, slug: 'vogpk'}}, create: {tenantId: tenant.id, slug: 'vogpk', name: 'VOGPK'}, update: {}});
    const bridge = await tx.legacyStoreBridge.upsert({where: {key: 'default'}, create: {key: 'default', tenantId: tenant.id, storeId: store.id}, update: {}});
    if (bridge.tenantId !== tenant.id || bridge.storeId !== store.id) throw new Error('Default context differs; manual review required.');
    const users = await tx.adminUser.findMany({where: {roles: {some: {}}}, select: {id: true}});
    for (const user of users) {
      await tx.tenantMembership.upsert({where: {tenantId_userId: {tenantId: tenant.id, userId: user.id}}, create: {tenantId: tenant.id, userId: user.id}, update: {}});
      await tx.storeMembership.upsert({where: {tenantId_storeId_userId: {tenantId: tenant.id, storeId: store.id, userId: user.id}}, create: {tenantId: tenant.id, storeId: store.id, userId: user.id}, update: {}});
    }
    return {tenantId: tenant.id, storeId: store.id};
  }, {timeout: 30000});
}
