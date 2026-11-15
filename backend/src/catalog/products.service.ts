import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../security/database.js';
import { ScopedAuthorizationService } from '../security/scoped-authorization.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { fail } from '../product-types/validation.js';
import { json, stale } from '../categories/category.service.js';
import {
  typedValue,
  validateValues,
  combination,
  inputValues,
} from './facts.js';
import type { Snapshot } from './facts.js';
import { resolveVariants } from './resolver.js';
import * as v from './validation.js';
import type { z } from 'zod';
import fs from 'node:fs/promises';
export const valueGraph = { include: { binding: true, choices: true } };
export const productGraph = {
  media: true,
  bindings: {
    orderBy: [{ sortOrder: 'asc' as const }, { attributeId: 'asc' as const }],
  },
  values: valueGraph,
  skus: {
    include: { sku: true, values: valueGraph, media: true },
    orderBy: { skuId: 'asc' as const },
  },
  schema: { include: { groups: { orderBy: { sortOrder: 'asc' as const } } } },
};
@Injectable()
export class ProductsService {
  constructor(
    @Inject(DatabaseService) readonly db: DatabaseService,
    @Inject(ScopedAuthorizationService)
    readonly auth: ScopedAuthorizationService,
  ) {}
  async releaseReview(actor: string, tenantId: string) {
    await this.context(actor, tenantId, 'products.view');
    const report = JSON.parse(
      await fs.readFile(
        new URL(
          '../../docs/catalog-compliance/source-review.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      products: {
        id: string;
        name: string;
        findings: {
          id: string;
          field: string;
          reason: string;
          decision: string;
          classification: string;
        }[];
      }[];
    };
    const items = report.products.filter((p) =>
      p.findings.some((f) => f.classification === 'REQUIRES ADMIN REVIEW'),
    );
    const imported = await this.db.catalogImportRecord.findMany({
      where: {
        tenantId,
        kind: 'PRODUCT',
        complete: true,
        sourceKey: { in: items.map((p) => p.id) },
      },
      select: { sourceKey: true, mapping: true },
    });
    return {
      items: items.flatMap((p) => {
        const e = imported.find((e) => e.sourceKey === p.id);
        return e
          ? [
              {
                sourceKey: p.id,
                name: p.name,
                productId: (e.mapping as { productId: string }).productId,
                decisions: p.findings.filter(
                  (f) => f.classification === 'REQUIRES ADMIN REVIEW',
                ),
              },
            ]
          : [];
      }),
      policy:
        'Pending source decisions are retained evidence, not automatic approval. Review exact manufacturer data and publish a new revision through normal controls. Media rights require separate media.approve evidence; generic placeholders require an explicit business cutover decision.',
    };
  }
  context(
    actor: string,
    tenantId: string,
    permission: string,
    tx: ScopeTransaction = this.db,
  ) {
    return this.auth.require(
      actor,
      { kind: 'TENANT', tenantId },
      [permission],
      tx,
    );
  }
  async write<T>(
    actor: string,
    tenantId: string,
    permission: string,
    run: (tx: ScopeTransaction) => Promise<T>,
  ) {
    try {
      return await this.auth.write(async (tx) => {
        await this.context(actor, tenantId, permission, tx);
        return run(tx);
      });
    } catch (e) {
      if (
        e instanceof ConflictException &&
        e.message === 'A role with that code already exists.'
      )
        throw new ConflictException(
          'Catalog identity or draft already exists.',
        );
      throw e;
    }
  }
  audit(
    tx: ScopeTransaction,
    actor: string,
    tenantId: string,
    action: string,
    id: string,
  ) {
    return this.auth.audit(
      tx,
      actor,
      { kind: 'TENANT', tenantId },
      'catalog.' + action,
      id,
    );
  }
  async root(tx: ScopeTransaction, tenantId: string, id: string) {
    const root = await tx.product.findFirst({ where: { id, tenantId } });
    if (!root) throw new NotFoundException('Product not found.');
    return root;
  }
  async row(
    tx: ScopeTransaction,
    tenantId: string,
    productId: string,
    id: string,
  ) {
    const row = await tx.productRevision.findFirst({
      where: { id, productId, tenantId },
      include: productGraph,
    });
    if (!row) throw new NotFoundException('Product revision not found.');
    return row;
  }
  async schemas(
    actor: string,
    tenantId: string,
    query: z.infer<typeof v.list>,
  ) {
    await this.context(actor, tenantId, 'products.view');
    const where = {
      tenantId,
      status: { in: ['APPROVED', 'ACTIVE'] as ('APPROVED' | 'ACTIVE')[] },
      ...(query.productTypeId ? { productTypeId: query.productTypeId } : {}),
    };
    return {
      items: await this.db.productTypeVersion.findMany({
        where,
        include: {
          attributes: {
            orderBy: [{ sortOrder: 'asc' }, { attributeId: 'asc' }],
          },
          groups: true,
          productType: { select: { code: true, label: true } },
        },
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        orderBy: [{ productTypeId: 'asc' }, { number: 'desc' }],
      }),
      total: await this.db.productTypeVersion.count({ where }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async brands(actor: string, tenantId: string, query: z.infer<typeof v.list>) {
    await this.context(actor, tenantId, 'products.view');
    const where = {
      tenantId,
      name: { contains: query.search, mode: 'insensitive' as const },
    };
    return {
      items: await this.db.catalogBrand.findMany({
        where,
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        orderBy: { name: 'asc' },
      }),
      total: await this.db.catalogBrand.count({ where }),
    };
  }
  brand(actor: string, tenantId: string, input: z.infer<typeof v.brand>) {
    return this.write(actor, tenantId, 'products.update', async (tx) => {
      const brand = await tx.catalogBrand.create({
        data: { ...input, tenantId },
      });
      await this.audit(
        tx,
        actor,
        tenantId,
        'manufacturer_reference_created',
        brand.id,
      );
      return brand;
    });
  }
  async list(actor: string, tenantId: string, query: z.infer<typeof v.list>) {
    await this.context(actor, tenantId, 'products.view');
    const where = {
      tenantId,
      ...(query.productTypeId ? { productTypeId: query.productTypeId } : {}),
      ...(query.status === 'ARCHIVED' ? { archived: true } : {}),
      revisions: {
        some: {
          ...(query.status && query.status !== 'ARCHIVED'
            ? { status: query.status }
            : {}),
          name: { contains: query.search, mode: 'insensitive' as const },
        },
      },
    };
    return {
      items: await this.db.product.findMany({
        where,
        include: {
          type: { select: { label: true } },
          revisions: {
            select: {
              id: true,
              number: true,
              status: true,
              name: true,
              slug: true,
              revision: true,
            },
            orderBy: { number: 'desc' },
            take: 5,
          },
        },
        orderBy: { code: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      total: await this.db.product.count({ where }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async get(actor: string, tenantId: string, productId: string, id?: string) {
    await this.context(actor, tenantId, 'products.view');
    const root = await this.root(this.db, tenantId, productId);
    if (id)
      return {
        ...(await this.row(this.db, tenantId, productId, id)),
        rootRevision: root.revision,
        rootArchived: root.archived,
      };
    return {
      ...root,
      revisions: await this.db.productRevision.findMany({
        where: { tenantId, productId },
        select: {
          id: true,
          number: true,
          status: true,
          revision: true,
          name: true,
        },
        orderBy: { number: 'desc' },
        take: 25,
      }),
    };
  }
  async schema(tx: ScopeTransaction, tenantId: string, id: string) {
    const s = await tx.productTypeVersion.findFirst({
      where: { id, tenantId, status: { in: ['APPROVED', 'ACTIVE'] } },
      include: {
        attributes: {
          include: { attribute: { include: { optionSet: true } } },
        },
      },
    });
    if (!s) fail('Choose an approved schema in this tenant.');
    return s;
  }
  async history(
    actor: string,
    tenantId: string,
    productId: string,
    q: z.infer<typeof v.list>,
  ) {
    await this.context(actor, tenantId, 'products.view');
    await this.root(this.db, tenantId, productId);
    return {
      items: await this.db.productRevision.findMany({
        where: { tenantId, productId },
        select: {
          id: true,
          number: true,
          status: true,
          revision: true,
          name: true,
        },
        orderBy: { number: 'desc' },
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      total: await this.db.productRevision.count({
        where: { tenantId, productId },
      }),
    };
  }
  async persist(
    tx: ScopeTransaction,
    actor: string,
    tenantId: string,
    row: Awaited<ReturnType<ProductsService['row']>>,
    input: v.FactsInput,
  ) {
    const schema = await this.schema(tx, tenantId, input.schemaVersionId);
    if (schema.productTypeId !== row.productTypeId)
      fail('Product Type identity cannot be reassigned.');
    if (
      input.brandId &&
      !(await tx.catalogBrand.findFirst({
        where: { id: input.brandId, tenantId },
      }))
    )
      fail('Manufacturer reference belongs to another tenant.');
    if (new Set(input.axisIds).size !== input.axisIds.length)
      fail('Duplicate axes.');
    const bindings = schema.attributes.map((f) => ({
      tenantId,
      productRevisionId: row.id,
      schemaBindingId: f.id,
      attributeId: f.attributeId,
      level: f.level,
      required: f.required,
      axis: input.axisIds.includes(f.attributeId),
      sortOrder: f.sortOrder,
      snapshot: f.snapshot!,
    }));
    for (const id of input.axisIds) {
      const b = schema.attributes.find((f) => f.attributeId === id);
      if (
        !b ||
        !b.variantAxis ||
        b.level !== 'SKU' ||
        !(b.snapshot as Snapshot).options.length ||
        b.attribute.status !== 'ACTIVE' ||
        !b.attribute.axisEligible ||
        b.attribute.optionSet?.status === 'ARCHIVED'
      )
        fail('Axes must be approved active SKU single-select bindings.');
    }
    validateValues(bindings, input.values, 'PRODUCT');
    const skus =
      input.skus ??
      row.skus.map((s) => ({
        id: s.skuId,
        code: s.sku.code,
        manufacturerPartNumber: s.sku.manufacturerPartNumber,
        state: s.state,
        values: inputValues(s.values),
      }));
    if (skus.length > 50)
      fail('Maximum 50 explicitly recorded SKUs per revision.');
    if (input.skus !== undefined) {
      const permissions = ['skus.update'];
      if (skus.some((s) => !s.id)) permissions.push('skus.create');
      if (
        row.skus.some(
          (s) =>
            !skus.some((n) => n.id === s.skuId) ||
            skus.some((n) => n.id === s.skuId && n.state !== s.state),
        )
      )
        permissions.push('skus.archive');
      await this.auth.require(
        actor,
        { kind: 'TENANT', tenantId },
        permissions,
        tx,
      );
    }
    if (
      JSON.stringify(
        row.bindings
          .filter((b) => b.axis)
          .map((b) => b.attributeId)
          .sort(),
      ) !== JSON.stringify([...input.axisIds].sort())
    )
      await this.context(actor, tenantId, 'variants.manage', tx);
    const combinations = skus.map((s) => {
      validateValues(bindings, s.values, 'SKU');
      return combination(bindings, s.values);
    });
    if (
      new Set(combinations.map((c) => c.key)).size !== combinations.length ||
      new Set(skus.map((s) => s.code)).size !== skus.length
    )
      fail('Duplicate SKU identity or combination.');
    // Clear only this mutable draft's facts; durable SKU identities are retained.
    const oldSkuValues = row.skus.flatMap((s) => s.values.map((v) => v.id));
    await tx.sKURevisionMedia.deleteMany({
      where: { tenantId, productRevisionId: row.id },
    });
    await tx.sKUAttributeChoice.deleteMany({
      where: { tenantId, valueId: { in: oldSkuValues } },
    });
    await tx.sKUAttributeValue.deleteMany({
      where: { tenantId, productRevisionId: row.id },
    });
    await tx.sKURevision.deleteMany({
      where: { tenantId, productRevisionId: row.id },
    });
    await tx.productAttributeChoice.deleteMany({
      where: { tenantId, valueId: { in: row.values.map((v) => v.id) } },
    });
    await tx.productAttributeValue.deleteMany({
      where: { tenantId, productRevisionId: row.id },
    });
    await tx.productAttributeBinding.deleteMany({
      where: { tenantId, productRevisionId: row.id },
    });
    await tx.productRevision.update({
      where: { id: row.id },
      data: { schemaVersionId: schema.id },
    });
    const saved: Awaited<
      ReturnType<typeof tx.productAttributeBinding.create>
    >[] = [];
    for (const binding of bindings)
      saved.push(await tx.productAttributeBinding.create({ data: binding }));
    const storeValues = async (
      values: v.ValueInput[],
      skuRevisionId?: string,
    ) => {
      for (const input of values) {
        const b = saved.find((b) => b.attributeId === input.attributeId)!;
        const { options, ...data } = typedValue(b, input);
        if (skuRevisionId) {
          const value = await tx.sKUAttributeValue.create({
            data: {
              ...data,
              tenantId,
              productId: row.productId,
              productRevisionId: row.id,
              skuRevisionId,
              bindingId: b.id,
            },
          });
          if (options.length)
            await tx.sKUAttributeChoice.createMany({
              data: options.map((optionId) => ({
                tenantId,
                valueId: value.id,
                optionId,
              })),
            });
        } else {
          const value = await tx.productAttributeValue.create({
            data: {
              ...data,
              tenantId,
              productRevisionId: row.id,
              bindingId: b.id,
            },
          });
          if (options.length)
            await tx.productAttributeChoice.createMany({
              data: options.map((optionId) => ({
                tenantId,
                valueId: value.id,
                optionId,
              })),
            });
        }
      }
    };
    await storeValues(input.values);
    for (const [i, s] of skus.entries()) {
      const identity = combinations[i];
      let sku = s.id
        ? await tx.sKU.findFirst({
            where: { id: s.id, tenantId, productId: row.productId },
          })
        : null;
      if (s.id && !sku) fail('SKU identity does not belong to this product.');
      if (
        sku &&
        (sku.code !== s.code ||
          sku.identityKey !== identity.key ||
          sku.manufacturerPartNumber !== s.manufacturerPartNumber ||
          sku.archived)
      )
        fail(
          'A physical SKU identity is immutable or archived. Create a new identity for a different configuration.',
        );
      sku ??= await tx.sKU.create({
        data: {
          tenantId,
          productId: row.productId,
          code: s.code,
          manufacturerPartNumber: s.manufacturerPartNumber,
          identityKey: identity.key,
          identityFacts: json(identity.facts),
          createdBy: actor,
        },
      });
      const sr = await tx.sKURevision.create({
        data: {
          tenantId,
          productId: row.productId,
          productRevisionId: row.id,
          skuId: sku.id,
          combinationKey: identity.key,
          state: s.state,
        },
      });
      for (const media of row.skus.find((old) => old.skuId === sku.id)?.media ??
        []) {
        const { id: _, skuRevisionId: __, ...reference } = media;
        await tx.sKURevisionMedia.create({
          data: {
            ...reference,
            presentation: json(media.presentation),
            skuRevisionId: sr.id,
          },
        });
      }
      await storeValues(s.values, sr.id);
    }
    await tx.productRevision.update({
      where: { id: row.id },
      data: {
        schemaVersionId: input.schemaVersionId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        content: json(input.content),
        brandId: input.brandId,
        sellingMode: input.sellingMode,
        revision: { increment: 1 },
        updatedBy: actor,
      },
    });
    return this.row(tx, tenantId, row.productId, row.id);
  }
  create(
    actor: string,
    tenantId: string,
    input: z.infer<typeof v.productCreate>,
  ) {
    return this.write(actor, tenantId, 'products.create', async (tx) => {
      const schema = await this.schema(tx, tenantId, input.schemaVersionId);
      const root = await tx.product.create({
        data: {
          tenantId,
          productTypeId: schema.productTypeId,
          code: input.code,
          externalReference: input.externalReference,
          createdBy: actor,
        },
      });
      const revision = await tx.productRevision.create({
        data: {
          tenantId,
          productId: root.id,
          productTypeId: root.productTypeId,
          schemaVersionId: schema.id,
          number: 1,
          name: input.name,
          slug: input.slug,
          createdBy: actor,
          updatedBy: actor,
        },
      });
      const saved = await this.persist(
        tx,
        actor,
        tenantId,
        await this.row(tx, tenantId, root.id, revision.id),
        input,
      );
      await this.audit(tx, actor, tenantId, 'product_created', root.id);
      return { ...saved, rootRevision: root.revision };
    });
  }
  save(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
    input: z.infer<typeof v.productSave>,
  ) {
    return this.write(actor, tenantId, 'products.update', async (tx) => {
      const root = await this.root(tx, tenantId, productId),
        row = await this.row(tx, tenantId, productId, id);
      if (root.archived || row.status !== 'DRAFT')
        throw new ConflictException(
          'Only a nonarchived product draft may change. Clone reviewed facts first.',
        );
      if (row.revision !== input.revision) stale();
      const saved = await this.persist(tx, actor, tenantId, row, input);
      await this.audit(tx, actor, tenantId, 'product_draft_saved', id);
      return { ...saved, rootRevision: root.revision };
    });
  }
  clone(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
    revision: number,
  ) {
    return this.write(actor, tenantId, 'products.update', async (tx) => {
      const root = await this.root(tx, tenantId, productId),
        source = await this.row(tx, tenantId, productId, id);
      if (source.revision !== revision) stale();
      if (
        root.archived ||
        source.status === 'DRAFT' ||
        (await tx.productRevision.count({
          where: { tenantId, productId, status: 'DRAFT' },
        }))
      )
        throw new ConflictException(
          'Edit the existing draft or choose a nonarchived product.',
        );
      const last = await tx.productRevision.findFirstOrThrow({
        where: { productId, tenantId },
        orderBy: { number: 'desc' },
      });
      const row = await tx.productRevision.create({
        data: {
          tenantId,
          productId,
          productTypeId: root.productTypeId,
          schemaVersionId: source.schemaVersionId,
          number: last.number + 1,
          name: source.name,
          slug: source.slug,
          description: source.description,
          content: source.content!,
          brandId: source.brandId,
          sellingMode: source.sellingMode,
          createdBy: actor,
          updatedBy: actor,
        },
      });
      for (const media of source.media) {
        const { id: _, productRevisionId: __, ...reference } = media;
        await tx.productRevisionMedia.create({
          data: {
            ...reference,
            presentation: json(media.presentation),
            productRevisionId: row.id,
          },
        });
      }
      for (const binding of source.bindings) {
        const b = await tx.productAttributeBinding.create({
          data: {
            tenantId,
            productRevisionId: row.id,
            schemaBindingId: binding.schemaBindingId,
            attributeId: binding.attributeId,
            level: binding.level,
            required: binding.required,
            axis: binding.axis,
            sortOrder: binding.sortOrder,
            snapshot: binding.snapshot!,
          },
        });
        const pv = source.values.find((v) => v.bindingId === binding.id);
        if (pv) {
          const { options, ...value } = typedValue(b, inputValues([pv])[0]);
          const v = await tx.productAttributeValue.create({
            data: {
              ...value,
              tenantId,
              productRevisionId: row.id,
              bindingId: b.id,
            },
          });
          if (options.length)
            await tx.productAttributeChoice.createMany({
              data: options.map((optionId) => ({
                tenantId,
                valueId: v.id,
                optionId,
              })),
            });
        }
      }
      for (const s of source.skus) {
        const sr = await tx.sKURevision.create({
          data: {
            tenantId,
            productId,
            productRevisionId: row.id,
            skuId: s.skuId,
            state: s.state,
            combinationKey: s.combinationKey,
          },
        });
        for (const media of s.media) {
          const {
            id: _,
            skuRevisionId: __,
            productRevisionId: ___,
            ...reference
          } = media;
          await tx.sKURevisionMedia.create({
            data: {
              ...reference,
              presentation: json(media.presentation),
              productRevisionId: row.id,
              skuRevisionId: sr.id,
            },
          });
        }
        for (const old of s.values) {
          const b = await tx.productAttributeBinding.findFirstOrThrow({
            where: {
              tenantId,
              productRevisionId: row.id,
              attributeId: old.binding.attributeId,
            },
          });
          const { options, ...value } = typedValue(b, inputValues([old])[0]);
          const v = await tx.sKUAttributeValue.create({
            data: {
              ...value,
              tenantId,
              productId,
              productRevisionId: row.id,
              skuRevisionId: sr.id,
              bindingId: b.id,
            },
          });
          if (options.length)
            await tx.sKUAttributeChoice.createMany({
              data: options.map((optionId) => ({
                tenantId,
                valueId: v.id,
                optionId,
              })),
            });
        }
      }
      await this.audit(tx, actor, tenantId, 'product_draft_cloned', row.id);
      return {
        ...(await this.row(tx, tenantId, productId, row.id)),
        rootRevision: root.revision,
      };
    });
  }
  async validate(
    tx: ScopeTransaction,
    tenantId: string,
    row: Awaited<ReturnType<ProductsService['row']>>,
  ) {
    const schema = await this.schema(tx, tenantId, row.schemaVersionId);
    const bindings = row.bindings;
    for (const b of schema.attributes) {
      if (
        b.attribute.status !== 'ACTIVE' ||
        b.attribute.optionSet?.status === 'ARCHIVED'
      )
        fail('A schema attribute or vocabulary is archived.');
    }
    validateValues(bindings, inputValues(row.values), 'PRODUCT', true);
    const active = row.skus.filter(
        (s) => s.state === 'ACTIVE' && !s.sku.archived,
      ),
      axes = bindings.filter((b) => b.axis);
    const badMedia =
      (await tx.productRevisionMedia.count({
        where: {
          tenantId,
          productRevisionId: row.id,
          asset: { OR: [{ archived: true }, { rights: { not: 'APPROVED' } }] },
        },
      })) +
      (await tx.sKURevisionMedia.count({
        where: {
          tenantId,
          productRevisionId: row.id,
          asset: { OR: [{ archived: true }, { rights: { not: 'APPROVED' } }] },
        },
      }));
    if (badMedia)
      fail(
        'Media references require approved usage rights and nonarchived assets.',
      );
    for (const value of inputValues(row.values).filter(
      (v) => v.options?.length,
    )) {
      if (
        (await tx.optionValue.count({
          where: {
            tenantId,
            id: { in: value.options },
            status: 'ACTIVE',
            optionSet: { status: 'ACTIVE' },
          },
        })) !== value.options!.length
      )
        fail('Archived product option values cannot be approved.');
    }
    if (
      !active.length &&
      !(schema.allowNoSku && ['INFORMATIONAL', 'RFQ'].includes(row.sellingMode))
    )
      fail('This selling policy requires an explicit active SKU.');
    if (!axes.length && active.length > 1)
      fail('A product without selectable axes has one default SKU.');
    for (const s of active) {
      const values = inputValues(s.values);
      validateValues(bindings, values, 'SKU', true);
      if (combination(bindings, values).key !== s.sku.identityKey)
        fail('SKU physical identity conflicts with this revision.');
      for (const value of values.filter((v) => v.options?.length)) {
        const count = await tx.optionValue.count({
          where: {
            tenantId,
            id: { in: value.options },
            status: 'ACTIVE',
            optionSet: { status: 'ACTIVE' },
          },
        });
        if (count !== value.options!.length)
          fail(
            'Archived options cannot enter approved catalog configurations.',
          );
      }
    }
    return {
      valid: true,
      purchasable: false,
      pricing: 'SEPARATE_STORE_SKU_OFFER',
      inventory: 'SEPARATE_STORE_SKU_BALANCE',
      activeSkuCount: active.length,
    };
  }
  async compare(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
  ) {
    await this.context(actor, tenantId, 'products.view');
    const root = await this.root(this.db, tenantId, productId),
      row = await this.row(this.db, tenantId, productId, id);
    const previous = root.publishedRevisionId
      ? await this.row(this.db, tenantId, productId, root.publishedRevisionId)
      : null;
    let validation;
    try {
      validation = await this.validate(this.db, tenantId, row);
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
      revision: row.revision,
      previousRevisionId: previous?.id ?? null,
      changed: (
        [
          'name',
          'slug',
          'description',
          'content',
          'brandId',
          'sellingMode',
          'schemaVersionId',
        ] as const
      ).filter((k) => JSON.stringify(row[k]) !== JSON.stringify(previous?.[k])),
      skuChanges: {
        before: previous?.skus.length ?? 0,
        after: row.skus.length,
      },
      affectedStoreListings: await this.db.listingRevision.count({
        where: {
          tenantId,
          productId,
          status: { in: ['APPROVED', 'PUBLISHED'] },
        },
      }),
      validation,
    };
  }
  transition(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
    action: v.Action,
    input: z.infer<typeof v.lifecycle>,
  ) {
    const permissions = {
      review: 'products.submit',
      draft: 'products.update',
      approve: 'products.approve',
      publish: 'products.publish',
      archive: 'products.archive',
    };
    const permission = permissions[action];
    if (!permission) fail('Unknown catalog lifecycle action.');
    return this.write(actor, tenantId, permission, async (tx) => {
      const root = await this.root(tx, tenantId, productId),
        row = await this.row(tx, tenantId, productId, id);
      if (row.revision !== input.revision) stale();
      if (root.archived) fail('Product identity is archived.');
      const states = {
        review: ['DRAFT'],
        draft: ['IN_REVIEW'],
        approve: ['IN_REVIEW'],
        publish: ['APPROVED'],
        archive: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'],
      };
      if (!states[action].includes(row.status))
        throw new ConflictException('Invalid product revision transition.');
      if (['review', 'approve', 'publish'].includes(action))
        await this.validate(tx, tenantId, row);
      if (
        action === 'publish' ||
        (action === 'archive' && root.publishedRevisionId === id)
      ) {
        if (input.rootRevision !== root.revision) stale();
        if (action === 'publish' && root.publishedRevisionId)
          await tx.productRevision.update({
            where: { id: root.publishedRevisionId },
            data: { status: 'ARCHIVED', revision: { increment: 1 } },
          });
        await tx.product.update({
          where: { id: productId },
          data: {
            publishedRevisionId: action === 'publish' ? id : null,
            revision: { increment: 1 },
          },
        });
      }
      const status = {
        review: 'IN_REVIEW',
        draft: 'DRAFT',
        approve: 'APPROVED',
        publish: 'PUBLISHED',
        archive: 'ARCHIVED',
      }[action] as
        'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
      await tx.productRevision.update({
        where: { id },
        data: {
          status,
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
      await this.audit(tx, actor, tenantId, 'product_' + action, id);
      return {
        ...(await this.row(tx, tenantId, productId, id)),
        rootRevision: (await this.root(tx, tenantId, productId)).revision,
      };
    });
  }
  archive(
    actor: string,
    tenantId: string,
    productId: string,
    revision: number,
  ) {
    return this.write(actor, tenantId, 'products.archive', async (tx) => {
      const root = await this.root(tx, tenantId, productId);
      if (root.revision !== revision) stale();
      if (
        await tx.storeListing.count({
          where: { tenantId, productId, archived: false },
        })
      )
        throw new ConflictException('Archive dependent store listings first.');
      await tx.product.update({
        where: { id: productId },
        data: { archived: true, revision: { increment: 1 } },
      });
      await this.audit(
        tx,
        actor,
        tenantId,
        'product_identity_archived',
        productId,
      );
      return this.root(tx, tenantId, productId);
    });
  }
  archiveSku(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
    revision: number,
  ) {
    return this.write(actor, tenantId, 'skus.archive', async (tx) => {
      const root = await this.root(tx, tenantId, productId);
      if (root.revision !== revision) stale();
      const sku = await tx.sKU.findFirst({
        where: { id, tenantId, productId },
      });
      if (!sku) throw new NotFoundException('SKU not found.');
      if (
        await tx.listingSKU.count({
          where: {
            tenantId,
            skuRevision: { skuId: id },
            revision: { status: { in: ['APPROVED', 'PUBLISHED'] } },
          },
        })
      )
        throw new ConflictException(
          'Published listing pins this SKU; publish a replacement listing configuration first.',
        );
      await tx.sKU.update({ where: { id }, data: { archived: true } });
      await tx.product.update({
        where: { id: productId },
        data: { revision: { increment: 1 } },
      });
      await this.audit(tx, actor, tenantId, 'sku_identity_archived', id);
      return { id, archived: true };
    });
  }
  async resolve(
    actor: string,
    tenantId: string,
    productId: string,
    id: string,
    input: z.infer<typeof v.resolve>,
  ) {
    await this.context(actor, tenantId, 'products.view');
    const row = await this.row(this.db, tenantId, productId, id),
      root = await this.root(this.db, tenantId, productId);
    return resolveVariants(
      row.bindings
        .filter((b) => b.axis)
        .map((b) => ({
          attributeId: b.attributeId,
          options: (b.snapshot as Snapshot).options,
        })),
      row.skus.map((s) => ({
        id: s.id,
        skuId: s.skuId,
        code: s.sku.code,
        archived:
          root.archived ||
          (row.status === 'ARCHIVED' && !row.publishedAt) ||
          s.sku.archived ||
          s.state === 'ARCHIVED',
        selections: Object.fromEntries(
          s.values
            .filter((v) => v.binding.axis)
            .map((v) => [v.binding.attributeId, v.choices[0]?.optionId]),
        ),
        specifications: inputValues(s.values),
      })),
      input.selection,
      input.changedAttributeId,
    );
  }
}
