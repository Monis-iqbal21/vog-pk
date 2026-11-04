import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SCOPED_PERMISSIONS } from '../dist/security/scoped-permissions.js';
import { canonical, digest } from './legacy-catalog-manifest.mjs';
export async function migrationInventory(db) {
  const folders = (
    await fs.readdir('prisma/migrations', { withFileTypes: true })
  )
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const local = [];
  for (const name of folders) {
    const bytes = await fs.readFile(
      path.join('prisma/migrations', name, 'migration.sql'),
      'utf8',
    );
    const hashes = [
      bytes,
      bytes.replaceAll('\r\n', '\n'),
      bytes.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'),
    ].map((s) => createHash('sha256').update(s).digest('hex'));
    local.push({ name, hashes });
  }
  const applied =
    await db.$queryRaw`SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at`;
  if (
    applied.some(
      (m, i) =>
        !m.finished ||
        m.rolled_back ||
        local[i]?.name !== m.name ||
        !local[i].hashes.includes(m.checksum),
    )
  )
    throw Error(
      'Migration history drift or failed migration; manual review required',
    );
  return {
    applied: applied.map((m) => m.name),
    pending: local.slice(applied.length).map((m) => m.name),
    local: local.map((m) => ({ name: m.name, sha256: m.hashes[1] })),
  };
}
export async function schemaFingerprint(db) {
  const rows =
    await db.$queryRaw`SELECT c.relname AS name, a.attname AS column_name, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS required, pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname,a.attnum`;
  const constraints =
    await db.$queryRaw`SELECT c.relname AS name, con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname`;
  const indexes =
    await db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`;
  const triggers =
    await db.$queryRaw`SELECT c.relname AS name,t.tgname AS trigger_name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
  const functions =
    await db.$queryRaw`SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,arguments`;
  return digest({ rows, constraints, indexes, triggers, functions });
}
export async function authFingerprint(db) {
  return digest(
    await db.adminUser.findMany({
      orderBy: { id: 'asc' },
      include: { roles: { orderBy: { roleId: 'asc' } } },
    }),
  );
}
export async function initializeReleaseFoundation(
  db,
  plan,
  { apply = false } = {},
) {
  const started = Date.now();
  let step = 'guards';
  const execute = async (tx) => {
    if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    if (apply) await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
    const legacy = await tx.adminUser.findMany({
      where: { active: true, roles: { some: {} } },
      include: { roles: { include: { role: true } } },
      orderBy: { id: 'asc' },
    });
    if (
      new Set(plan.memberIds).size !== plan.memberIds.length ||
      canonical(legacy.map((u) => u.id).sort()) !==
        canonical([...plan.memberIds].sort())
    )
      throw Error(
        'Explicit active legacy membership list differs; stop to avoid lockout',
      );
    if (
      !legacy.some(
        (u) =>
          u.id === plan.actorId &&
          u.roles.some((r) => r.role.code === 'SUPER_ADMIN'),
      )
    )
      throw Error('Existing active Owner required');
    const bridge = await tx.legacyStoreBridge.findUnique({
      where: { key: 'default' },
    });
    if (
      bridge &&
      (bridge.tenantId !== plan.tenantId || bridge.storeId !== plan.storeId)
    )
      throw Error('Existing default bridge differs');
    const tenant = await tx.tenant.findUnique({ where: { slug: 'vogpk' } });
    const store = await tx.store.findUnique({
      where: { tenantId_slug: { tenantId: plan.tenantId, slug: 'vogpk' } },
    });
    if (
      (tenant && (!tenant.active || tenant.id !== plan.tenantId)) ||
      (store &&
        (!store.active ||
          store.id !== plan.storeId ||
          store.currency !== 'PKR' ||
          store.locale !== 'en-PK' ||
          store.timeZone !== 'Asia/Karachi'))
    )
      throw Error('Existing context differs; no overwrite permitted');
    for (const userId of plan.memberIds) {
      const tm = await tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: plan.tenantId, userId } },
      });
      const sm = await tx.storeMembership.findUnique({
        where: {
          tenantId_storeId_userId: {
            tenantId: plan.tenantId,
            storeId: plan.storeId,
            userId,
          },
        },
      });
      if ((tm && !tm.active) || (sm && !sm.active))
        throw Error(
          'Revoked membership requires an explicit administrator decision',
        );
    }
    if (!apply)
      return {
        dryRun: true,
        members: legacy.length,
        createsTenant: !tenant,
        createsStore: !store,
        platformGrants: 0,
      };
    // Native INSERT ... ON CONFLICT avoids hundreds of round trips and the
    // SELECT/conditional-INSERT plan used by empty-update emulated upserts.
    // Existing permission identities, descriptions and grants are untouched.
    step = 'permissions';
    const codes = Object.keys(SCOPED_PERMISSIONS);
    await tx.permission.createMany({
      data: codes.map((code) => ({ code, description: code })),
      skipDuplicates: true,
    });
    const permissions = await tx.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== codes.length)
      throw Error('Permission registration incomplete');
    step = 'permission-scopes';
    await tx.permissionScope.createMany({
      data: permissions.flatMap(({ id: permissionId, code }) =>
        SCOPED_PERMISSIONS[code].map((scopeKind) => ({
          permissionId,
          scopeKind,
        })),
      ),
      skipDuplicates: true,
    });
    step = 'context';
    if (!tenant)
      await tx.tenant.create({
        data: { id: plan.tenantId, slug: 'vogpk', name: 'VOGPK' },
      });
    if (!store)
      await tx.store.create({
        data: {
          id: plan.storeId,
          tenantId: plan.tenantId,
          slug: 'vogpk',
          name: 'VOGPK',
          currency: 'PKR',
          locale: 'en-PK',
          timeZone: 'Asia/Karachi',
        },
      });
    step = 'memberships';
    await tx.tenantMembership.createMany({
      data: plan.memberIds.map((userId) => ({
        tenantId: plan.tenantId,
        userId,
      })),
      skipDuplicates: true,
    });
    await tx.storeMembership.createMany({
      data: plan.memberIds.map((userId) => ({
        tenantId: plan.tenantId,
        storeId: plan.storeId,
        userId,
      })),
      skipDuplicates: true,
    });
    step = 'bridge';
    if (!bridge)
      await tx.legacyStoreBridge.create({
        data: {
          key: 'default',
          tenantId: plan.tenantId,
          storeId: plan.storeId,
        },
      });
    step = 'audit';
    await tx.auditLog.create({
      data: {
        actorId: plan.actorId,
        action: 'release.foundation_verified',
        resource: 'catalog_release',
        scopeKind: 'TENANT',
        tenantId: plan.tenantId,
        metadata: {
          releaseSha: plan.releaseSha,
          memberCount: plan.memberIds.length,
          platformGrants: 0,
        },
      },
    });
    return { dryRun: false, members: legacy.length, platformGrants: 0 };
  };
  try {
    return await db.$transaction(execute, {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });
  } catch (error) {
    // Whitelisted metadata only; never attach SQL, parameters or error messages
    // to the release journal. Preserve the original error for programmatic use.
    error.foundationDiagnostic = { step, elapsedMs: Date.now() - started };
    throw error;
  }
}
export async function verifyImportedRelease(db, plan, manifest) {
  const evidence = await db.catalogImportRecord.findMany({
    where: {
      tenantId: plan.tenantId,
      storeId: plan.storeId,
      manifestHash: manifest.checksum,
    },
  });
  if (evidence.length !== 96 || evidence.some((e) => !e.complete))
    throw Error('Expected 96 completed import checkpoints');
  let media = 0,
    featured = 0,
    newArrivals = 0;
  for (const r of manifest.records) {
    const e = evidence.find(
        (e) => e.kind === 'PRODUCT' && e.sourceKey === r.sourceKey,
      ),
      p = r.source.product;
    if (!e || e.sourceHash !== r.sourceHash || e.mapping.legacyId !== p.id)
      throw Error('Source identity differs');
    const l = await db.storeListing.findUniqueOrThrow({
        where: { id: e.listingId },
        include: {
          published: { include: { categories: true, skus: true } },
          product: { include: { skus: true } },
        },
      }),
      v = l.published;
    if (
      l.tenantId !== plan.tenantId ||
      l.storeId !== plan.storeId ||
      l.archived ||
      !v ||
      v.id !== e.mapping.listingRevisionId ||
      v.productRevisionId !== e.mapping.productRevisionId ||
      v.slug !== p.slug ||
      v.title !== p.name ||
      v.status !== 'PUBLISHED' ||
      v.sellingMode !== 'REFERENCE' ||
      v.categories.length !== 1 ||
      v.categories[0].categoryId !== e.mapping.categoryId ||
      v.skus.length !== 1 ||
      v.skus[0].skuRevisionId !== e.mapping.skuRevisionId ||
      l.product.skus.length !== 1 ||
      l.product.skus[0].id !== e.mapping.skuId ||
      v.featuredOrder !== r.featuredOrder ||
      v.newArrivalOrder !== r.newArrivalOrder ||
      v.catalogOrder !== r.source.sourceOrder
    )
      throw Error('Published catalog parity differs');
    if (v.featuredOrder !== null) featured++;
    if (v.newArrivalOrder !== null) newArrivals++;
    const refs = await db.mediaAsset.findMany({
      where: {
        tenantId: plan.tenantId,
        id: { in: e.mapping.media.map((m) => m.assetId) },
      },
    });
    if (
      refs.length !== e.mapping.media.length ||
      refs.some(
        (a) => a.publicUse || !a.developmentOnly || a.rights !== 'UNVERIFIED',
      )
    )
      throw Error('Imported media unexpectedly approved or lost');
    media += refs.length;
  }
  for (const c of manifest.categories) {
    const e = evidence.find(
      (e) => e.kind === 'CATEGORY' && e.sourceKey === c.sourceKey,
    );
    if (!e || e.sourceHash !== c.sourceHash)
      throw Error('Category source mismatch');
    const row = await db.category.findUniqueOrThrow({
      where: { id: e.categoryId },
    });
    if (
      row.storeId !== plan.storeId ||
      digest(row.activeSnapshot) !== e.mapping.snapshotHash
    )
      throw Error('Category snapshot drift');
  }
  if (
    media !== 95 ||
    featured !== 8 ||
    newArrivals !== 8 ||
    (await db.storePrice.count({ where: { storeId: plan.storeId } })) ||
    (await db.inventoryItem.count({ where: { storeId: plan.storeId } }))
  )
    throw Error('Unexpected offers, stock or collection/media counts');
  return {
    passed: true,
    products: 84,
    categories: 12,
    defaultSkus: 84,
    privateMedia: 95,
    featured,
    newArrivals,
    approvedPrices: 0,
    inventedInventory: 0,
  };
}
