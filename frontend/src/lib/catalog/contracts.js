import { z } from "zod";
const text = z.string().max(10000),
  code = z.string().max(120),
  amount = z.string().regex(/^\d{1,18}(?:\.\d{1,6})?$/),
  path = z.string().regex(/^\/products\/[a-z0-9-]+$/);
export const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  name: text,
  slug: code,
  description: text,
  image: z
    .object({
      src: z
        .string()
        .regex(/^\/images\/storefront-fixtures\/[a-z0-9-]+\.(webp|png)$/),
      alt: text,
    })
    .nullable(),
  sortOrder: z.number().int(),
  inNavigation: z.boolean(),
  seo: z
    .object({ title: text.optional(), description: text.optional() })
    .passthrough(),
  path,
});
export const mediaSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
  purpose: code,
  alt: text,
  caption: text.nullable(),
  width: z.number().positive(),
  height: z.number().positive(),
  src: z
    .string()
    .regex(
      /^\/api\/catalog-media\/[a-z0-9-]+\/[a-f0-9-]+\?width=(320|640|1280|1920)$/,
    ),
  sources: z
    .array(
      z.object({
        width: z.number(),
        src: z
          .string()
          .regex(
            /^\/api\/catalog-media\/[a-z0-9-]+\/[a-f0-9-]+\?width=(320|640|1280|1920)$/,
          ),
      }),
    )
    .max(4),
});
export const offerSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  minorUnits: z.number().int().min(0).max(4),
  amount,
  regularAmount: amount,
  promotion: text.nullable(),
});
export const cardSchema = z.object({
  legacyId: text.nullable().optional(),
  referencePrice: z
    .object({
      currency: z.literal("PKR"),
      minorUnits: z.literal(2),
      amount,
      approved: z.literal(false),
    })
    .nullable()
    .optional(),
  id: z.uuid(),
  slug: code,
  path,
  name: text,
  description: text,
  brand: text,
  sellingMode: z.enum(["REFERENCE", "RETAIL", "RFQ", "INFORMATIONAL"]),
  offer: offerSchema.nullable(),
  availability: z.enum(["in_stock", "out_of_stock", "unknown"]),
  media: z.array(mediaSchema).max(100),
  categories: z.array(categorySchema).max(1000),
  purchasable: z.literal(false),
});
const spec = z
  .array(
    z.object({
      code,
      label: text,
      fields: z
        .array(
          z.object({
            code,
            label: text,
            level: z.enum(["PRODUCT", "SKU"]),
            type: code,
            unit: text.nullable(),
            value: z.union([text, z.boolean(), z.array(text), z.null()]),
          }),
        )
        .max(80),
    }),
  )
  .max(50);
export const detailSchema = cardSchema.extend({
  version: z.literal(1),
  content: z
    .array(z.object({ type: z.enum(["paragraph", "bullet"]), text }))
    .max(30),
  seo: z
    .object({ title: text.optional(), description: text.optional() })
    .passthrough(),
  axes: z
    .array(
      z.object({
        id: z.uuid(),
        code,
        label: text,
        options: z
          .array(
            z.object({
              id: z.uuid(),
              code,
              label: text,
              swatch: text.nullable(),
            }),
          )
          .max(100),
      }),
    )
    .max(8),
  specifications: spec,
  selectedVariant: code.nullable(),
  variants: z
    .array(
      z.object({
        code,
        selections: z.record(z.uuid(), z.uuid()),
        offer: offerSchema.nullable(),
        availability: z.enum([
          "in_stock",
          "out_of_stock",
          "unknown",
          "not_offered",
        ]),
        inventoryPolicy: code,
        media: z.array(mediaSchema).max(100),
        specifications: spec,
      }),
    )
    .max(50),
  checkout: z.literal("DISABLED"),
});
export const navigationSchema = z.object({
  version: z.literal(1),
  store: z.object({ name: text, currency: code }),
  categories: z.array(categorySchema).max(1000),
});
const filter = z.object({
  code,
  label: text,
  description: text,
  group: text,
  sortOrder: z.number(),
  control: z.enum([
    "checkbox_group",
    "single_select",
    "multi_select",
    "number_range",
    "boolean_toggle",
  ]),
  operators: z.array(code),
  values: z
    .array(z.object({ code, label: text, swatch: text.nullish() }))
    .max(100),
  displayUnit: text.nullable(),
  min: z
    .string()
    .regex(/^-?\d{1,18}(?:\.\d{1,6})?$/)
    .optional(),
  max: z
    .string()
    .regex(/^-?\d{1,18}(?:\.\d{1,6})?$/)
    .optional(),
  ui: z.object({ collapsed: z.boolean() }),
});
export const listSchema = z.object({
  version: z.literal(1),
  store: navigationSchema.shape.store,
  category: categorySchema.nullable(),
  categories: z.array(categorySchema).max(1000),
  items: z.array(cardSchema).max(24),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(24),
  sort: code,
  filters: z.array(filter).max(24),
  facets: z
    .array(
      z.object({
        code,
        values: z.array(
          z.object({ code, count: z.number().int().nonnegative() }),
        ),
      }),
    )
    .max(24),
  canonicalFilters: z.string().max(4096),
  evaluatedAt: z.iso.datetime(),
  purchasable: z.literal(false),
});
export const routeSchema = z.object({
  kind: z.enum(["category", "product"]),
  slug: code,
  redirect: z.boolean(),
  path,
});
/** @typedef {import('zod').infer<typeof cardSchema>} CatalogCard */
/** @typedef {import('zod').infer<typeof detailSchema>} CatalogProduct */
/** @typedef {import('zod').infer<typeof listSchema>} CatalogListing */
