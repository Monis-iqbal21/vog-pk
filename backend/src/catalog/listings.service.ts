import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import {
  CategoryService,
  json,
  stale,
  ownership,
} from '../categories/category.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
import * as v from './validation.js';
import type { z } from 'zod';
const graph = {
  media: { include: { skuMedia: true, productMedia: true } },
  categories: true,
  skus: { include: { skuRevision: { include: { sku: true } } } },
  productRevision: {
    select: {
      id: true,
      name: true,
      status: true,
      number: true,
      sellingMode: true,
      productTypeId: true,
    },
  },
};
@Injectable()
export class ListingsService {
  constructor(
    @Inject(ProductsService) readonly products: ProductsService,
    @Inject(CategoryService) readonly categories: CategoryService,
  ) {}
  async catalog(actor: string, storeId: string, query: z.infer<typeof v.list>) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view');
    const where = {
      tenantId: ctx.tenantId,
      approvedAt: { not: null },
      status: { in: ['APPROVED', 'PUBLISHED'] as ('APPROVED' | 'PUBLISHED')[] },
      product: { archived: false },
      name: { contains: query.search, mode: 'insensitive' as const },
    };
    return {
      items: await this.products.db.productRevision.findMany({
        where,
        select: {
          id: true,
          productId: true,
          name: true,
          slug: true,
          number: true,
          sellingMode: true,
          skus: {
            where: { state: 'ACTIVE', sku: { archived: false } },
            select: { id: true, skuId: true, sku: { select: { code: true } } },
          },
        },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        orderBy: [{ name: 'asc' }, { number: 'desc' }],
      }),
      total: await this.products.db.productRevision.count({ where }),
    };
  }
  async categoryOptions(actor: string, storeId: string) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view');
    const rows = await this.categories.graph(this.products.db, ctx);
    return this.categories.treeRows(rows, { view: 'active', maxDepth: 32 });
  }
  async root(tx: ScopeTransaction, ctx: StoreContext, id: string) {
    const root = await tx.storeListing.findFirst({
      where: { id, ...ownership(ctx) },
    });
    if (!root) throw new NotFoundException('Listing not found.');
    return root;
  }
  async row(
    tx: ScopeTransaction,
    ctx: StoreContext,
    listingId: string,
    id: string,
  ) {
    const row = await tx.listingRevision.findFirst({
      where: { id, listingId, ...ownership(ctx) },
      include: graph,
    });
    if (!row) throw new NotFoundException('Listing revision not found.');
    return row;
  }
  audit(
    tx: ScopeTransaction,
    actor: string,
    ctx: StoreContext,
    action: string,
    id: string,
  ) {
    return this.products.auth.audit(tx, actor, ctx, 'listing.' + action, id);
  }
  async list(actor: string, storeId: string, query: z.infer<typeof v.list>) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view');
    const where = {
      ...ownership(ctx),
      ...(query.status === 'ARCHIVED' ? { archived: true } : {}),
      revisions: {
        some: {
          title: { contains: query.search, mode: 'insensitive' as const },
          ...(query.status && query.status !== 'ARCHIVED'
            ? { status: query.status }
            : {}),
        },
      },
    };
    return {
      items: await this.products.db.storeListing.findMany({
        where,
        include: {
          revisions: {
            select: {
              id: true,
              number: true,
              revision: true,
              title: true,
              status: true,
            },
            orderBy: { number: 'desc' },
            take: 5,
          },
        },
        orderBy: { code: 'asc' },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
      }),
      total: await this.products.db.storeListing.count({ where }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(actor: string, storeId: string, listingId: string, id?: string) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view'),
      root = await this.root(this.products.db, ctx, listingId);
    if (id)
      return {
        ...(await this.row(this.products.db, ctx, listingId, id)),
        rootRevision: root.revision,
      };
    return {
      ...root,
      revisions: await this.products.db.listingRevision.findMany({
        where: { listingId, ...ownership(ctx) },
        select: {
          id: true,
          number: true,
          revision: true,
          status: true,
          title: true,
        },
        take: 25,
        orderBy: { number: 'desc' },
      }),
    };
  }
  async validate(
    tx: ScopeTransaction,
    ctx: StoreContext,
    input: z.infer<typeof v.listingSave> | z.infer<typeof v.listingCreate>,
    productId?: string,
    publication = false,
  ) {
    const revision = await tx.productRevision.findFirst({
      where: {
        id: input.productRevisionId,
        tenantId: ctx.tenantId,
        approvedAt: { not: null },
        OR: [
          { status: { in: ['APPROVED', 'PUBLISHED'] } },
          { publishedAt: { not: null } },
        ],
      },
      include: {
        product: true,
        skus: { include: { sku: true } },
        schema: true,
      },
    });
    if (
      !revision ||
      revision.product.archived ||
      (productId && revision.productId !== productId)
    )
      fail(
        'Listing must pin an approved product revision in this store tenant.',
      );
    if (
      new Set(input.categoryIds).size !== input.categoryIds.length ||
      new Set(input.skuRevisionIds).size !== input.skuRevisionIds.length
    )
      fail('Duplicate listing assignments.');
    if (
      input.skuRevisionIds.some(
        (id) =>
          !revision.skus.some(
            (s) => s.id === id && s.state === 'ACTIVE' && !s.sku.archived,
          ),
      )
    )
      fail(
        'Listing SKU pins must belong to the exact approved product revision.',
      );
    if (
      !input.skuRevisionIds.length &&
      !(
        revision.schema.allowNoSku &&
        ['RFQ', 'INFORMATIONAL'].includes(revision.sellingMode)
      )
    )
      fail('This listing policy requires at least one approved SKU pin.');
    if (publication && !input.categoryIds.length)
      fail(
        'Assign at least one published category before listing publication.',
      );
    for (const id of input.categoryIds) {
      const category = await tx.category.findFirst({
        where: { id, ...ownership(ctx), status: { not: 'ARCHIVED' } },
      });
      if (!category) fail('Choose categories belonging to this store.');
      const snapshot = category.activeSnapshot as {
        compatibility: string;
        productTypeIds: string[];
      } | null;
      if (publication && !snapshot) fail('Publish assigned categories first.');
      const compatibility = publication
          ? snapshot!.compatibility
          : category.compatibility,
        types = publication
          ? snapshot!.productTypeIds
          : (
              await tx.categoryAllowedType.findMany({
                where: { categoryId: id, ...ownership(ctx) },
              })
            ).map((t) => t.productTypeId);
      if (
        compatibility === 'ALLOW_LIST' &&
        !types.includes(revision.productTypeId)
      )
        fail('Product Type is incompatible with an assigned category.');
    }
    return revision;
  }
  async history(
    actor: string,
    storeId: string,
    listingId: string,
    q: z.infer<typeof v.list>,
  ) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view');
    await this.root(this.products.db, ctx, listingId);
    const where = { ...ownership(ctx), listingId };
    return {
      items: await this.products.db.listingRevision.findMany({
        where,
        select: {
          id: true,
          number: true,
          revision: true,
          status: true,
          title: true,
        },
        orderBy: { number: 'desc' },
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      total: await this.products.db.listingRevision.count({ where }),
    };
  }
  async reserve(
    tx: ScopeTransaction,
    ctx: StoreContext,
    slug: string,
    listingId: string,
  ) {
    const route = await tx.catalogRoute.findUnique({
      where: { storeId_slug: { storeId: ctx.storeId, slug } },
    });
    if (
      route &&
      (route.ownerKind !== 'LISTING' || route.listingId !== listingId)
    )
      throw new ConflictException(
        'Slug is reserved by another catalog identity.',
      );
    if (!route)
      await tx.catalogRoute.create({
        data: { ...ownership(ctx), slug, ownerKind: 'LISTING', listingId },
      });
  }
  async validateMedia(
    tx: ScopeTransaction,
    ctx: StoreContext,
    row: Awaited<ReturnType<ListingsService['row']>>,
  ) {
    const media = await tx.listingRevisionMedia.findMany({
      where: { listingRevisionId: row.id, ...ownership(ctx) },
      include: {
        productMedia: { include: { asset: true } },
        skuMedia: { include: { asset: true } },
      },
    });
    for (const reference of media) {
      const source = reference.productMedia ?? reference.skuMedia;
      if (
        !source ||
        source.purpose !== reference.purpose ||
        source.asset.archived ||
        source.asset.rights !== 'APPROVED' ||
        (reference.visible && !source.visible)
      )
        fail(
          'Listing media requires an approved, visible source and matching purpose.',
        );
      if (
        reference.skuMedia &&
        !row.skus.some(
          (s) => s.skuRevisionId === reference.skuMedia!.skuRevisionId,
        )
      )
        fail('Variant posters must belong to a selected listing SKU.');
    }
  }
  async persist(
    tx: ScopeTransaction,
    ctx: StoreContext,
    actor: string,
    row: Awaited<ReturnType<ListingsService['row']>>,
    input: z.infer<typeof v.listingSave> | z.infer<typeof v.listingCreate>,
  ) {
    const revision = await this.validate(tx, ctx, input, row.productId);
    if (row.media.length && row.productRevisionId !== revision.id)
      throw new ConflictException(
        'Review and replace pinned media presentation before changing its product revision; media editing is deferred to Milestone 5.',
      );
    await this.reserve(tx, ctx, input.slug, row.listingId);
    await tx.listingCategory.deleteMany({
      where: { listingRevisionId: row.id, ...ownership(ctx) },
    });
    await tx.listingSKU.deleteMany({
      where: { listingRevisionId: row.id, tenantId: ctx.tenantId },
    });
    await tx.listingRevision.update({
      where: { id: row.id },
      data: {
        productRevisionId: revision.id,
        title: input.title,
        slug: input.slug,
        visible: input.visible,
        seo: json(input.seo),
        sellingMode: revision.sellingMode,
        featuredOrder: input.featuredOrder,
        newArrivalOrder: input.newArrivalOrder,
        revision: { increment: 1 },
        updatedBy: actor,
      },
    });
    if (input.categoryIds.length)
      await tx.listingCategory.createMany({
        data: input.categoryIds.map((categoryId) => ({
          ...ownership(ctx),
          listingRevisionId: row.id,
          categoryId,
        })),
      });
    if (input.skuRevisionIds.length)
      await tx.listingSKU.createMany({
        data: input.skuRevisionIds.map((skuRevisionId) => ({
          tenantId: ctx.tenantId,
          listingRevisionId: row.id,
          productId: row.productId,
          productRevisionId: revision.id,
          skuRevisionId,
        })),
      });
    return this.row(tx, ctx, row.listingId, row.id);
  }
  create(
    actor: string,
    storeId: string,
    input: z.infer<typeof v.listingCreate>,
  ) {
    return this.categories.write(
      actor,
      storeId,
      'listings.create',
      async (tx, ctx) => {
        await this.products.auth.require(
          actor,
          ctx,
          ['listings.assign-categories'],
          tx,
        );
        const revision = await this.validate(tx, ctx, input);
        const root = await tx.storeListing.create({
          data: {
            ...ownership(ctx),
            productId: revision.productId,
            code: input.code,
            createdBy: actor,
          },
        });
        const row = await tx.listingRevision.create({
          data: {
            ...ownership(ctx),
            listingId: root.id,
            productId: revision.productId,
            productRevisionId: revision.id,
            number: 1,
            title: input.title,
            slug: input.slug,
            sellingMode: revision.sellingMode,
            createdBy: actor,
            updatedBy: actor,
          },
        });
        const result = await this.persist(
          tx,
          ctx,
          actor,
          await this.row(tx, ctx, root.id, row.id),
          input,
        );
        await this.audit(tx, actor, ctx, 'created', root.id);
        return { ...result, rootRevision: root.revision };
      },
    );
  }
  save(
    actor: string,
    storeId: string,
    listingId: string,
    id: string,
    input: z.infer<typeof v.listingSave>,
  ) {
    return this.categories.write(
      actor,
      storeId,
      'listings.update',
      async (tx, ctx) => {
        const root = await this.root(tx, ctx, listingId),
          row = await this.row(tx, ctx, listingId, id);
        if (root.archived || row.status !== 'DRAFT')
          throw new ConflictException(
            'Clone approved listing facts before editing.',
          );
        if (row.revision !== input.revision) stale();
        if (
          JSON.stringify([...input.categoryIds].sort()) !==
          JSON.stringify(row.categories.map((c) => c.categoryId).sort())
        )
          await this.products.auth.require(
            actor,
            ctx,
            ['listings.assign-categories'],
            tx,
          );
        const result = await this.persist(tx, ctx, actor, row, input);
        await this.audit(tx, actor, ctx, 'draft_saved', id);
        return { ...result, rootRevision: root.revision };
      },
    );
  }
  clone(
    actor: string,
    storeId: string,
    listingId: string,
    id: string,
    revision: number,
  ) {
    return this.categories.write(
      actor,
      storeId,
      'listings.update',
      async (tx, ctx) => {
        const root = await this.root(tx, ctx, listingId),
          source = await this.row(tx, ctx, listingId, id);
        if (source.revision !== revision) stale();
        if (
          root.archived ||
          source.status === 'DRAFT' ||
          (await tx.listingRevision.count({
            where: { listingId, status: 'DRAFT', ...ownership(ctx) },
          }))
        )
          throw new ConflictException(
            'Edit the existing draft or choose an active listing.',
          );
        const last = await tx.listingRevision.findFirstOrThrow({
          where: { listingId, ...ownership(ctx) },
          orderBy: { number: 'desc' },
        });
        const row = await tx.listingRevision.create({
          data: {
            ...ownership(ctx),
            listingId,
            productId: source.productId,
            productRevisionId: source.productRevisionId,
            number: last.number + 1,
            title: source.title,
            slug: source.slug,
            visible: source.visible,
            sellingMode: source.sellingMode,
            seo: source.seo!,
            featuredOrder: source.featuredOrder,
            newArrivalOrder: source.newArrivalOrder,
            createdBy: actor,
            updatedBy: actor,
          },
        });
        if (source.categories.length)
          await tx.listingCategory.createMany({
            data: source.categories.map((c) => ({
              ...ownership(ctx),
              listingRevisionId: row.id,
              categoryId: c.categoryId,
            })),
          });
        for (const media of source.media) {
          const {
            id: _,
            listingRevisionId: __,
            skuMedia: ___,
            productMedia: ____,
            ...reference
          } = media;
          await tx.listingRevisionMedia.create({
            data: {
              ...reference,
              listingRevisionId: row.id,
              presentation: media.presentation!,
            },
          });
        }
        if (source.skus.length)
          await tx.listingSKU.createMany({
            data: source.skus.map((s) => ({
              tenantId: ctx.tenantId,
              listingRevisionId: row.id,
              productId: source.productId,
              productRevisionId: source.productRevisionId,
              skuRevisionId: s.skuRevisionId,
            })),
          });
        await this.audit(tx, actor, ctx, 'draft_cloned', row.id);
        return {
          ...(await this.row(tx, ctx, listingId, row.id)),
          rootRevision: root.revision,
        };
      },
    );
  }
  async compare(actor: string, storeId: string, listingId: string, id: string) {
    const ctx = await this.categories.context(actor, storeId, 'listings.view'),
      root = await this.root(this.products.db, ctx, listingId),
      row = await this.row(this.products.db, ctx, listingId, id);
    const previous = root.publishedRevisionId
      ? await this.row(
          this.products.db,
          ctx,
          listingId,
          root.publishedRevisionId,
        )
      : null;
    let validation;
    try {
      await this.validateMedia(this.products.db, ctx, row);
      await this.validate(
        this.products.db,
        ctx,
        {
          ...row,
          revision: row.revision,
          categoryIds: row.categories.map((c) => c.categoryId),
          skuRevisionIds: row.skus.map((s) => s.skuRevisionId),
          seo: row.seo as { title: string; description: string },
        },
        row.productId,
        true,
      );
      validation = { valid: true };
    } catch (e) {
      validation = {
        valid: false,
        message:
          e instanceof Error && 'getStatus' in e
            ? e.message
            : 'Validation unavailable.',
      };
    }
    return {
      rootRevision: root.revision,
      validation,
      previousRevisionId: previous?.id ?? null,
      changed: (
        [
          'productRevisionId',
          'title',
          'slug',
          'visible',
          'sellingMode',
          'seo',
          'featuredOrder',
          'newArrivalOrder',
        ] as const
      ).filter((k) => JSON.stringify(row[k]) !== JSON.stringify(previous?.[k])),
      categoryIds: row.categories.map((c) => c.categoryId),
      purchasable: false,
      pricing: 'NOT_IMPLEMENTED',
      inventory: 'NOT_IMPLEMENTED',
    };
  }
  transition(
    actor: string,
    storeId: string,
    listingId: string,
    id: string,
    action: v.Action,
    input: z.infer<typeof v.lifecycle>,
  ) {
    const permissions = {
      review: 'listings.submit',
      draft: 'listings.update',
      approve: 'listings.approve',
      publish: 'listings.publish',
      archive: 'listings.archive',
    };
    if (!permissions[action]) fail('Unknown listing lifecycle action.');
    return this.categories.write(
      actor,
      storeId,
      permissions[action],
      async (tx, ctx) => {
        const root = await this.root(tx, ctx, listingId),
          row = await this.row(tx, ctx, listingId, id);
        if (row.revision !== input.revision) stale();
        if (root.archived) fail('Listing identity is archived.');
        const states = {
          review: ['DRAFT'],
          draft: ['IN_REVIEW'],
          approve: ['IN_REVIEW'],
          publish: ['APPROVED'],
          archive: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'],
        };
        if (!states[action].includes(row.status))
          throw new ConflictException('Invalid listing transition.');
        if (['review', 'approve', 'publish'].includes(action)) {
          await this.validateMedia(tx, ctx, row);
          await this.validate(
            tx,
            ctx,
            {
              ...row,
              revision: row.revision,
              categoryIds: row.categories.map((c) => c.categoryId),
              skuRevisionIds: row.skus.map((s) => s.skuRevisionId),
              seo: row.seo as { title: string; description: string },
            },
            row.productId,
            true,
          );
        }
        if (
          action === 'publish' ||
          (action === 'archive' && root.publishedRevisionId === id)
        ) {
          if (input.rootRevision !== root.revision) stale();
          if (action === 'publish' && root.publishedRevisionId)
            await tx.listingRevision.update({
              where: { id: root.publishedRevisionId },
              data: { status: 'ARCHIVED', revision: { increment: 1 } },
            });
          await tx.storeListing.update({
            where: { id: listingId },
            data: {
              publishedRevisionId: action === 'publish' ? id : null,
              revision: { increment: 1 },
            },
          });
        }
        await tx.listingRevision.update({
          where: { id },
          data: {
            status: (
              {
                review: 'IN_REVIEW',
                draft: 'DRAFT',
                approve: 'APPROVED',
                publish: 'PUBLISHED',
                archive: 'ARCHIVED',
              } as const
            )[action],
            revision: { increment: 1 },
            updatedBy: actor,
            ...(action === 'approve'
              ? { approvedBy: actor, approvedAt: new Date() }
              : {}),
            ...(action === 'publish'
              ? { publishedBy: actor, publishedAt: new Date() }
              : {}),
          },
        });
        await this.audit(tx, actor, ctx, action, id);
        return {
          ...(await this.row(tx, ctx, listingId, id)),
          rootRevision: (await this.root(tx, ctx, listingId)).revision,
        };
      },
    );
  }
  archive(actor: string, storeId: string, id: string, revision: number) {
    return this.categories.write(
      actor,
      storeId,
      'listings.archive',
      async (tx, ctx) => {
        const root = await this.root(tx, ctx, id);
        if (root.revision !== revision) stale();
        await tx.storeListing.update({
          where: { id },
          data: { archived: true, revision: { increment: 1 } },
        });
        await this.audit(tx, actor, ctx, 'identity_archived', id);
        return this.root(tx, ctx, id);
      },
    );
  }
}
