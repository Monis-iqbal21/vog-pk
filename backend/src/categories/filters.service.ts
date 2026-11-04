import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { fail } from '../product-types/validation.js';
import { UNITS } from '../product-types/registry.js';
import { CategoryService, ownership, json, stale } from './category.service.js';
import type { StoreContext } from './category.service.js';
import {
  compileDefinition,
  queryContract,
  evaluateFixture,
  CONTROLS,
  operators,
} from './compiler.js';
import type { TypeDependency, FilterSnapshot } from './compiler.js';
import type { DraftInput } from './validation.js';
import { previewFixtures } from './fixtures.js';
import type { z } from 'zod';
import * as v from './validation.js';
const graph = {
  filters: {
    orderBy: [{ sortOrder: 'asc' as const }, { code: 'asc' as const }],
  },
  dependencies: { include: { version: { include: { attributes: true } } } },
};
@Injectable()
export class CategoryFiltersService {
  constructor(
    @Inject(CategoryService) private readonly categories: CategoryService,
  ) {}
  async row(
    tx: ScopeTransaction,
    ctx: StoreContext,
    categoryId: string,
    id: string,
  ) {
    const row = await tx.categoryFilterSet.findFirst({
      where: { id, categoryId, ...ownership(ctx) },
      include: graph,
    });
    if (!row) throw new NotFoundException('Filter version not found.');
    return row;
  }
  async eligible(
    actor: string,
    storeId: string,
    query: z.infer<typeof v.historyInput>,
  ) {
    const ctx = await this.categories.context(
      actor,
      storeId,
      'category-filters.view',
    );
    const where = {
      tenantId: ctx.tenantId,
      status: { in: ['APPROVED', 'ACTIVE'] as ('APPROVED' | 'ACTIVE')[] },
    };
    const versions = await this.categories.db.productTypeVersion.findMany({
      where,
      orderBy: [{ productTypeId: 'asc' }, { number: 'desc' }],
      take: query.pageSize,
      skip: (query.page - 1) * query.pageSize,
      include: {
        productType: { select: { code: true, label: true } },
        attributes: { include: { attribute: true } },
      },
    });
    return {
      items: versions.map((version) => ({
        id: version.id,
        productTypeId: version.productTypeId,
        number: version.number,
        label: version.label,
        status: version.status,
        attributes: version.attributes
          .filter(
            (f) =>
              f.attribute.status === 'ACTIVE' &&
              (f.attribute.visibility as { storefront: boolean }).storefront &&
              (f.snapshot as { visibility: { storefront: boolean } }).visibility
                .storefront,
          )
          .map((f) => ({
            attributeId: f.attributeId,
            level: f.level,
            snapshot: f.snapshot,
          })),
      })),
      total: await this.categories.db.productTypeVersion.count({ where }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async registry(actor: string, storeId: string) {
    const ctx = await this.categories.context(
      actor,
      storeId,
      'category-filters.view',
    );
    const store = await this.categories.db.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { currency: true },
    });
    return {
      controls: CONTROLS,
      operators: Object.fromEntries(
        [
          'checkbox_group',
          'single_select',
          'multi_select',
          'number_range',
          'boolean_toggle',
        ].map((control) => [control, operators(control)]),
      ),
      units: UNITS,
      currency: store.currency,
      builtIns: [
        {
          source: 'PRICE',
          label: 'Approved selling price',
          level: 'SKU',
          dataType: 'NUMBER',
        },
        { source: 'BRAND', label: 'Brand', level: 'PRODUCT', dataType: 'TEXT' },
        {
          source: 'AVAILABILITY',
          label: 'Availability',
          level: 'SKU',
          dataType: 'SINGLE_SELECT',
        },
      ],
    };
  }
  async history(
    actor: string,
    storeId: string,
    categoryId: string,
    query: z.infer<typeof v.historyInput>,
  ) {
    const ctx = await this.categories.context(
      actor,
      storeId,
      'category-filters.view',
    );
    await this.categories.row(this.categories.db, ctx, categoryId);
    const where = { categoryId, ...ownership(ctx) };
    return {
      items: await this.categories.db.categoryFilterSet.findMany({
        where,
        select: { id: true, number: true, status: true, revision: true },
        orderBy: { number: 'desc' },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
      }),
      total: await this.categories.db.categoryFilterSet.count({ where }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(actor: string, storeId: string, categoryId: string, id: string) {
    const ctx = await this.categories.context(
      actor,
      storeId,
      'category-filters.view',
    );
    return this.row(this.categories.db, ctx, categoryId, id);
  }
  create(actor: string, storeId: string, categoryId: string) {
    return this.categories.write(
      actor,
      storeId,
      'category-filters.manage',
      async (tx, ctx) => {
        const category = await this.categories.row(tx, ctx, categoryId);
        if (category.status === 'ARCHIVED')
          fail('Archived categories cannot gain filter drafts.');
        if (
          await tx.categoryFilterSet.count({
            where: { categoryId, status: 'DRAFT', ...ownership(ctx) },
          })
        )
          throw new ConflictException('Edit the existing filter draft.');
        const last = await tx.categoryFilterSet.findFirst({
          where: { categoryId, ...ownership(ctx) },
          orderBy: { number: 'desc' },
        });
        const row = await tx.categoryFilterSet.create({
          data: {
            categoryId,
            ...ownership(ctx),
            number: (last?.number ?? 0) + 1,
            createdBy: actor,
          },
        });
        await this.categories.audit(
          tx,
          ctx,
          actor,
          'filter_draft_created',
          row.id,
        );
        return this.row(tx, ctx, categoryId, row.id);
      },
    );
  }
  async prepare(
    tx: ScopeTransaction,
    ctx: StoreContext,
    categoryId: string,
    input: DraftInput,
    published = false,
  ) {
    const category = await this.categories.row(tx, ctx, categoryId);
    if (category.status === 'ARCHIVED') fail('Category is archived.');
    if (
      new Set(input.typeVersionIds).size !== input.typeVersionIds.length ||
      new Set(input.filters.map((f) => f.code)).size !== input.filters.length
    )
      fail('Duplicate filter codes or schema dependencies.');
    const versions = await tx.productTypeVersion.findMany({
      where: {
        id: { in: input.typeVersionIds },
        tenantId: ctx.tenantId,
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
      include: { attributes: true },
    });
    if (versions.length !== input.typeVersionIds.length)
      fail(
        'Dependencies must be approved Product Type versions in this tenant.',
      );
    if (new Set(versions.map((v) => v.productTypeId)).size !== versions.length)
      fail('Choose one schema version per applicable Product Type.');
    const policy =
      published && category.activeSnapshot
        ? (category.activeSnapshot as {
            compatibility: string;
            productTypeIds: string[];
          })
        : {
            compatibility: category.compatibility,
            productTypeIds: category.allowedTypes.map((t) => t.productTypeId),
          };
    if (
      policy.compatibility === 'ALLOW_LIST' &&
      versions.some((v) => !policy.productTypeIds.includes(v.productTypeId))
    )
      fail('Filter Product Types conflict with category compatibility.');
    const attributeIds = input.filters.flatMap((f) =>
        f.attributeId ? [f.attributeId] : [],
      ),
      attributes = await tx.attributeDefinition.findMany({
        where: { id: { in: attributeIds }, tenantId: ctx.tenantId },
        include: { optionSet: true },
      });
    for (const id of attributeIds) {
      const attr = attributes.find((a) => a.id === id);
      if (
        !attr ||
        attr.status !== 'ACTIVE' ||
        !(attr.visibility as { storefront: boolean }).storefront ||
        attr.optionSet?.status === 'ARCHIVED'
      )
        fail(
          'Archived, private or foreign attributes cannot become public filters.',
        );
    }
    const store = await tx.store.findUniqueOrThrow({
      where: { id: ctx.storeId },
      select: { currency: true },
    });
    const compiled = input.filters.map((filter) => ({
      input: filter,
      ...compileDefinition(
        filter,
        versions as TypeDependency[],
        store.currency,
      ),
    }));
    if (
      new Set(
        compiled.map(
          (c) => `${c.input.source}:${c.input.attributeId}:${c.input.level}`,
        ),
      ).size !== compiled.length
    )
      fail('Configure one facet per source attribute and level.');
    return { category, compiled, versions, policy };
  }
  save(
    actor: string,
    storeId: string,
    categoryId: string,
    id: string,
    input: DraftInput,
  ) {
    return this.categories.write(
      actor,
      storeId,
      'category-filters.manage',
      async (tx, ctx) => {
        const row = await this.row(tx, ctx, categoryId, id);
        if (row.revision !== input.revision) stale();
        if (row.status !== 'DRAFT')
          throw new ConflictException(
            'Only filter drafts can be edited. Clone this version first.',
          );
        const prepared = await this.prepare(tx, ctx, categoryId, input);
        const filters = [];
        for (const { input: f, semanticHash, snapshot } of prepared.compiled) {
          const route = await tx.categoryFilterRoute.findUnique({
            where: { categoryId_code: { categoryId, code: f.code } },
            include: { key: true },
          });
          let key = f.keyId
            ? await tx.categoryFilterKey.findFirst({
                where: { id: f.keyId, categoryId, ...ownership(ctx) },
              })
            : route?.key;
          if (key && key.semanticHash !== semanticHash)
            throw new ConflictException(
              'Published query meaning cannot be repurposed. Use a new query code and identity.',
            );
          if (f.keyId && !key)
            fail('Filter identity is not owned by this category.');
          key ??= await tx.categoryFilterKey.create({
            data: { categoryId, ...ownership(ctx), semanticHash },
          });
          for (const code of [f.code, ...f.aliases]) {
            const old = await tx.categoryFilterRoute.findUnique({
              where: { categoryId_code: { categoryId, code } },
            });
            if (old && old.keyId !== key.id)
              throw new ConflictException(
                'Query code or alias is reserved by another filter.',
              );
            if (!old)
              await tx.categoryFilterRoute.create({
                data: { categoryId, ...ownership(ctx), code, keyId: key.id },
              });
          }
          filters.push({
            setId: id,
            categoryId,
            ...ownership(ctx),
            keyId: key.id,
            source: f.source,
            attributeId: f.attributeId,
            code: f.code,
            label: f.label,
            description: f.description,
            group: f.group,
            sortOrder: f.sortOrder,
            visible: f.visible,
            snapshot: json(snapshot),
          });
        }
        await tx.categoryFilter.deleteMany({
          where: { setId: id, ...ownership(ctx) },
        });
        await tx.categoryFilterTypeVersion.deleteMany({
          where: { setId: id, ...ownership(ctx) },
        });
        if (input.typeVersionIds.length)
          await tx.categoryFilterTypeVersion.createMany({
            data: input.typeVersionIds.map((versionId) => ({
              setId: id,
              ...ownership(ctx),
              versionId,
            })),
          });
        if (filters.length)
          await tx.categoryFilter.createMany({ data: filters });
        await tx.categoryFilterSet.update({
          where: { id },
          data: {
            includeDescendants: input.includeDescendants,
            revision: { increment: 1 },
          },
        });
        await this.categories.audit(tx, ctx, actor, 'filter_draft_saved', id);
        return this.row(tx, ctx, categoryId, id);
      },
    );
  }
  definition(
    row: Awaited<ReturnType<CategoryFiltersService['row']>>,
  ): DraftInput {
    return {
      revision: row.revision,
      includeDescendants: row.includeDescendants,
      typeVersionIds: row.dependencies.map((d) => d.versionId),
      filters: row.filters.map((f) => {
        const s = f.snapshot as FilterSnapshot;
        return {
          keyId: f.keyId,
          code: f.code,
          label: f.label,
          description: f.description,
          group: f.group,
          sortOrder: f.sortOrder,
          visible: f.visible,
          source: f.source,
          attributeId: f.attributeId,
          level: s.level,
          control: s.control as v.FilterInput['control'],
          operators: s.operators as v.FilterInput['operators'],
          allowedValues: s.values.map((v) => v.code),
          ...(s.min !== undefined ? { min: s.min } : {}),
          ...(s.max !== undefined ? { max: s.max } : {}),
          displayUnit: s.displayUnit,
          typeVersionIds: s.bindings.map((b) => b.versionId),
          aliases: s.aliases,
          ui: s.ui,
        };
      }),
    };
  }
  clone(
    actor: string,
    storeId: string,
    categoryId: string,
    id: string,
    revision: number,
  ) {
    return this.categories.write(
      actor,
      storeId,
      'category-filters.manage',
      async (tx, ctx) => {
        const source = await this.row(tx, ctx, categoryId, id);
        if (source.revision !== revision) stale();
        if (
          source.status === 'DRAFT' ||
          (await tx.categoryFilterSet.count({
            where: { categoryId, status: 'DRAFT', ...ownership(ctx) },
          }))
        )
          throw new ConflictException('Edit or archive the existing draft.');
        const last = await tx.categoryFilterSet.findFirstOrThrow({
            where: { categoryId, ...ownership(ctx) },
            orderBy: { number: 'desc' },
          }),
          draft = await tx.categoryFilterSet.create({
            data: {
              categoryId,
              ...ownership(ctx),
              number: last.number + 1,
              includeDescendants: source.includeDescendants,
              createdBy: actor,
            },
          });
        for (const f of source.filters)
          await tx.categoryFilter.create({
            data: {
              ...ownership(ctx),
              setId: draft.id,
              categoryId,
              keyId: f.keyId,
              source: f.source,
              attributeId: f.attributeId,
              code: f.code,
              label: f.label,
              description: f.description,
              group: f.group,
              sortOrder: f.sortOrder,
              visible: f.visible,
              snapshot: f.snapshot!,
            },
          });
        if (source.dependencies.length)
          await tx.categoryFilterTypeVersion.createMany({
            data: source.dependencies.map((d) => ({
              ...ownership(ctx),
              setId: draft.id,
              versionId: d.versionId,
            })),
          });
        await this.categories.audit(
          tx,
          ctx,
          actor,
          'filter_draft_cloned',
          draft.id,
        );
        return this.row(tx, ctx, categoryId, draft.id);
      },
    );
  }
  async impactRow(
    tx: ScopeTransaction,
    ctx: StoreContext,
    categoryId: string,
    id: string,
  ) {
    const row = await this.row(tx, ctx, categoryId, id),
      category = await this.categories.row(tx, ctx, categoryId),
      active = category.activeFilterSetId
        ? await this.row(tx, ctx, categoryId, category.activeFilterSetId)
        : null;
    const warnings: string[] = [],
      blockingReasons: string[] = [];
    try {
      await this.prepare(tx, ctx, categoryId, this.definition(row), true);
    } catch (e) {
      blockingReasons.push(
        e instanceof HttpException
          ? e.message
          : 'Configuration validation is unavailable.',
      );
    }
    for (const dependency of row.dependencies)
      if (dependency.version.status === 'ARCHIVED')
        warnings.push(
          'A pinned Product Type version is archived. Choose and review a current version.',
        );
    for (const f of active?.filters ?? []) {
      const next = row.filters.find((n) => n.keyId === f.keyId);
      if (!next)
        warnings.push(
          `Removing filter ${f.code} invalidates its saved queries.`,
        );
      else {
        if (next.code !== f.code)
          warnings.push(`Query alias ${f.code} will resolve to ${next.code}.`);
        const values = (next.snapshot as FilterSnapshot).values.map(
          (v) => v.code,
        );
        if (
          (f.snapshot as FilterSnapshot).values.some(
            (v) => !values.includes(v.code),
          )
        )
          warnings.push(
            `Some saved values of ${f.code} will be rejected after activation.`,
          );
      }
    }
    const usage = await this.categories.usage.inspect(
      tx,
      ctx.storeId,
      categoryId,
    );
    if (usage.assignments === null || usage.blockingReasons.length)
      blockingReasons.push('Real listing usage has not been verified.');
    const categoryIds = row.includeDescendants
      ? this.categories
          .treeRows(
            (await this.categories.graph(tx, ctx)).filter(
              (c) => c.status !== 'ARCHIVED',
            ),
            {
              rootId: categoryId,
              maxDepth: 32,
              view: category.activeSnapshot ? 'active' : 'draft',
            },
          )
          .nodes.map((c) => c.id)
      : [categoryId];
    const assigned = await tx.listingCategory.findMany({
      where: {
        ...ownership(ctx),
        categoryId: { in: categoryIds },
        revision: { listing: { archived: false }, status: { not: 'ARCHIVED' } },
      },
      select: {
        revision: {
          select: {
            productRevision: {
              select: { schemaVersionId: true, productTypeId: true },
            },
          },
        },
      },
      take: 501,
    });
    if (assigned.length > 500)
      blockingReasons.push(
        'Listing/filter analysis exceeds the safe limit; review a bounded migration first.',
      );
    if (
      assigned.some((a) =>
        row.filters.some(
          (f) =>
            (f.snapshot as FilterSnapshot).bindings.some(
              (b) =>
                b.productTypeId === a.revision.productRevision.productTypeId,
            ) &&
            !(f.snapshot as FilterSnapshot).bindings.some(
              (b) => b.versionId === a.revision.productRevision.schemaVersionId,
            ),
        ),
      )
    )
      blockingReasons.push(
        'Existing listing pins use a different schema version for configured attributes. Migrate those listing pins explicitly before activation.',
      );
    return {
      revision: row.revision,
      categoryRevision: category.revision,
      filterRevision: category.filterRevision,
      activeId: category.activeFilterSetId,
      added: row.filters
        .filter((f) => !active?.filters.some((a) => a.keyId === f.keyId))
        .map((f) => f.code),
      removed:
        active?.filters
          .filter((f) => !row.filters.some((a) => a.keyId === f.keyId))
          .map((f) => f.code) ?? [],
      changed: row.filters
        .filter((f) => {
          const old = active?.filters.find((a) => a.keyId === f.keyId);
          return (
            old &&
            JSON.stringify({ ...old, id: undefined, setId: undefined }) !==
              JSON.stringify({ ...f, id: undefined, setId: undefined })
          );
        })
        .map((f) => f.code),
      warnings,
      blockingReasons,
      usage,
    };
  }
  async impact(actor: string, storeId: string, categoryId: string, id: string) {
    const ctx = await this.categories.context(
      actor,
      storeId,
      'category-filters.view',
    );
    return this.impactRow(this.categories.db, ctx, categoryId, id);
  }
  transition(
    actor: string,
    storeId: string,
    categoryId: string,
    id: string,
    action: 'review' | 'draft' | 'approve' | 'activate' | 'archive',
    input: z.infer<typeof v.transition>,
  ) {
    return this.categories.write(
      actor,
      storeId,
      action === 'approve'
        ? 'category-filters.approve'
        : action === 'activate'
          ? 'category-filters.activate'
          : 'category-filters.manage',
      async (tx, ctx) => {
        const row = await this.row(tx, ctx, categoryId, id);
        if (row.revision !== input.revision) stale();
        const states = {
          review: ['DRAFT'],
          draft: ['REVIEW'],
          approve: ['REVIEW'],
          activate: ['APPROVED'],
          archive: ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE'],
        };
        if (!states[action].includes(row.status))
          throw new ConflictException('Invalid filter lifecycle transition.');
        if (['review', 'approve', 'activate'].includes(action)) {
          if (!row.filters.length) fail('Add at least one filter.');
          await this.prepare(
            tx,
            ctx,
            categoryId,
            this.definition(row),
            action === 'activate',
          );
        }
        if (action === 'activate') {
          const category = await this.categories.row(tx, ctx, categoryId);
          if (!category.activeSnapshot || category.status === 'ARCHIVED')
            fail('Publish the category before activating filters.');
          const impact = await this.impactRow(tx, ctx, categoryId, id);
          if (input.categoryRevision !== category.filterRevision) stale();
          if (impact.blockingReasons.length)
            throw new ConflictException(
              'Resolve filter dependency and usage blockers.',
            );
          if (category.activeFilterSetId)
            await tx.categoryFilterSet.update({
              where: { id: category.activeFilterSetId },
              data: { status: 'ARCHIVED', revision: { increment: 1 } },
            });
          await tx.category.update({
            where: { id: categoryId },
            data: { activeFilterSetId: id, filterRevision: { increment: 1 } },
          });
          for (const f of row.filters)
            await tx.categoryFilterRoute.updateMany({
              where: {
                categoryId,
                ...ownership(ctx),
                keyId: f.keyId,
                code: {
                  in: [f.code, ...(f.snapshot as FilterSnapshot).aliases],
                },
              },
              data: { published: true },
            });
        }
        if (action === 'archive' && row.status === 'ACTIVE') {
          await this.categories.auth.require(
            actor,
            ctx,
            ['category-filters.activate'],
            tx,
          );
          const category = await this.categories.row(tx, ctx, categoryId);
          if (input.categoryRevision !== category.filterRevision) stale();
          await tx.category.update({
            where: { id: categoryId },
            data: { activeFilterSetId: null, filterRevision: { increment: 1 } },
          });
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
        await tx.categoryFilterSet.update({
          where: { id },
          data: {
            status,
            revision: { increment: 1 },
            ...(action === 'approve'
              ? { approvedBy: actor, approvedAt: new Date() }
              : {}),
          },
        });
        await this.categories.audit(tx, ctx, actor, 'filter_' + action, id);
        return this.row(tx, ctx, categoryId, id);
      },
    );
  }
  async contract(
    tx: ScopeTransaction,
    ctx: StoreContext,
    categoryId: string,
    id: string,
    query: Record<string, string[]>,
    published = false,
  ) {
    const row = await this.row(tx, ctx, categoryId, id),
      category = await this.categories.row(tx, ctx, categoryId);
    if (published && row.status !== 'ACTIVE')
      fail('Only active filters form a public contract.');
    const filters = row.filters.map((f) => ({
      ...f,
      snapshot: f.snapshot as FilterSnapshot,
    }));
    for (const f of filters)
      if (f.attributeId) {
        const attr = await tx.attributeDefinition.findFirst({
          where: {
            id: f.attributeId,
            tenantId: ctx.tenantId,
            status: 'ACTIVE',
          },
          include: { optionSet: true },
        });
        if (
          !attr ||
          !(attr.visibility as { storefront: boolean }).storefront ||
          attr.optionSet?.status === 'ARCHIVED'
        )
          fail('A public filter dependency is archived or private.');
      }
    const routes = await tx.categoryFilterRoute.findMany({
        where: {
          categoryId,
          ...ownership(ctx),
          ...(published ? { published: true } : {}),
        },
      }),
      aliases = Object.fromEntries(
        routes.flatMap((r) => {
          const f = filters.find((f) => f.keyId === r.keyId);
          return f ? [[r.code, f.code]] : [];
        }),
      );
    const tree = this.categories.treeRows(
      (await this.categories.graph(tx, ctx)).filter(
        (r) => r.status !== 'ARCHIVED',
      ),
      {
        rootId: categoryId,
        maxDepth: 32,
        view: published ? 'active' : 'draft',
      },
    );
    if (tree.truncated) fail('Descendant category expansion was truncated.');
    const ids = row.includeDescendants
      ? tree.nodes.map((n) => n.id)
      : [categoryId];
    const snapshot = published
      ? (category.activeSnapshot as {
          compatibility: string;
          productTypeIds: string[];
        })
      : null;
    const policy = {
      mode: snapshot?.compatibility ?? category.compatibility,
      productTypeIds:
        snapshot?.productTypeIds ??
        category.allowedTypes.map((t) => t.productTypeId),
    };
    const plan = queryContract(filters, query, aliases, ids, policy);
    const publicDefinition = filters
      .filter((f) => f.visible)
      .map((f) => ({
        code: f.code,
        label: f.label,
        description: f.description,
        group: f.group,
        sortOrder: f.sortOrder,
        control: f.snapshot.control,
        operators: f.snapshot.operators,
        values: f.snapshot.values,
        displayUnit: f.snapshot.displayUnit,
        min: f.snapshot.min,
        max: f.snapshot.max,
        ui: f.snapshot.ui,
      }));
    return { plan, publicDefinition, filters };
  }
  async preview(
    actor: string,
    storeId: string,
    categoryId: string,
    id: string,
    input: z.infer<typeof v.previewInput>,
  ) {
    return this.categories.db.$transaction(
      async (tx) => {
        const ctx = await this.categories.context(
          actor,
          storeId,
          'category-filters.view',
          tx,
        );
        const result = await this.contract(
          tx,
          ctx,
          categoryId,
          id,
          input.query,
        );
        const fixtures = previewFixtures(
          result.filters,
          result.plan.category.ids,
          input.fixture,
        );
        return {
          mode: 'SYNTHETIC_ONLY',
          fixture: input.fixture,
          products: fixtures,
          matchedIds: evaluateFixture(result.plan, fixtures),
          plan: result.plan,
          definition: result.publicDefinition,
          facetCounts: 'NOT_IMPLEMENTED',
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async active(actor: string, storeId: string, categoryId: string) {
    const ctx = await this.categories.context(
        actor,
        storeId,
        'category-filters.view',
      ),
      category = await this.categories.row(this.categories.db, ctx, categoryId);
    if (!category.activeFilterSetId)
      return { active: null, publicContract: null, warnings: [] };
    const row = await this.row(
      this.categories.db,
      ctx,
      categoryId,
      category.activeFilterSetId,
    );
    try {
      const contract = await this.contract(
        this.categories.db,
        ctx,
        categoryId,
        row.id,
        {},
        true,
      );
      return {
        active: row,
        publicContract: contract.publicDefinition,
        warnings: row.dependencies
          .filter((d) => d.version.status === 'ARCHIVED')
          .map(
            () =>
              'A pinned schema was superseded; review before changing filters.',
          ),
      };
    } catch (e) {
      return {
        active: row,
        publicContract: null,
        warnings: [
          e instanceof HttpException
            ? e.message
            : 'Dependency validation is unavailable.',
        ],
      };
    }
  }
}
