import { z } from 'zod';
import { code, label, description } from '../product-types/validation.js';
export const revision = z.number().int().min(1).max(2147483646);
export const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const media = z
  .object({
    imagePath: z.string().max(240).nullable(),
    bannerPath: z.string().max(240).nullable(),
    alt: label.or(z.literal('')),
  })
  .strict()
  .refine(
    (v) =>
      [v.imagePath, v.bannerPath].every(
        (p) =>
          p === null ||
          (/^\/images\/[a-zA-Z0-9_/-]+\.(?:webp|png|jpg|jpeg|svg)$/.test(p) &&
            !p.includes('..')),
      ),
    'Use approved local image metadata paths.',
  );
export const seo = z
  .object({ title: label.or(z.literal('')), description: description })
  .strict();
export const categoryInput = z
  .object({
    code,
    name: label,
    slug,
    parentId: z.uuid().nullable().default(null),
    description,
    media: media.default({ imagePath: null, bannerPath: null, alt: '' }),
    seo: seo.default({ title: '', description: '' }),
    sortOrder: z.number().int().min(0).max(100000).default(0),
    visible: z.boolean().default(true),
    inNavigation: z.boolean().default(true),
    compatibility: z.enum(['ANY', 'ALLOW_LIST']).default('ANY'),
    productTypeIds: z.array(z.uuid()).max(20).default([]),
  })
  .strict();
export const categoryUpdate = categoryInput
  .omit({ code: true, parentId: true, sortOrder: true })
  .extend({ revision });
export const moveInput = z
  .object({
    revision,
    parentId: z.uuid().nullable(),
    sortOrder: z.number().int().min(0).max(100000),
  })
  .strict();
export const transition = z
  .object({ revision, categoryRevision: revision.optional() })
  .strict();
export const categoryList = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(20),
    search: z.string().trim().max(80).default(''),
    status: z
      .enum(['DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'ARCHIVED'])
      .optional(),
    sort: z.enum(['name', 'sortOrder', 'updatedAt']).default('sortOrder'),
    direction: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
export const treeInput = z
  .object({
    rootId: z.uuid().optional(),
    maxDepth: z.coerce.number().int().min(1).max(32).default(12),
    view: z.enum(['draft', 'active']).default('draft'),
  })
  .strict();
export const filterInput = z
  .object({
    keyId: z.uuid().optional(),
    code,
    label,
    description,
    group: label.default('Filters'),
    sortOrder: z.number().int().min(0).max(10000).default(0),
    visible: z.boolean().default(true),
    source: z.enum(['ATTRIBUTE', 'PRICE', 'BRAND', 'AVAILABILITY']),
    attributeId: z.uuid().nullable().default(null),
    level: z.enum(['PRODUCT', 'SKU']),
    control: z.enum([
      'checkbox_group',
      'single_select',
      'multi_select',
      'number_range',
      'boolean_toggle',
    ]),
    operators: z
      .array(z.enum(['in', 'eq', 'gte', 'lte']))
      .min(1)
      .max(2),
    allowedValues: z.array(label).max(50).default([]),
    min: z.string().optional(),
    max: z.string().optional(),
    displayUnit: z.string().max(24).nullable().default(null),
    typeVersionIds: z.array(z.uuid()).max(20).default([]),
    aliases: z.array(code).max(5).default([]),
    ui: z
      .object({ collapsed: z.boolean().default(false) })
      .strict()
      .default({ collapsed: false }),
  })
  .strict();
export const filterDraft = z
  .object({
    revision,
    includeDescendants: z.boolean(),
    typeVersionIds: z.array(z.uuid()).max(20),
    filters: z.array(filterInput).max(20),
  })
  .strict();
export const historyInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(20),
  })
  .strict();
export const previewInput = z
  .object({
    query: z
      .record(z.string().max(64), z.array(z.string().max(240)).max(20))
      .refine((v) => Object.keys(v).length <= 20),
    fixture: z.enum(['hardware', 'fashion', 'vehicles']).default('hardware'),
  })
  .strict();
export type FilterInput = z.infer<typeof filterInput>;
export type DraftInput = z.infer<typeof filterDraft>;
