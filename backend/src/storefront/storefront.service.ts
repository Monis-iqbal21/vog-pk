import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../security/database.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import { CategoryFiltersService } from '../categories/filters.service.js';
import { queryContract } from '../categories/compiler.js';
import type { Predicate } from '../categories/compiler.js';
import { fail } from '../product-types/validation.js';
import { offerCte, and, predicate } from './sql.js';
import { facetQuery, type CatalogQuery } from './query.js';
import {
  publicGraph,
  mediaDto,
  specifications,
  axesDto,
  selectionsDto,
  type PublicRow,
} from './projection.js';
import { LocalMediaStorage } from '../operations/storage.js';
import { currencyPrecision } from '../operations/money.js';
import { assertDevelopmentDatabase } from '../security/development-foundation.js';
type CategorySnapshot = {
  name: string;
  slug: string;
  description: string;
  visible: boolean;
  inNavigation: boolean;
  sortOrder: number;
  media: unknown;
  seo: { title?: string; description?: string };
  compatibility: string;
  productTypeIds: string[];
};
type Offer = {
  skuRevisionId: string;
  skuId: string;
  currency: string | null;
  amount: Prisma.Decimal | null;
  regularAmount: Prisma.Decimal | null;
  promotion: string | null;
  availability: string;
  quantity: bigint | null;
  policy: string;
};
@Injectable()
export class StorefrontService {
  constructor(
    @Inject(DatabaseService) readonly db: DatabaseService,
    @Inject(CategoryFiltersService) readonly filters: CategoryFiltersService,
    @Inject(LocalMediaStorage) readonly storage: LocalMediaStorage,
  ) {}
  async context(tx: ScopeTransaction) {
    const id = process.env.PUBLIC_CATALOG_STORE_ID;
    if (
      process.env.PUBLIC_CATALOG_MODE !== 'development' ||
      !['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
      !id ||
      !/^[a-f0-9-]{36}$/.test(id)
    )
      throw new ServiceUnavailableException('Dynamic catalog is not enabled.');
    try {
      assertDevelopmentDatabase(process.env.DATABASE_URL, process.env.NODE_ENV);
    } catch {
      throw new ServiceUnavailableException(
        'A loopback development catalog database is required.',
      );
    }
    const store = await tx.store.findFirst({
      where: { id, active: true, tenant: { active: true } },
      select: { id: true, tenantId: true, name: true, currency: true },
    });
    if (!store)
      throw new ServiceUnavailableException('Store catalog is unavailable.');
    return { ...store, kind: 'STORE' as const, storeId: store.id };
  }
  async read<T>(
    fn: (
      tx: ScopeTransaction,
      ctx: Awaited<ReturnType<StorefrontService['context']>>,
    ) => Promise<T>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '8000'`;
        return fn(tx, await this.context(tx));
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  async categoryRows(tx: ScopeTransaction, ctx: StoreContext) {
    const rows = await tx.category.findMany({
      where: {
        storeId: ctx.storeId,
        tenantId: ctx.tenantId,
        status: { not: 'ARCHIVED' },
        activeSnapshot: { not: Prisma.DbNull },
      },
      take: 1001,
    });
    if (rows.length > 1000)
      throw new ServiceUnavailableException('Category bounds exceeded.');
    const eligible = (id: string, seen = new Set<string>()): boolean => {
      const row = rows.find((r) => r.id === id);
      if (
        !row ||
        seen.has(id) ||
        seen.size >= 32 ||
        !(row.activeSnapshot as CategorySnapshot)?.visible
      )
        return false;
      seen.add(id);
      return !row.activeParentId || eligible(row.activeParentId, seen);
    };
    return rows
      .filter((r) => eligible(r.id))
      .map((r) => ({
        id: r.id,
        parentId: r.activeParentId,
        filterSetId: r.activeFilterSetId,
        snapshot: r.activeSnapshot as CategorySnapshot,
      }));
  }
  categoryDto(
    row: Awaited<ReturnType<StorefrontService['categoryRows']>>[number],
  ) {
    const s = row.snapshot;
    return {
      id: row.id,
      parentId: row.parentId,
      name: s.name,
      slug: s.slug,
      description: s.description,
      image: this.categoryImage(s.media),
      sortOrder: s.sortOrder,
      inNavigation: s.inNavigation,
      seo: s.seo,
      path: `/products/${s.slug}`,
    };
  }
  categoryImage(value: unknown) {
    const media = value as { imagePath?: string; alt?: string };
    const approved = (process.env.PUBLIC_CATEGORY_MEDIA_PATHS ?? '')
      .split(',')
      .filter((p) =>
        /^\/images\/storefront-fixtures\/[a-z0-9-]+\.(webp|png)$/.test(p),
      );
    return media?.imagePath && approved.includes(media.imagePath)
      ? { src: media.imagePath, alt: media.alt ?? '' }
      : null;
  }
  navigation() {
    return this.read(async (tx, ctx) => ({
      version: 1,
      store: { name: ctx.name, currency: ctx.currency },
      categories: (await this.categoryRows(tx, ctx))
        .map((r) => this.categoryDto(r))
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
        ),
    }));
  }
  async contract(tx: ScopeTransaction, ctx: StoreContext, q: CatalogQuery) {
    const categories = await this.categoryRows(tx, ctx),
      category = q.category
        ? categories.find((r) => r.snapshot.slug === q.category)
        : null;
    if (q.category && !category)
      throw new NotFoundException('Category not found.');
    const choices = facetQuery(q.filters);
    if (Object.keys(choices).length && !category?.filterSetId)
      fail('No active filters for this category.');
    if (category?.filterSetId && !(q.facets === 'omit' && !q.filters)) {
      const c = await this.filters.contract(
        tx,
        ctx,
        category.id,
        category.filterSetId,
        choices,
        true,
      );
      c.plan.category.ids = c.plan.category.ids.filter((id) =>
        categories.some((r) => r.id === id),
      );
      const brandFilters = new Set(
        c.filters.filter((f) => f.source === 'BRAND').map((f) => f.code),
      );
      if (brandFilters.size) {
        const brands = await tx.catalogBrand.findMany({
          where: {
            tenantId: ctx.tenantId,
            code: {
              in: c.publicDefinition
                .filter((f) => brandFilters.has(f.code))
                .flatMap((f) => f.values.map((v) => v.code)),
            },
          },
          select: { code: true, name: true },
        });
        c.publicDefinition = c.publicDefinition.map((f) =>
          brandFilters.has(f.code)
            ? {
                ...f,
                values: f.values.map((value) => ({
                  ...value,
                  label:
                    brands.find((b) => b.code === value.code)?.name ??
                    value.label,
                })),
              }
            : f,
        );
      }
      return { ...c, categories, category };
    }
    const config = category?.filterSetId
      ? await tx.categoryFilterSet.findFirst({
          where: {
            id: category.filterSetId,
            storeId: ctx.storeId,
            status: 'ACTIVE',
          },
          select: { includeDescendants: true },
        })
      : null;
    const ids = category
      ? categories
          .filter((c) => {
            if (config && !config.includeDescendants)
              return c.id === category.id;
            let r: typeof c | undefined = c;
            for (
              let n = 0;
              r && n < 32;
              n++, r = categories.find((p) => p.id === r!.parentId)
            )
              if (r.id === category.id) return true;
            return false;
          })
          .map((c) => c.id)
      : categories.map((c) => c.id);
    return {
      plan: queryContract(
        [],
        {},
        {},
        ids,
        category
          ? {
              mode: category.snapshot.compatibility,
              productTypeIds: category.snapshot.productTypeIds,
            }
          : { mode: 'ANY', productTypeIds: [] },
      ),
      publicDefinition: [],
      filters: [],
      categories,
      category,
    };
  }
  base(ctx: StoreContext, categoryIds: string[], q: CatalogQuery) {
    return and([
      Prisma.sql`lr."storeId"=${ctx.storeId}::uuid AND lr."tenantId"=${ctx.tenantId}::uuid AND lr.status='PUBLISHED' AND lr.visible AND lr."approvedAt" IS NOT NULL AND lr."publishedAt" IS NOT NULL AND NOT root.archived AND root."publishedRevisionId"=lr.id AND NOT product.archived AND pr."approvedAt" IS NOT NULL AND (pr.status IN ('APPROVED','PUBLISHED') OR pr."publishedAt" IS NOT NULL) AND schema.status IN ('APPROVED','ACTIVE')`,
      Prisma.sql`NOT EXISTS(SELECT 1 FROM "ProductAttributeBinding" axis JOIN "AttributeDefinition" ad ON ad.id=axis."attributeId" LEFT JOIN "OptionSet" os ON os.id=ad."optionSetId" WHERE axis."productRevisionId"=pr.id AND axis.axis AND (ad.status<>'ACTIVE' OR ad.visibility->>'storefront'<>'true' OR axis.snapshot->'visibility'->>'storefront'<>'true' OR os.status='ARCHIVED'))`,
      categoryIds.length
        ? Prisma.sql`EXISTS(SELECT 1 FROM "ListingCategory" lc WHERE lc."listingRevisionId"=lr.id AND lc."categoryId" IN (${Prisma.join(categoryIds.map((id) => Prisma.sql`${id}::uuid`))}))`
        : Prisma.sql`FALSE`,
      ...(q.search
        ? [
            Prisma.sql`lr.title ILIKE ${'%' + q.search.replace(/[\\%_]/g, '\\$&') + '%'}`,
          ]
        : []),
      ...(q.collection === 'featured'
        ? [Prisma.sql`lr."featuredOrder" IS NOT NULL`]
        : q.collection === 'new-arrivals'
          ? [Prisma.sql`lr."newArrivalOrder" IS NOT NULL`]
          : []),
      ...(q.related
        ? [
            Prisma.sql`lr.slug<>${q.related} AND EXISTS(SELECT 1 FROM "ListingRevision" related JOIN "StoreListing" rr ON rr."publishedRevisionId"=related.id AND NOT rr.archived JOIN "ProductRevision" rp ON rp.id=related."productRevisionId" JOIN "Product" rproduct ON rproduct.id=rp."productId" AND NOT rproduct.archived WHERE related.slug=${q.related} AND related."storeId"=${ctx.storeId}::uuid AND related.status='PUBLISHED' AND related.visible AND EXISTS(SELECT 1 FROM "ListingCategory" a JOIN "ListingCategory" b ON a."categoryId"=b."categoryId" WHERE a."listingRevisionId"=related.id AND b."listingRevisionId"=lr.id))`,
          ]
        : []),
    ]);
  }
  joins() {
    return Prisma.sql`FROM "ListingRevision" lr JOIN "StoreListing" root ON root.id=lr."listingId" JOIN "ProductRevision" pr ON pr.id=lr."productRevisionId" JOIN "Product" product ON product.id=pr."productId" JOIN "ProductTypeVersion" schema ON schema.id=pr."schemaVersionId" LEFT JOIN "CatalogBrand" b ON b.id=pr."brandId" LEFT JOIN "ListingSKU" ls ON ls."listingRevisionId"=lr.id LEFT JOIN "SKURevision" sr ON sr.id=ls."skuRevisionId" AND sr.state='ACTIVE' LEFT JOIN offers o ON o."skuRevisionId"=sr.id`;
  }
  async matches(
    tx: ScopeTransaction,
    ctx: StoreContext,
    q: CatalogQuery,
    c: Awaited<ReturnType<StorefrontService['contract']>>,
    predicates: Predicate[],
    now: Date,
    onlySlug?: string,
  ) {
    return tx.$queryRaw<
      { id: string; amount: Prisma.Decimal | null; skus: string[] }[]
    >(
      Prisma.sql`${offerCte(ctx.storeId, ctx.tenantId, now)} ${this.matchingSql(ctx, q, c, predicates, onlySlug)} LIMIT 10001`,
    );
  }
  matchingSql(
    ctx: StoreContext,
    q: CatalogQuery,
    c: Awaited<ReturnType<StorefrontService['contract']>>,
    predicates: Predicate[],
    onlySlug?: string,
  ) {
    const product = predicates.filter((p) => p.level === 'PRODUCT'),
      sku = predicates.filter((p) => p.level === 'SKU'),
      base = this.base(ctx, c.plan.category.ids, q),
      policy = c.plan.category.policy;
    return Prisma.sql`SELECT lr.id,MIN(CASE WHEN lr."sellingMode"='RETAIL' THEN o.amount END) AS amount,array_agg(DISTINCT o."skuRevisionId") FILTER(WHERE o."skuRevisionId" IS NOT NULL) AS skus ${this.joins()} WHERE ${base} AND ${onlySlug ? Prisma.sql`lr.slug=${onlySlug}` : Prisma.sql`TRUE`} AND ${and(product.map(predicate))} AND ${policy.mode === 'ANY' ? Prisma.sql`TRUE` : policy.productTypeIds.length ? Prisma.sql`pr."productTypeId" IN (${Prisma.join(policy.productTypeIds.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.sql`FALSE`} AND ((o."skuRevisionId" IS NOT NULL AND ${and(sku.map(predicate))}) OR (${sku.length === 0} AND schema."allowNoSku" AND lr."sellingMode" IN ('RFQ','INFORMATIONAL') AND ls."skuRevisionId" IS NULL)) GROUP BY lr.id`;
  }
  async ownedRows(tx: ScopeTransaction, ids: string[]) {
    return tx.listingRevision.findMany({
      where: { id: { in: ids } },
      include: publicGraph,
    });
  }
  card(
    row: PublicRow,
    offers: Offer[],
    categories: Awaited<ReturnType<StorefrontService['categoryRows']>>,
  ) {
    const valid = offers.filter((o) =>
        row.skus.some((s) => s.skuRevisionId === o.skuRevisionId),
      ),
      best =
        row.sellingMode === 'RETAIL'
          ? valid
              .filter((o) => o.amount !== null)
              .sort((a, b) => a.amount!.comparedTo(b.amount!))[0]
          : null;
    return {
      id: row.listingId,
      legacyId:
        row.listing.importRecords.find(
          (r) => r.sourceKey === row.productRevision.product.externalReference,
        )?.sourceKey ?? null,
      referencePrice:
        row.sellingMode === 'REFERENCE' &&
        row.listing.importRecords[0]?.referenceAmount != null &&
        (row.listing.importRecords[0].mapping as { listingRevisionId?: string })
          .listingRevisionId === row.id
          ? {
              currency: 'PKR',
              minorUnits: 2,
              amount: row.listing.importRecords[0].referenceAmount.toString(),
              approved: false as const,
            }
          : null,
      slug: row.slug,
      path: `/products/${row.slug}`,
      name: row.title,
      description: row.productRevision.description,
      brand: row.productRevision.brand?.name ?? '',
      sellingMode: row.sellingMode,
      offer: best
        ? {
            currency: best.currency!,
            minorUnits: currencyPrecision(best.currency!),
            amount: best.amount!.toString(),
            regularAmount: best.regularAmount!.toString(),
            promotion: best.promotion,
          }
        : null,
      availability:
        valid.some((o) => o.amount && o.availability === 'in_stock') &&
        row.sellingMode === 'RETAIL'
          ? 'in_stock'
          : valid.some((o) => o.amount && o.availability === 'out_of_stock') &&
              row.sellingMode === 'RETAIL'
            ? 'out_of_stock'
            : 'unknown',
      media: mediaDto(row)
        .filter((m) => m.purpose === 'GALLERY')
        .slice(0, 1),
      categories: categories
        .filter((c) => row.categories.some((r) => r.categoryId === c.id))
        .map((c) => this.categoryDto(c)),
      purchasable: false as const,
    };
  }
  list(q: CatalogQuery) {
    return this.read(async (tx, ctx) => {
      const now = new Date(),
        c = await this.contract(tx, ctx, q),
        predicates = [
          ...c.plan.productPredicates.items,
          ...c.plan.skuPredicate.items,
        ];
      const ordering =
        q.sort === 'name'
          ? Prisma.sql`lr.title ASC`
          : q.sort === 'price-asc'
            ? Prisma.sql`m.amount ASC NULLS LAST`
            : q.sort === 'price-desc'
              ? Prisma.sql`m.amount DESC NULLS LAST`
              : q.sort === 'newest'
                ? Prisma.sql`lr."publishedAt" DESC`
                : q.collection === 'new-arrivals'
                  ? Prisma.sql`lr."newArrivalOrder" ASC NULLS LAST`
                  : q.collection === 'featured'
                    ? Prisma.sql`lr."featuredOrder" ASC NULLS LAST`
                    : Prisma.sql`COALESCE(lr."catalogOrder",lr."featuredOrder") ASC NULLS LAST`;
      const [selection] = await tx.$queryRaw<
        { items: { id: string; skus: string[] | null }[]; total: number }[]
      >(
        Prisma.sql`${offerCte(ctx.storeId, ctx.tenantId, now)}, matched AS (${this.matchingSql(ctx, q, c, predicates)}) SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'skus',p.skus)) FROM (SELECT m.id,m.skus FROM matched m JOIN "ListingRevision" lr ON lr.id=m.id ORDER BY ${ordering},m.id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize})p),'[]'::jsonb) AS items,(SELECT COUNT(*)::int FROM matched) AS total`,
      );
      if (selection.total > 10000)
        throw new ServiceUnavailableException(
          'Catalog query exceeds development limit.',
        );
      const page = selection.items,
        rows = await this.ownedRows(
          tx,
          page.map((r) => r.id),
        ),
        skuIds = rows.flatMap((r) => r.skus.map((s) => s.skuRevisionId));
      const offers = skuIds.length
        ? await tx.$queryRaw<Offer[]>(
            Prisma.sql`${offerCte(ctx.storeId, ctx.tenantId, now)} SELECT * FROM offers WHERE "skuRevisionId" IN (${Prisma.join(skuIds.map((id) => Prisma.sql`${id}::uuid`))})`,
          )
        : [];
      const facets: {
          code: string;
          values: { code: string; count: number }[];
        }[] = [],
        countQueries: Prisma.Sql[] = [];
      for (const field of c.filters.filter(
        (f) => f.visible && q.facets !== 'omit',
      )) {
        if (field.snapshot.control === 'number_range') {
          facets.push({ code: field.code, values: [] });
          continue;
        }
        facets.push({ code: field.code, values: [] });
        for (const value of field.snapshot.values) {
          const selections = facetQuery(c.plan.canonicalQuery);
          for (const alias of [field.code, ...field.snapshot.aliases])
            delete selections[alias];
          selections[field.code] = [value.code];
          const plan = queryContract(
            c.filters,
            selections,
            {},
            c.plan.category.ids,
            c.plan.category.policy,
          );
          countQueries.push(
            Prisma.sql`SELECT ${field.code}::text AS code,${value.code}::text AS value,COUNT(*)::int AS count FROM (${this.matchingSql(ctx, q, c, [...plan.productPredicates.items, ...plan.skuPredicate.items])}) f`,
          );
        }
      }
      if (countQueries.length > 256)
        throw new ServiceUnavailableException(
          'Facet configuration exceeds the reviewed query budget.',
        );
      if (countQueries.length) {
        const counts = await tx.$queryRaw<
          { code: string; value: string; count: number }[]
        >(
          Prisma.sql`${offerCte(ctx.storeId, ctx.tenantId, now)} ${Prisma.join(countQueries, ' UNION ALL ')}`,
        );
        for (const count of counts)
          facets
            .find((f) => f.code === count.code)!
            .values.push({ code: count.value, count: count.count });
      }
      return {
        version: 1,
        store: { name: ctx.name, currency: ctx.currency },
        category: c.category ? this.categoryDto(c.category) : null,
        categories: c.categories.map((r) => this.categoryDto(r)),
        items: page.map((p) =>
          this.card(
            rows.find((r) => r.id === p.id)!,
            offers.filter((o) => (p.skus ?? []).includes(o.skuRevisionId)),
            c.categories,
          ),
        ),
        total: selection.total,
        page: q.page,
        pageSize: q.pageSize,
        sort: q.sort,
        filters: c.publicDefinition,
        facets,
        canonicalFilters: c.plan.canonicalQuery,
        evaluatedAt: now.toISOString(),
        purchasable: false,
      };
    });
  }
  detail(slug: string, variant?: string) {
    return this.read(async (tx, ctx) => {
      const categories = await this.categoryRows(tx, ctx),
        q = {
          page: 1,
          pageSize: 1,
          sort: 'editorial' as const,
          search: '',
          filters: '',
          facets: 'omit' as const,
        },
        c = await this.contract(tx, ctx, q),
        ids = await this.matches(tx, ctx, q, c, [], new Date(), slug),
        row = (
          await this.ownedRows(
            tx,
            ids.map((r) => r.id),
          )
        ).find((r) => r.slug === slug);
      if (!row) throw new NotFoundException('Product not found.');
      const offers = await tx.$queryRaw<Offer[]>(
        Prisma.sql`${offerCte(ctx.storeId, ctx.tenantId, new Date())} SELECT * FROM offers WHERE "skuRevisionId" IN (SELECT "skuRevisionId" FROM "ListingSKU" WHERE "listingRevisionId"=${row.id}::uuid)`,
      );
      const skus = row.productRevision.skus.filter(
        (s) =>
          s.state === 'ACTIVE' &&
          !s.sku.archived &&
          row.skus.some((p) => p.skuRevisionId === s.id),
      );
      if (variant && !skus.some((s) => s.sku.code === variant))
        throw new NotFoundException('Variant is not offered.');
      return {
        version: 1,
        ...this.card(row, offers, categories),
        content: row.productRevision.content,
        seo: row.seo,
        axes: axesDto(row),
        specifications: specifications(row),
        media: mediaDto(row),
        selectedVariant:
          variant ?? (skus.length === 1 ? skus[0].sku.code : null),
        variants: skus.map((s) => {
          const offer = offers.find((o) => o.skuRevisionId === s.id),
            selling =
              row.sellingMode === 'RETAIL' &&
              offer?.amount !== null &&
              offer?.amount !== undefined;
          return {
            code: s.sku.code,
            selections: selectionsDto(row, s),
            offer: selling
              ? {
                  currency: offer!.currency!,
                  minorUnits: currencyPrecision(offer!.currency!),
                  amount: offer!.amount!.toString(),
                  regularAmount: offer!.regularAmount!.toString(),
                  promotion: offer!.promotion,
                }
              : null,
            availability: selling ? offer!.availability : 'not_offered',
            inventoryPolicy: offer?.policy ?? 'UNTRACKED',
            media: mediaDto(row, s.id),
            specifications: specifications(row, s.id),
          };
        }),
        checkout: 'DISABLED',
      };
    });
  }
  route(slug: string) {
    return this.read(async (tx, ctx) => {
      const route = await tx.catalogRoute.findUnique({
        where: { storeId_slug: { storeId: ctx.storeId, slug } },
      });
      if (!route?.published) throw new NotFoundException('Route not found.');
      if (route.categoryId) {
        const row = (await this.categoryRows(tx, ctx)).find(
          (c) => c.id === route.categoryId,
        );
        if (row)
          return {
            kind: 'category',
            slug: row.snapshot.slug,
            redirect: slug !== row.snapshot.slug,
            path: `/products/${row.snapshot.slug}`,
          };
      }
      if (route.listingId) {
        const row = await tx.listingRevision.findFirst({
          where: {
            listingId: route.listingId,
            status: 'PUBLISHED',
            visible: true,
            listing: { archived: false },
          },
        });
        const q = {
          page: 1,
          pageSize: 1,
          sort: 'editorial' as const,
          search: '',
          filters: '',
          facets: 'omit' as const,
        };
        const valid = row
          ? await this.matches(
              tx,
              ctx,
              q,
              await this.contract(tx, ctx, q),
              [],
              new Date(),
              row.slug,
            )
          : [];
        if (row && valid.some((v) => v.id === row.id))
          return {
            kind: 'product',
            slug: row.slug,
            redirect: slug !== row.slug,
            path: `/products/${row.slug}`,
          };
      }
      throw new NotFoundException('Route not found.');
    });
  }
  async media(slug: string, assetId: string, width: number) {
    return this.read(async (tx, ctx) => {
      const q = {
          page: 1,
          pageSize: 1,
          sort: 'editorial' as const,
          search: '',
          filters: '',
          facets: 'omit' as const,
        },
        ids = await this.matches(
          tx,
          ctx,
          q,
          await this.contract(tx, ctx, q),
          [],
          new Date(),
          slug,
        ),
        row = (
          await this.ownedRows(
            tx,
            ids.map((r) => r.id),
          )
        )[0];
      const allowed = row
        ? [
            ...mediaDto(row),
            ...row.productRevision.skus
              .filter(
                (s) =>
                  s.state === 'ACTIVE' &&
                  !s.sku.archived &&
                  row.skus.some((pin) => pin.skuRevisionId === s.id),
              )
              .flatMap((s) => mediaDto(row, s.id)),
          ]
        : [];
      if (!allowed.some((m) => m.assetId === assetId))
        throw new NotFoundException('Public image not found.');
      return this.storage.read(ctx.tenantId, assetId, width);
    });
  }
}
