import { z } from 'zod';
import { code, label, description } from '../product-types/validation.js';
import { revision, slug, seo } from '../categories/validation.js';
export const action = z.enum([
  'review',
  'draft',
  'approve',
  'publish',
  'archive',
]);
export type Action = z.infer<typeof action>;
export const mode = z.enum(['REFERENCE', 'INFORMATIONAL', 'RFQ', 'RETAIL']);
export const value = z
  .object({
    attributeId: z.uuid(),
    text: z.string().max(10000).optional(),
    number: z.string().max(32).optional(),
    boolean: z.boolean().optional(),
    options: z.array(z.uuid()).max(50).optional(),
  })
  .strict();
export const sku = z
  .object({
    id: z.uuid().optional(),
    code: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    manufacturerPartNumber: label.nullable().default(null),
    state: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
    values: z.array(value).max(40),
  })
  .strict();
export const facts = z
  .object({
    schemaVersionId: z.uuid(),
    name: label,
    slug,
    description,
    content: z
      .array(
        z
          .object({ type: z.enum(['paragraph', 'bullet']), text: description })
          .strict(),
      )
      .max(30)
      .default([]),
    brandId: z.uuid().nullable().default(null),
    sellingMode: mode.default('REFERENCE'),
    axisIds: z.array(z.uuid()).max(8).default([]),
    values: z.array(value).max(40).default([]),
    skus: z.array(sku).max(50).optional(),
  })
  .strict();
export const productCreate = facts.extend({
  code,
  externalReference: z.string().min(1).max(160).optional(),
});
export const productSave = facts.extend({ revision });
export const lifecycle = z
  .object({ revision, rootRevision: revision.optional() })
  .strict();
export const archive = z.object({ revision }).strict();
export const brand = z.object({ code, name: label }).strict();
export const list = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(20),
    search: z.string().trim().max(80).default(''),
    status: z
      .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
      .optional(),
    productTypeId: z.uuid().optional(),
  })
  .strict();
export const resolve = z
  .object({
    selection: z
      .array(z.object({ attributeId: z.uuid(), optionId: z.uuid() }).strict())
      .max(8),
    changedAttributeId: z.uuid().optional(),
  })
  .strict();
export const listingCreate = z
  .object({
    code,
    productRevisionId: z.uuid(),
    title: label,
    slug,
    visible: z.boolean().default(true),
    seo: seo.default({ title: '', description: '' }),
    categoryIds: z.array(z.uuid()).max(20).default([]),
    skuRevisionIds: z.array(z.uuid()).max(50).default([]),
    featuredOrder: z.number().int().min(0).max(10000).nullable().default(null),
    catalogOrder: z.number().int().min(0).max(100000).nullable().default(null),
    newArrivalOrder: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullable()
      .default(null),
  })
  .strict();
export const listingSave = listingCreate
  .omit({ code: true })
  .extend({ revision });
export type ValueInput = z.infer<typeof value>;
export type FactsInput = z.infer<typeof facts>;
