import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Separate performance store. No synthetic rows enter the 84-product VOGPK store.
export async function verifyMigrationPerformance({
  db,
  manifest,
  owner,
  ids,
  get,
  output,
}) {
  const tenant = await db.tenant.create({
      data: { slug: 'migration_growth', name: 'Foreign growth fixture' },
    }),
    store = await db.store.create({
      data: {
        tenantId: tenant.id,
        slug: 'growth',
        name: 'Foreign growth store',
      },
    });
  await db.$transaction(
    async (tx) => {
      const type = await tx.productType.create({
          data: {
            tenantId: tenant.id,
            code: 'growth',
            label: 'Synthetic growth inquiry',
          },
        }),
        schema = await tx.productTypeVersion.create({
          data: {
            tenantId: tenant.id,
            productTypeId: type.id,
            number: 1,
            label: 'Growth',
            allowNoSku: true,
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: owner.id,
          },
        });
      const category = await tx.category.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          code: 'foreign',
          name: 'FOREIGN CATEGORY',
          slug: manifest.categories[0].sourceKey,
          media: {},
          seo: {},
          createdBy: owner.id,
          updatedBy: owner.id,
          status: 'ACTIVE',
          activeSnapshot: {
            name: 'FOREIGN CATEGORY',
            slug: manifest.categories[0].sourceKey,
            description: 'Foreign filter/category metadata',
            visible: true,
            inNavigation: true,
            sortOrder: 0,
            media: {},
            seo: {},
            compatibility: 'ANY',
            productTypeIds: [],
          },
        },
      });
      for (let i = 0; i < 284; i++) {
        const source = manifest.records[i],
          code = 'growth_' + i,
          slug = source?.source.product.slug ?? 'growth-' + i,
          name = 'FOREIGN ' + (source?.source.product.name ?? 'growth ' + i);
        const p = await tx.product.create({
            data: {
              tenantId: tenant.id,
              productTypeId: type.id,
              code,
              createdBy: owner.id,
            },
          }),
          pr = await tx.productRevision.create({
            data: {
              tenantId: tenant.id,
              productId: p.id,
              productTypeId: type.id,
              schemaVersionId: schema.id,
              number: 1,
              name: name.slice(0, 120),
              slug,
              sellingMode: 'RFQ',
              createdBy: owner.id,
              updatedBy: owner.id,
            },
          }),
          l = await tx.storeListing.create({
            data: {
              tenantId: tenant.id,
              storeId: store.id,
              productId: p.id,
              code,
              createdBy: owner.id,
            },
          }),
          lr = await tx.listingRevision.create({
            data: {
              tenantId: tenant.id,
              storeId: store.id,
              productId: p.id,
              listingId: l.id,
              productRevisionId: pr.id,
              number: 1,
              title: name.slice(0, 120),
              slug,
              sellingMode: 'RFQ',
              catalogOrder: i,
              featuredOrder: 283 - i,
              createdBy: owner.id,
              updatedBy: owner.id,
            },
          });
        await tx.listingCategory.create({
          data: {
            tenantId: tenant.id,
            storeId: store.id,
            listingRevisionId: lr.id,
            categoryId: category.id,
          },
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
          where: { id: p.id },
          data: { publishedRevisionId: pr.id },
        });
        await tx.storeListing.update({
          where: { id: l.id },
          data: { publishedRevisionId: lr.id },
        });
        await tx.catalogRoute.create({
          data: {
            tenantId: tenant.id,
            storeId: store.id,
            slug,
            ownerKind: 'LISTING',
            listingId: l.id,
            published: true,
          },
        });
      }
    },
    { timeout: 90000 },
  );
  assert.equal((await get('listings?facets=omit')).total, 84);
  assert.equal(
    (await get('products/' + manifest.records[0].source.product.slug)).name,
    manifest.records[0].source.product.name,
  );
  assert.ok(!JSON.stringify(await get('navigation')).includes('FOREIGN'));
  const [
    { StorefrontService },
    { CategoryFiltersService },
    { CategoryService },
    { CategoryUsageService },
    { ScopedAuthorizationService },
    { LocalMediaStorage },
    { PrismaClient, Prisma },
    { PrismaPg },
    { offerCte },
    { query },
  ] = await Promise.all([
    import('../dist/storefront/storefront.service.js'),
    import('../dist/categories/filters.service.js'),
    import('../dist/categories/category.service.js'),
    import('../dist/categories/usage.service.js'),
    import('../dist/security/scoped-authorization.service.js'),
    import('../dist/operations/storage.js'),
    import('../dist/generated/prisma/client.js'),
    import('@prisma/adapter-pg'),
    import('../dist/storefront/sql.js'),
    import('../dist/storefront/query.js'),
  ]);
  const measured = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }),
    log: [{ level: 'query', emit: 'event' }],
  });
  let queryCount = 0;
  measured.$on('query', () => {
    queryCount++;
  });
  const service = new StorefrontService(
    measured,
    new CategoryFiltersService(
      new CategoryService(
        measured,
        new ScopedAuthorizationService(measured),
        new CategoryUsageService(),
      ),
    ),
    new LocalMediaStorage(),
  );
  const previous = process.env.PUBLIC_CATALOG_STORE_ID,
    measurements = [];
  try {
    for (const [label, storeId] of [
      ['imported84', ids.storeId],
      ['isolated284Growth', store.id],
    ]) {
      process.env.PUBLIC_CATALOG_STORE_ID = storeId;
      const counts = [];
      for (const pageSize of [1, 24]) {
        queryCount = 0;
        const start = performance.now(),
          result = await service.list(
            query.parse({ pageSize, facets: 'omit' }),
          );
        assert.equal(result.total, label === 'imported84' ? 84 : 284);
        counts.push(queryCount);
        measurements.push({
          label,
          pageSize,
          total: result.total,
          queryCount,
          durationMs: Math.round(performance.now() - start),
        });
      }
      assert.equal(
        counts[0],
        counts[1],
        'SQL query count must not grow per returned product',
      );
      if (label === 'isolated284Growth') {
        const featured = await service.list(
          query.parse({ collection: 'featured', pageSize: 1, facets: 'omit' }),
        );
        assert.equal(
          featured.items[0].slug,
          'growth-283',
          'Explicit featured order takes precedence over general catalog order',
        );
      }
    }
    process.env.PUBLIC_CATALOG_STORE_ID = ids.storeId;
    const category = manifest.categories.find(
        (c) => c.sourceKey === 'keyboards',
      ),
      data = await service.list(query.parse({ category: category.sourceKey })),
      field = data.filters.find((f) => f.code !== 'brand'),
      value = field.values[0].code;
    const plan = await service.read(async (tx, ctx) => {
      const q = query.parse({
          category: category.sourceKey,
          filters: new URLSearchParams({ [field.code]: value }).toString(),
        }),
        c = await service.contract(tx, ctx, q);
      const result = await tx.$queryRaw(
        Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${offerCte(ctx.storeId, ctx.tenantId, new Date())} ${service.matchingSql(ctx, q, c, [...c.plan.productPredicates.items, ...c.plan.skuPredicate.items])}`,
      );
      return result[0]['QUERY PLAN'][0];
    });
    const nodes = [];
    const visit = (n) => {
      nodes.push({
        type: n['Node Type'],
        rows: n['Actual Rows'],
        ...(n['Index Name'] ? { index: n['Index Name'] } : {}),
      });
      for (const c of n.Plans ?? []) visit(c);
    };
    visit(plan.Plan);
    await fs.writeFile(
      path.join(output, 'performance.json'),
      JSON.stringify(
        {
          passed: true,
          measurements,
          explain: {
            planningMs: plan['Planning Time'],
            executionMs: plan['Execution Time'],
            nodes,
          },
          growth:
            'Separate tenant/store: 84 source-name/slug inquiry shadows plus 200 synthetic inquiries; no synthetic fixtures in real legacy store',
          sameSkuRegression:
            'Separately exercised with real retail multi-variant fixtures in test:storefront',
          snapshot:
            'Existing RepeatableRead transaction and statement/transaction budgets retained',
          cache: 'No persistent catalog cache; per-render dedup only',
          productionAccess: false,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    process.env.PUBLIC_CATALOG_STORE_ID = previous;
    await measured.$disconnect();
  }
}
