import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../security/database.js';
import { ScopedAuthorizationService } from '../security/scoped-authorization.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { ScopeContext } from '../security/scoped-permissions.js';
import { fail } from '../product-types/validation.js';
import { CategoryUsageService } from './usage.service.js';
import * as v from './validation.js';
export type StoreContext = Extract<ScopeContext, { kind: 'STORE' }>;
export const ownership = (ctx: StoreContext) => ({
  storeId: ctx.storeId,
  tenantId: ctx.tenantId,
});
export const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export const stale = () => {
  throw new ConflictException('Configuration changed. Reload before retrying.');
};
export const MAX_DEPTH = 32,
  MAX_NODES = 1000;
@Injectable()
export class CategoryService {
  constructor(
    @Inject(DatabaseService) public readonly db: DatabaseService,
    @Inject(ScopedAuthorizationService)
    public readonly auth: ScopedAuthorizationService,
    @Inject(CategoryUsageService) public readonly usage: CategoryUsageService,
  ) {}
  async context(
    actor: string,
    storeId: string,
    permission: string,
    tx: ScopeTransaction = this.db,
  ) {
    const ctx = await this.auth.storeContext(actor, storeId, tx);
    await this.auth.require(actor, ctx, [permission], tx);
    return ctx;
  }
  async write<T>(
    actor: string,
    storeId: string,
    permission: string,
    run: (tx: ScopeTransaction, ctx: StoreContext) => Promise<T>,
  ) {
    try {
      return await this.auth.write(async (tx) =>
        run(tx, await this.context(actor, storeId, permission, tx)),
      );
    } catch (e) {
      if (
        e instanceof ConflictException &&
        e.message === 'A role with that code already exists.'
      )
        throw new ConflictException(
          'A routing or configuration identity is already reserved.',
        );
      throw e;
    }
  }
  audit(
    tx: ScopeTransaction,
    ctx: StoreContext,
    actor: string,
    action: string,
    id: string,
  ) {
    return this.auth.audit(tx, actor, ctx, 'category.' + action, id);
  }
  async row(tx: ScopeTransaction, ctx: StoreContext, id: string) {
    const row = await tx.category.findFirst({
      where: { id, ...ownership(ctx) },
      include: { allowedTypes: true },
    });
    if (!row) throw new NotFoundException('Category not found.');
    return row;
  }
  async graph(tx: ScopeTransaction, ctx: StoreContext) {
    const rows = await tx.category.findMany({
      where: ownership(ctx),
      take: MAX_NODES + 1,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    if (rows.length > MAX_NODES)
      fail('Store hierarchy exceeds the safe query limit.');
    return rows;
  }
  verifyGraph(rows: { id: string; parentId: string | null; status: string }[]) {
    const map = new Map(rows.map((r) => [r.id, r]));
    for (const row of rows) {
      if (row.status === 'ARCHIVED') continue;
      let current: typeof row | undefined = row;
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current.id))
          fail('A category cannot become its own ancestor.');
        seen.add(current.id);
        if (seen.size > MAX_DEPTH)
          fail('Category depth exceeds the safe limit.');
        if (!current.parentId) break;
        const parent = map.get(current.parentId);
        if (!parent || parent.status === 'ARCHIVED')
          fail('Choose a non-archived parent in this store.');
        current = parent;
      }
    }
  }
  async types(
    tx: ScopeTransaction,
    ctx: StoreContext,
    compatibility: string,
    ids: string[],
  ) {
    if (
      new Set(ids).size !== ids.length ||
      (compatibility === 'ANY' && ids.length) ||
      (compatibility === 'ALLOW_LIST' && !ids.length)
    )
      fail(
        'Choose either any Product Type or an explicit non-empty allow list.',
      );
    if (
      ids.length &&
      (await tx.productType.count({
        where: {
          id: { in: ids },
          tenantId: ctx.tenantId,
          versions: { some: { status: { in: ['APPROVED', 'ACTIVE'] } } },
        },
      })) !== ids.length
    )
      fail('Product Types must be approved and owned by this tenant.');
  }
  async reserveRoute(
    tx: ScopeTransaction,
    ctx: StoreContext,
    slug: string,
    id: string,
  ) {
    const route = await tx.catalogRoute.findUnique({
      where: { storeId_slug: { storeId: ctx.storeId, slug } },
    });
    if (route && (route.ownerKind !== 'CATEGORY' || route.categoryId !== id))
      throw new ConflictException(
        'This slug is reserved in the shared catalog namespace.',
      );
    if (!route)
      await tx.catalogRoute.create({
        data: {
          ...ownership(ctx),
          slug,
          ownerKind: 'CATEGORY',
          categoryId: id,
        },
      });
  }
  async list(
    actor: string,
    storeId: string,
    query: z.infer<typeof v.categoryList>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const ctx = await this.context(actor, storeId, 'categories.view', tx),
          where = {
            ...ownership(ctx),
            ...(query.status ? { status: query.status } : {}),
            ...(query.search
              ? {
                  OR: [
                    {
                      name: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                    {
                      code: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                }
              : {}),
          };
        return {
          items: await tx.category.findMany({
            where,
            include: { allowedTypes: true },
            orderBy: [{ [query.sort]: query.direction }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          total: await tx.category.count({ where }),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async tree(
    actor: string,
    storeId: string,
    query: z.infer<typeof v.treeInput>,
  ) {
    const ctx = await this.context(actor, storeId, 'categories.view');
    const rows = await this.graph(this.db, ctx);
    return this.treeRows(rows, query);
  }
  async get(actor: string, storeId: string, id: string) {
    const ctx = await this.context(actor, storeId, 'categories.view');
    return this.row(this.db, ctx, id);
  }
  treeRows(
    rows: Awaited<ReturnType<CategoryService['graph']>>,
    query: z.infer<typeof v.treeInput>,
  ) {
    const active = query.view === 'active',
      eligible = rows.filter(
        (r) =>
          !active || (r.status !== 'ARCHIVED' && r.activeSnapshot !== null),
      ),
      map = new Map(eligible.map((r) => [r.id, r]));
    if (query.rootId && !map.has(query.rootId))
      throw new NotFoundException('Tree root not found.');
    const nodes = [];
    let truncated = false;
    for (const row of eligible) {
      let current: typeof row | undefined = row;
      const path: string[] = [];
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current.id) || seen.size >= MAX_DEPTH)
          fail('Invalid category graph.');
        seen.add(current.id);
        path.unshift(current.id);
        if (query.rootId === current.id) break;
        const parent = active ? current.activeParentId : current.parentId;
        if (!parent) break;
        current = map.get(parent);
      }
      if (query.rootId && path[0] !== query.rootId) continue;
      if (path.length > query.maxDepth) {
        truncated = true;
        continue;
      }
      const snapshot = active
        ? (row.activeSnapshot as {
            name: string;
            slug: string;
            sortOrder: number;
          })
        : null;
      nodes.push({
        id: row.id,
        parentId: active ? row.activeParentId : row.parentId,
        name: snapshot?.name ?? row.name,
        slug: snapshot?.slug ?? row.slug,
        sortOrder: snapshot?.sortOrder ?? row.sortOrder,
        status: row.status,
        revision: row.revision,
        depth: path.length,
        path,
      });
    }
    return {
      nodes: nodes.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      ),
      truncated,
      maxDepth: query.maxDepth,
      nodeLimit: MAX_NODES,
    };
  }
  create(
    actor: string,
    storeId: string,
    input: z.infer<typeof v.categoryInput>,
  ) {
    return this.write(actor, storeId, 'categories.create', async (tx, ctx) => {
      const rows = await this.graph(tx, ctx);
      if (rows.length >= MAX_NODES)
        fail('Store hierarchy reached the safe node limit.');
      if (
        input.parentId &&
        !rows.some((r) => r.id === input.parentId && r.status !== 'ARCHIVED')
      )
        fail('Choose a parent from this store.');
      await this.types(tx, ctx, input.compatibility, input.productTypeIds);
      const id = randomUUID();
      this.verifyGraph([
        ...rows,
        { id, parentId: input.parentId, status: 'DRAFT' },
      ]);
      const { productTypeIds, ...data } = input;
      const row = await tx.category.create({
        data: {
          ...data,
          id,
          ...ownership(ctx),
          createdBy: actor,
          updatedBy: actor,
          media: json(input.media),
          seo: json(input.seo),
        },
      });
      this.verifyGraph([...rows, row]);
      await this.reserveRoute(tx, ctx, row.slug, row.id);
      if (productTypeIds.length)
        await tx.categoryAllowedType.createMany({
          data: productTypeIds.map((productTypeId) => ({
            ...ownership(ctx),
            categoryId: row.id,
            productTypeId,
          })),
        });
      await this.audit(tx, ctx, actor, 'created', row.id);
      return this.row(tx, ctx, row.id);
    });
  }
  update(
    actor: string,
    storeId: string,
    id: string,
    input: z.infer<typeof v.categoryUpdate>,
  ) {
    return this.write(actor, storeId, 'categories.update', async (tx, ctx) => {
      const old = await this.row(tx, ctx, id);
      if (old.revision !== input.revision) stale();
      if (['ARCHIVED', 'REVIEW', 'APPROVED'].includes(old.status))
        throw new ConflictException(
          'Return this category to draft before editing.',
        );
      await this.types(tx, ctx, input.compatibility, input.productTypeIds);
      await this.reserveRoute(tx, ctx, input.slug, id);
      await tx.categoryAllowedType.deleteMany({
        where: { categoryId: id, ...ownership(ctx) },
      });
      if (input.productTypeIds.length)
        await tx.categoryAllowedType.createMany({
          data: input.productTypeIds.map((productTypeId) => ({
            ...ownership(ctx),
            categoryId: id,
            productTypeId,
          })),
        });
      const { revision: _, productTypeIds: __, ...data } = input;
      await tx.category.update({
        where: { id },
        data: {
          ...data,
          media: json(data.media),
          seo: json(data.seo),
          status: 'DRAFT',
          revision: { increment: 1 },
          updatedBy: actor,
        },
      });
      await this.audit(tx, ctx, actor, 'updated', id);
      return this.row(tx, ctx, id);
    });
  }
  move(
    actor: string,
    storeId: string,
    id: string,
    input: z.infer<typeof v.moveInput>,
  ) {
    return this.write(actor, storeId, 'categories.reorder', async (tx, ctx) => {
      const row = await this.row(tx, ctx, id);
      if (row.revision !== input.revision) stale();
      if (!['DRAFT', 'ACTIVE'].includes(row.status))
        throw new ConflictException('Only editable categories may move.');
      if (row.parentId !== input.parentId)
        await this.auth.require(actor, ctx, ['categories.update'], tx);
      const rows = await this.graph(tx, ctx);
      this.verifyGraph(
        rows.map((r) => (r.id === id ? { ...r, parentId: input.parentId } : r)),
      );
      await tx.category.update({
        where: { id },
        data: {
          parentId: input.parentId,
          sortOrder: input.sortOrder,
          status: 'DRAFT',
          revision: { increment: 1 },
          updatedBy: actor,
        },
      });
      await this.audit(tx, ctx, actor, 'moved', id);
      return this.row(tx, ctx, id);
    });
  }
  snapshot(row: Awaited<ReturnType<CategoryService['row']>>) {
    return {
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      description: row.description,
      media: row.media,
      seo: row.seo,
      sortOrder: row.sortOrder,
      visible: row.visible,
      inNavigation: row.inNavigation,
      compatibility: row.compatibility,
      productTypeIds: row.allowedTypes.map((t) => t.productTypeId),
    };
  }
  async impact(actor: string, storeId: string, id: string) {
    const ctx = await this.context(actor, storeId, 'categories.view');
    const row = await this.row(this.db, ctx, id);
    return this.impactRow(this.db, ctx, row);
  }
  async impactRow(
    tx: ScopeTransaction,
    ctx: StoreContext,
    row: Awaited<ReturnType<CategoryService['row']>>,
  ) {
    return {
      revision: row.revision,
      active: row.activeSnapshot,
      draft: this.snapshot(row),
      children: await tx.category.count({
        where: {
          ...ownership(ctx),
          status: { not: 'ARCHIVED' },
          OR: [{ parentId: row.id }, { activeParentId: row.id }],
        },
      }),
      usage: await this.usage.inspect(tx, ctx.storeId, row.id),
      warnings: [
        'No real listing assignments exist in this milestone. Public category reads have not been switched.',
      ],
    };
  }
  transition(
    actor: string,
    storeId: string,
    id: string,
    action: 'review' | 'draft' | 'approve' | 'activate' | 'archive',
    revision: number,
  ) {
    const cap =
      action === 'approve'
        ? 'categories.approve'
        : action === 'activate'
          ? 'categories.activate'
          : action === 'archive'
            ? 'categories.archive'
            : 'categories.update';
    return this.write(actor, storeId, cap, async (tx, ctx) => {
      const row = await this.row(tx, ctx, id);
      if (row.revision !== revision) stale();
      const states = {
        review: ['DRAFT'],
        draft: ['REVIEW', 'APPROVED'],
        approve: ['REVIEW'],
        activate: ['APPROVED'],
        archive: ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE'],
      };
      if (!states[action].includes(row.status))
        throw new ConflictException('Invalid category lifecycle transition.');
      if (action === 'activate') {
        const usage = await this.usage.inspect(tx, storeId, id);
        if (usage.assignments === null || usage.blockingReasons.length)
          throw new ConflictException('Category usage must be verified.');
        if (row.parentId) {
          const parent = await this.row(tx, ctx, row.parentId);
          if (!parent.activeSnapshot || parent.status === 'ARCHIVED')
            fail('Publish the parent before activating this category.');
        }
        await this.types(
          tx,
          ctx,
          row.compatibility,
          row.allowedTypes.map((t) => t.productTypeId),
        );
        if (row.activeFilterSetId && row.compatibility === 'ALLOW_LIST') {
          const filters = await tx.categoryFilterTypeVersion.findMany({
            where: { setId: row.activeFilterSetId, ...ownership(ctx) },
            include: { version: true },
          });
          if (
            filters.some(
              (f) =>
                !row.allowedTypes.some(
                  (t) => t.productTypeId === f.version.productTypeId,
                ),
            )
          )
            fail(
              'Update or archive active filters before restricting compatible Product Types.',
            );
        }
        this.verifyGraph(
          (await this.graph(tx, ctx))
            .filter(
              (r) =>
                (r.status !== 'ARCHIVED' && r.activeSnapshot !== null) ||
                r.id === id,
            )
            .map((r) => ({
              ...r,
              parentId: r.id === id ? row.parentId : r.activeParentId,
            })),
        );
      }
      if (action === 'archive') {
        const impact = await this.impactRow(tx, ctx, row);
        if (
          impact.children ||
          impact.usage.assignments === null ||
          impact.usage.assignments > 0 ||
          impact.usage.blockingReasons.length
        )
          throw new ConflictException(
            'Move or archive children and resolve listing dependencies first.',
          );
        if (row.activeFilterSetId)
          throw new ConflictException(
            'Archive the active filter configuration first.',
          );
      }
      const status = (
        {
          review: 'REVIEW',
          draft: 'DRAFT',
          approve: 'APPROVED',
          activate: 'ACTIVE',
          archive: 'ARCHIVED',
        } as const
      )[action];
      await tx.category.update({
        where: { id },
        data: {
          status,
          revision: { increment: 1 },
          updatedBy: actor,
          ...(action === 'activate'
            ? {
                activeParentId: row.parentId,
                activeSnapshot: json(this.snapshot(row)),
              }
            : {}),
        },
      });
      await this.audit(tx, ctx, actor, action, id);
      return this.row(tx, ctx, id);
    });
  }
}
