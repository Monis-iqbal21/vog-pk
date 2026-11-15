// Development-only preparation for the later public catalog cutover. Never run
// at application startup or from a migration. No product records are imported.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function legacyRouteManifest({ products, productCategories }) {
  const rows = [
    ...products.map((p) => ({
      slug: p.slug,
      legacyKey: p.slug,
      ownerKind: 'LEGACY_PRODUCT',
    })),
    ...productCategories.map((c) => ({
      slug: c.slug,
      legacyKey: c.slug,
      ownerKind: 'LEGACY_CATEGORY',
    })),
  ];
  if (
    rows.some((r) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)) ||
    new Set(rows.map((r) => r.slug)).size !== rows.length
  )
    throw Error(
      'Legacy shared route namespace contains invalid or conflicting identities.',
    );
  return rows;
}
export async function reserveLegacyRoutes(db, context, manifest) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
      const store = await tx.store.findFirst({
        where: { id: context.storeId, tenantId: context.tenantId },
      });
      if (!store) throw Error('Store ownership mismatch.');
      for (const route of manifest) {
        const old = await tx.catalogRoute.findUnique({
          where: {
            storeId_slug: { storeId: context.storeId, slug: route.slug },
          },
        });
        if (
          old &&
          (old.ownerKind !== route.ownerKind ||
            old.legacyKey !== route.legacyKey)
        )
          throw Error(
            'Existing routing ownership conflicts; manual reconciliation required.',
          );
        if (!old)
          await tx.catalogRoute.create({ data: { ...context, ...route } });
      }
      return { reserved: manifest.length };
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    const [tenantId, storeId, confirmation] = process.argv.slice(2);
    if (
      confirmation !== '--confirm-isolated-development' ||
      ![tenantId, storeId].every((v) => /^[0-9a-f-]{36}$/.test(v ?? ''))
    )
      throw Error('Explicit isolated tenant/store confirmation required.');
    const { assertDevelopmentDatabase } =
      await import('../dist/security/development-foundation.js');
    assertDevelopmentDatabase(process.env.DATABASE_URL, process.env.NODE_ENV);
    const { createDatabase } = await import('../dist/security/database.js');
    db = createDatabase(process.env.DATABASE_URL);
    const actual = (
      await db.$queryRaw`SELECT current_database() AS name,host(inet_server_addr()) AS address`
    )[0];
    if (
      actual.name !== new URL(process.env.DATABASE_URL).pathname.slice(1) ||
      !['127.0.0.1', '::1'].includes(actual.address)
    )
      throw Error('Actual database destination mismatch.');
    const catalog = await import('../../frontend/src/data/products.js');
    const result = await reserveLegacyRoutes(
      db,
      { tenantId, storeId },
      legacyRouteManifest(catalog),
    );
    console.log(
      `PASS ${result.reserved} legacy route reservations prepared in isolated development only.`,
    );
  } catch {
    console.error(
      'Route preparation failed; sensitive diagnostics suppressed.',
    );
    process.exitCode = 1;
  } finally {
    await db?.$disconnect();
  }
}
