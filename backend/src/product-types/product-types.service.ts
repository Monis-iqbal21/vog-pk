import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../security/database.js';
import { ScopedAuthorizationService } from '../security/scoped-authorization.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { SchemaUsageService } from './impact.service.js';
import { UNITS, WIDGETS } from './registry.js';
import * as v from './validation.js';

const graph = {
  groups: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] },
  attributes: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { options: true },
  },
} satisfies Prisma.ProductTypeVersionInclude;
const conflict = () => {
  throw new ConflictException(
    'This configuration changed. Reload before retrying.',
  );
};
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const duplicate = (values: string[]) => new Set(values).size !== values.length;

@Injectable()
export class ProductTypesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ScopedAuthorizationService)
    private readonly authz: ScopedAuthorizationService,
    @Inject(SchemaUsageService) private readonly usage: SchemaUsageService,
  ) {}
  async write<T>(
    actor: string,
    tenantId: string,
    permission: string,
    run: (tx: ScopeTransaction) => Promise<T>,
  ) {
    try {
      return await this.authz.write(async (tx) => {
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          [permission],
          tx,
        );
        return run(tx);
      });
    } catch (error) {
      if (
        error instanceof ConflictException &&
        error.message === 'A role with that code already exists.'
      )
        throw new ConflictException(
          'A definition with that code already exists.',
        );
      throw error;
    }
  }
  audit(
    tx: ScopeTransaction,
    actor: string,
    tenantId: string,
    action: string,
    id: string,
  ) {
    return this.authz.audit(
      tx,
      actor,
      { kind: 'TENANT', tenantId },
      'schema.' + action,
      id,
    );
  }
  async registry(actor: string, tenantId: string) {
    const access = await this.authz.resolve(actor, {
      kind: 'TENANT',
      tenantId,
    });
    if (
      !['attributes.view', 'product-types.view', 'option-sets.view'].some((p) =>
        access.permissions.includes(p),
      )
    )
      await this.authz.require(actor, { kind: 'TENANT', tenantId }, [
        'attributes.view',
      ]);
    return {
      units: UNITS,
      widgets: WIDGETS,
      scopeLevels: ['PRODUCT', 'SKU'],
      schemaStates: ['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'ARCHIVED'],
    };
  }
  async list(
    actor: string,
    tenantId: string,
    resource: 'attributes' | 'option-sets' | 'product-types',
    query: z.infer<typeof v.listInput>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          [`${resource}.view`],
          tx,
        );
        const where = {
          tenantId,
          ...(resource !== 'product-types' && query.status
            ? { status: query.status }
            : {}),
          ...(query.search
            ? {
                OR: [
                  {
                    code: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    label: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        };
        if (resource === 'product-types' && query.status)
          v.fail('Product Type status belongs to a version.');
        const args = {
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ [query.sort]: query.direction }, { id: 'asc' as const }],
        };
        const [items, total] =
          resource === 'attributes'
            ? await Promise.all([
                tx.attributeDefinition.findMany({
                  ...args,
                  include: {
                    optionSet: {
                      include: {
                        values: {
                          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
                        },
                      },
                    },
                  },
                }),
                tx.attributeDefinition.count({ where }),
              ])
            : resource === 'option-sets'
              ? await Promise.all([
                  tx.optionSet.findMany({
                    ...args,
                    include: {
                      values: {
                        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
                      },
                    },
                  }),
                  tx.optionSet.count({ where }),
                ])
              : await Promise.all([
                  tx.productType.findMany({
                    ...args,
                    include: {
                      _count: { select: { versions: true } },
                      versions: {
                        select: {
                          id: true,
                          number: true,
                          status: true,
                          revision: true,
                          label: true,
                        },
                        orderBy: { number: 'desc' },
                        take: 20,
                      },
                    },
                  }),
                  tx.productType.count({ where }),
                ]);
        return { items, total, page: query.page, pageSize: query.pageSize };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async optionSet(actor: string, tenantId: string, id: string) {
    await this.authz.require(actor, { kind: 'TENANT', tenantId }, [
      'option-sets.view',
    ]);
    const row = await this.db.optionSet.findFirst({
      where: { id, tenantId },
      include: { values: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } },
    });
    if (!row) throw new NotFoundException('Option set not found.');
    return row;
  }
  createOptionSet(
    actor: string,
    tenantId: string,
    input: z.infer<typeof v.optionInput>,
  ) {
    return this.write(actor, tenantId, 'option-sets.manage', async (tx) => {
      if (
        duplicate(input.values.map((x) => x.code)) ||
        input.values.some((x) => x.id)
      )
        v.fail('Option codes must be unique; new options cannot supply IDs.');
      const row = await tx.optionSet.create({
        data: {
          tenantId,
          code: input.code,
          label: input.label,
          description: input.description,
          values: {
            create: input.values.map((value) => ({ ...value })),
          },
        },
        include: { values: true },
      });
      await this.audit(tx, actor, tenantId, 'option_set_created', row.id);
      return row;
    });
  }
  updateOptionSet(
    actor: string,
    tenantId: string,
    id: string,
    input: z.infer<typeof v.optionUpdate>,
  ) {
    return this.write(actor, tenantId, 'option-sets.manage', async (tx) => {
      const row = await tx.optionSet.findFirst({
        where: { id, tenantId },
        include: {
          values: { include: { references: { take: 1 } } },
          attributes: { take: 1 },
        },
      });
      if (!row) throw new NotFoundException('Option set not found.');
      if (row.revision !== input.revision) conflict();
      if (duplicate(input.values.map((x) => x.code)))
        v.fail('Duplicate option codes.');
      if (input.status === 'ARCHIVED' && row.attributes.length)
        throw new ConflictException(
          'Referenced option sets cannot be archived.',
        );
      for (const old of row.values) {
        const next = input.values.find((x) => x.code === old.code);
        if (!next || next.id !== old.id)
          throw new ConflictException(
            'Existing options cannot be removed or recoded. Archive an unused option instead.',
          );
        if (next.status === 'ARCHIVED' && old.references.length)
          throw new ConflictException('Referenced options cannot be archived.');
      }
      for (const value of input.values) {
        const old = row.values.find((x) => x.code === value.code);
        const { id: valueId, ...data } = value;
        if (old) await tx.optionValue.update({ where: { id: old.id }, data });
        else {
          if (valueId) v.fail('New option IDs are generated by the server.');
          await tx.optionValue.create({
            data: { ...data, tenantId, optionSetId: id },
          });
        }
      }
      const updated = await tx.optionSet.update({
        where: { id },
        data: {
          label: input.label,
          description: input.description,
          status: input.status,
          revision: { increment: 1 },
        },
        include: {
          values: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] },
        },
      });
      await this.audit(tx, actor, tenantId, 'option_set_updated', id);
      return updated;
    });
  }
  async validateAttribute(
    tx: ScopeTransaction,
    tenantId: string,
    input: z.infer<typeof v.attributeInput>,
  ) {
    const rules = v.validateDefinition(input);
    if (input.optionSetId) {
      const set = await tx.optionSet.findFirst({
        where: { id: input.optionSetId, tenantId, status: 'ACTIVE' },
        include: { values: { where: { status: 'ACTIVE' } } },
      });
      if (!set?.values.length)
        v.fail('Choose an active option set from this tenant.');
      if (input.widget === 'swatch' && set.values.some((x) => !x.swatch))
        v.fail('Swatch controls require colors for all active options.');
      if (
        input.dataType === 'MULTI_SELECT' &&
        (rules.minItems ?? 0) > set.values.length
      )
        v.fail('Not enough options for the minimum selections.');
    }
    return rules;
  }
  createAttribute(
    actor: string,
    tenantId: string,
    input: z.infer<typeof v.attributeInput>,
  ) {
    return this.write(actor, tenantId, 'attributes.create', async (tx) => {
      const rules = await this.validateAttribute(tx, tenantId, input);
      const row = await tx.attributeDefinition.create({
        data: {
          ...input,
          tenantId,
          rules: json(rules),
          visibility: json(input.visibility),
        },
      });
      await this.audit(tx, actor, tenantId, 'attribute_created', row.id);
      return row;
    });
  }
  updateAttribute(
    actor: string,
    tenantId: string,
    id: string,
    input: z.infer<typeof v.attributeUpdate>,
  ) {
    return this.write(actor, tenantId, 'attributes.update', async (tx) => {
      const old = await tx.attributeDefinition.findFirst({
        where: { id, tenantId },
      });
      if (!old) throw new NotFoundException('Attribute not found.');
      if (old.revision !== input.revision) conflict();
      if (old.optionSetId !== input.optionSetId)
        v.fail(
          'An attribute vocabulary is stable. Create a new definition to use another option set.',
        );
      if (input.status !== old.status)
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          ['attributes.archive'],
          tx,
        );
      if (
        old.dataType === 'NUMBER' &&
        UNITS.find((u) => u.code === old.canonicalUnit)?.dimension !==
          UNITS.find((u) => u.code === input.canonicalUnit)?.dimension
      )
        v.fail(
          'An attribute cannot change measurement dimension. Create a new definition.',
        );
      const rules = await this.validateAttribute(tx, tenantId, {
        ...input,
        code: old.code,
        dataType: old.dataType,
      });
      const { revision: _, ...changes } = input;
      const row = await tx.attributeDefinition.update({
        where: { id },
        data: {
          ...changes,
          rules: json(rules),
          visibility: json(input.visibility),
          revision: { increment: 1 },
        },
      });
      await this.audit(tx, actor, tenantId, 'attribute_updated', id);
      return row;
    });
  }
  createType(
    actor: string,
    tenantId: string,
    input: z.infer<typeof v.typeInput>,
  ) {
    return this.write(actor, tenantId, 'product-types.create', async (tx) => {
      const row = await tx.productType.create({
        data: { tenantId, code: input.code, label: input.label },
      });
      const version = await tx.productTypeVersion.create({
        data: {
          tenantId,
          productTypeId: row.id,
          number: 1,
          label: input.label,
          description: input.description,
        },
      });
      await this.audit(tx, actor, tenantId, 'type_created', row.id);
      return { ...row, versions: [version] };
    });
  }
  async getVersion(
    tx: ScopeTransaction,
    tenantId: string,
    typeId: string,
    versionId: string,
  ) {
    const version = await tx.productTypeVersion.findFirst({
      where: { id: versionId, tenantId, productTypeId: typeId },
      include: graph,
    });
    if (!version) throw new NotFoundException('Schema version not found.');
    return version;
  }
  async versions(
    actor: string,
    tenantId: string,
    typeId: string,
    query: z.infer<typeof v.paginationInput>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          ['product-types.view'],
          tx,
        );
        if (
          !(await tx.productType.findFirst({
            where: { id: typeId, tenantId },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Product Type not found.');
        const where = { tenantId, productTypeId: typeId };
        return {
          items: await tx.productTypeVersion.findMany({
            where,
            orderBy: { number: 'desc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            select: {
              id: true,
              number: true,
              status: true,
              revision: true,
              label: true,
            },
          }),
          total: await tx.productTypeVersion.count({ where }),
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async version(
    actor: string,
    tenantId: string,
    typeId: string,
    versionId: string,
  ) {
    await this.authz.require(actor, { kind: 'TENANT', tenantId }, [
      'product-types.view',
    ]);
    return this.getVersion(this.db, tenantId, typeId, versionId);
  }
  saveDraft(
    actor: string,
    tenantId: string,
    typeId: string,
    versionId: string,
    input: z.infer<typeof v.draftInput>,
  ) {
    return this.write(actor, tenantId, 'product-types.update', async (tx) => {
      const old = await this.getVersion(tx, tenantId, typeId, versionId);
      if (old.revision !== input.revision) conflict();
      if (old.status !== 'DRAFT')
        throw new ConflictException(
          'Only a draft can be edited. Clone this version into a new draft.',
        );
      if (
        duplicate(input.groups.map((x) => x.code)) ||
        duplicate(input.fields.map((x) => x.attributeId))
      )
        v.fail('Duplicate groups or attribute bindings.');
      const definitions = await tx.attributeDefinition.findMany({
        where: {
          id: { in: input.fields.map((f) => f.attributeId) },
          tenantId,
          status: 'ACTIVE',
        },
        include: {
          optionSet: {
            include: {
              values: {
                where: { status: 'ACTIVE' },
                orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
              },
            },
          },
        },
      });
      if (definitions.length !== input.fields.length)
        v.fail('Bindings must use active attributes from this tenant.');
      const snapshots = input.fields.map((field) => {
        const def = definitions.find((x) => x.id === field.attributeId)!;
        if (
          !input.groups.some((g) => g.code === field.groupCode) ||
          !def.allowedScopes.includes(field.level) ||
          !WIDGETS[def.dataType].includes(field.widget)
        )
          v.fail('Invalid group, scope or widget.');
        if (
          field.variantAxis &&
          (!def.axisEligible ||
            field.level !== 'SKU' ||
            def.dataType !== 'SINGLE_SELECT')
        )
          v.fail('Invalid variant axis.');
        if (field.required && !field.visibility.admin)
          v.fail('Required fields must be visible in administration forms.');
        if (
          def.optionSet &&
          (def.optionSet.status !== 'ACTIVE' || !def.optionSet.values.length)
        )
          v.fail('An active option vocabulary is required.');
        if (
          field.widget === 'swatch' &&
          def.optionSet?.values.some((x) => !x.swatch)
        )
          v.fail('Swatches require explicit option colors.');
        const rules = v.bindingRules(
          def.dataType,
          def.rules as v.Rules,
          field.rules,
        );
        if (
          def.dataType === 'MULTI_SELECT' &&
          (rules.minItems ?? 0) > (def.optionSet?.values.length ?? 0)
        )
          v.fail('Not enough options for the minimum selections.');
        return {
          field,
          snapshot: {
            code: def.code,
            label: def.label,
            description: def.description,
            dataType: def.dataType,
            canonicalUnit: def.canonicalUnit,
            allowedScopes: def.allowedScopes,
            axisEligible: def.axisEligible,
            definitionRevision: def.revision,
            optionSetRevision: def.optionSet?.revision ?? null,
            rules,
            widget: field.widget,
            visibility: field.visibility,
            options:
              def.optionSet?.values.map(({ id, code, label, swatch }) => ({
                id,
                code,
                label,
                swatch,
              })) ?? [],
          },
        };
      });
      await tx.productTypeAttributeOption.deleteMany({
        where: { tenantId, binding: { versionId } },
      });
      await tx.productTypeAttribute.deleteMany({
        where: { tenantId, versionId },
      });
      await tx.specificationGroup.deleteMany({
        where: { tenantId, versionId },
      });
      for (const group of input.groups)
        await tx.specificationGroup.create({
          data: { ...group, tenantId, versionId },
        });
      const groups = await tx.specificationGroup.findMany({
        where: { tenantId, versionId },
      });
      for (const { field, snapshot } of snapshots) {
        const binding = await tx.productTypeAttribute.create({
          data: {
            tenantId,
            versionId,
            attributeId: field.attributeId,
            groupId: groups.find((g) => g.code === field.groupCode)!.id,
            level: field.level,
            required: field.required,
            variantAxis: field.variantAxis,
            sortOrder: field.sortOrder,
            snapshot: json(snapshot),
          },
        });
        if (snapshot.options.length)
          await tx.productTypeAttributeOption.createMany({
            data: snapshot.options.map((o) => ({
              tenantId,
              bindingId: binding.id,
              optionValueId: o.id,
            })),
          });
      }
      await tx.productTypeVersion.update({
        where: { id: versionId },
        data: {
          label: input.label,
          description: input.description,
          revision: { increment: 1 },
        },
      });
      await this.audit(tx, actor, tenantId, 'draft_saved', versionId);
      return this.getVersion(tx, tenantId, typeId, versionId);
    });
  }
  clone(
    actor: string,
    tenantId: string,
    typeId: string,
    versionId: string,
    revision: number,
  ) {
    return this.write(actor, tenantId, 'product-types.update', async (tx) => {
      const source = await this.getVersion(tx, tenantId, typeId, versionId);
      if (source.revision !== revision) conflict();
      const last = await tx.productTypeVersion.findFirstOrThrow({
        where: { tenantId, productTypeId: typeId },
        orderBy: { number: 'desc' },
      });
      if (
        await tx.productTypeVersion.count({
          where: { tenantId, productTypeId: typeId, status: 'DRAFT' },
        })
      )
        throw new ConflictException(
          'Edit the existing draft before creating another.',
        );
      const draft = await tx.productTypeVersion.create({
        data: {
          tenantId,
          productTypeId: typeId,
          number: last.number + 1,
          label: source.label,
          description: source.description,
        },
      });
      for (const group of source.groups) {
        const g = await tx.specificationGroup.create({
          data: {
            tenantId,
            versionId: draft.id,
            code: group.code,
            label: group.label,
            sortOrder: group.sortOrder,
          },
        });
        for (const f of source.attributes.filter(
          (f) => f.groupId === group.id,
        )) {
          const row = await tx.productTypeAttribute.create({
            data: {
              tenantId,
              versionId: draft.id,
              attributeId: f.attributeId,
              groupId: g.id,
              level: f.level,
              required: f.required,
              variantAxis: f.variantAxis,
              sortOrder: f.sortOrder,
              snapshot: f.snapshot!,
            },
          });
          if (f.options.length)
            await tx.productTypeAttributeOption.createMany({
              data: f.options.map((o) => ({
                tenantId,
                bindingId: row.id,
                optionValueId: o.optionValueId,
              })),
            });
        }
      }
      await this.audit(tx, actor, tenantId, 'draft_cloned', draft.id);
      return this.getVersion(tx, tenantId, typeId, draft.id);
    });
  }
  async impact(
    tx: ScopeTransaction,
    tenantId: string,
    typeId: string,
    versionId: string,
  ) {
    const next = await this.getVersion(tx, tenantId, typeId, versionId),
      type = await tx.productType.findFirstOrThrow({
        where: { id: typeId, tenantId },
      });
    const active = type.activeVersionId
      ? await this.getVersion(tx, tenantId, typeId, type.activeVersionId)
      : null;
    const key = (f: (typeof next.attributes)[number]) =>
      JSON.stringify({
        level: f.level,
        required: f.required,
        variantAxis: f.variantAxis,
        sortOrder: f.sortOrder,
        group: next.groups.find((g) => g.id === f.groupId)?.code,
        snapshot: f.snapshot,
      });
    const oldKey = (f: (typeof next.attributes)[number]) =>
      JSON.stringify({
        level: f.level,
        required: f.required,
        variantAxis: f.variantAxis,
        sortOrder: f.sortOrder,
        group: active?.groups.find((g) => g.id === f.groupId)?.code,
        snapshot: f.snapshot,
      });
    return {
      typeRevision: type.revision,
      activeVersionId: type.activeVersionId,
      candidateVersionId: next.id,
      added: next.attributes
        .filter(
          (f) =>
            !active?.attributes.some((o) => o.attributeId === f.attributeId),
        )
        .map((f) => (f.snapshot as { code: string }).code),
      removed:
        active?.attributes
          .filter(
            (f) =>
              !next.attributes.some((n) => n.attributeId === f.attributeId),
          )
          .map((f) => (f.snapshot as { code: string }).code) ?? [],
      changed: next.attributes
        .filter((f) => {
          const old = active?.attributes.find(
            (o) => o.attributeId === f.attributeId,
          );
          return old && key(f) !== oldKey(old);
        })
        .map((f) => (f.snapshot as { code: string }).code),
      metadataChanged:
        !!active &&
        (active.label !== next.label ||
          active.description !== next.description ||
          JSON.stringify(
            active.groups.map(({ code, label, sortOrder }) => ({
              code,
              label,
              sortOrder,
            })),
          ) !==
            JSON.stringify(
              next.groups.map(({ code, label, sortOrder }) => ({
                code,
                label,
                sortOrder,
              })),
            )),
      usage: await this.usage.inspect(tx, tenantId, next.id),
    };
  }
  async compare(
    actor: string,
    tenantId: string,
    typeId: string,
    versionId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          ['product-types.view'],
          tx,
        );
        return this.impact(tx, tenantId, typeId, versionId);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  transition(
    actor: string,
    tenantId: string,
    typeId: string,
    versionId: string,
    action: 'review' | 'draft' | 'approve' | 'activate' | 'archive',
    input: z.infer<typeof v.transitionInput>,
  ) {
    const permission =
      action === 'approve'
        ? 'product-types.approve'
        : action === 'activate'
          ? 'product-types.activate'
          : action === 'archive'
            ? 'product-types.archive'
            : 'product-types.update';
    return this.write(actor, tenantId, permission, async (tx) => {
      const version = await this.getVersion(tx, tenantId, typeId, versionId);
      if (version.revision !== input.revision) conflict();
      const states = {
        review: ['DRAFT'],
        draft: ['REVIEW'],
        approve: ['REVIEW'],
        activate: ['APPROVED'],
        archive: ['DRAFT', 'APPROVED', 'ACTIVE'],
      } as const;
      if (!(states[action] as readonly string[]).includes(version.status))
        throw new ConflictException('Invalid schema lifecycle transition.');
      if (
        ['review', 'approve', 'activate'].includes(action) &&
        !version.attributes.length
      )
        v.fail('Add at least one attribute before review.');
      if (action === 'activate') {
        const impact = await this.impact(tx, tenantId, typeId, versionId);
        if (input.typeRevision !== impact.typeRevision) conflict();
        if (
          impact.usage.referencedProducts === null ||
          impact.usage.blockingReasons.length
        )
          throw new ConflictException(
            'Resolve the usage impact before activation.',
          );
        if (impact.activeVersionId)
          await tx.productTypeVersion.update({
            where: { id: impact.activeVersionId },
            data: { status: 'ARCHIVED', revision: { increment: 1 } },
          });
        await tx.productType.update({
          where: { id: typeId },
          data: {
            activeVersionId: versionId,
            label: version.label,
            revision: { increment: 1 },
          },
        });
      }
      if (action === 'archive' && version.status === 'ACTIVE') {
        const type = await tx.productType.findFirstOrThrow({
          where: { id: typeId, tenantId },
        });
        if (input.typeRevision !== type.revision) conflict();
        const usage = await this.usage.inspect(tx, tenantId, versionId);
        if (
          usage.referencedProducts === null ||
          usage.referencedProducts > 0 ||
          usage.blockingReasons.length
        )
          throw new ConflictException(
            'An in-use active version cannot be archived.',
          );
        await this.authz.require(
          actor,
          { kind: 'TENANT', tenantId },
          ['product-types.activate'],
          tx,
        );
        await tx.productType.update({
          where: { id: typeId },
          data: { activeVersionId: null, revision: { increment: 1 } },
        });
      }
      const next = (
        {
          review: 'REVIEW',
          draft: 'DRAFT',
          approve: 'APPROVED',
          activate: 'ACTIVE',
          archive: 'ARCHIVED',
        } as const
      )[action];
      await tx.productTypeVersion.update({
        where: { id: versionId },
        data: {
          status: next,
          revision: { increment: 1 },
          ...(action === 'approve'
            ? { approvedBy: actor, approvedAt: new Date() }
            : {}),
        },
      });
      await this.audit(tx, actor, tenantId, 'version_' + action, versionId);
      return this.getVersion(tx, tenantId, typeId, versionId);
    });
  }
}
