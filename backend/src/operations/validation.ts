import { z } from 'zod';
import { code, label, description } from '../product-types/validation.js';
import { revision } from '../categories/validation.js';
export const page = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(12),
    search: z.string().trim().max(80).default(''),
  })
  .strict();
export const instant = z.iso
  .datetime({ offset: true })
  .refine(
    (v) => (v.match(/\.(\d+)/)?.[1].length ?? 0) <= 3,
    'Use millisecond precision or less.',
  );
export const price = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    regularAmount: z.string().max(32),
    validFrom: instant.nullable().default(null),
    validUntil: instant.nullable().default(null),
    promotions: z
      .array(
        z
          .object({
            amount: z.string().max(32),
            startsAt: instant,
            endsAt: instant,
            label,
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict();
export const priceSave = price.extend({ revision });
export const lifecycle = z
  .object({ revision, rootRevision: revision.optional() })
  .strict();
export const action = z.enum([
  'review',
  'draft',
  'approve',
  'publish',
  'archive',
]);
export const settings = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    timeZone: z.string().max(80),
    expectedCurrency: z.string().length(3),
    expectedTimeZone: z.string().max(80),
  })
  .strict();
export const location = z
  .object({ code, name: label, isDefault: z.boolean().default(false) })
  .strict();
export const policy = z
  .object({
    revision: z.number().int().min(0),
    policy: z.enum(['QUANTITY', 'SERIALIZED', 'NON_STOCK', 'UNTRACKED']),
    lowStockThreshold: z
      .number()
      .int()
      .min(0)
      .max(1000000000)
      .nullable()
      .default(null),
  })
  .strict();
export const adjustment = z
  .object({
    locationId: z.uuid(),
    expectedRevision: z.number().int().min(0),
    idempotencyKey: z.uuid(),
    mode: z.enum(['COUNT', 'DELTA', 'INVALIDATE']),
    quantity: z.number().int().min(-1000000000).max(1000000000),
    reason: description.refine((v) => v.trim().length >= 3),
  })
  .strict();
export const purposes = z.enum([
  'GALLERY',
  'DETAIL_POSTER',
  'SIZE_CHART',
  'DIMENSIONS',
  'INSTALLATION_GUIDE',
  'FEATURE_DIAGRAM',
  'OTHER_CONTENT',
]);
export const sourceUrl = z
  .url()
  .max(1000)
  .refine(
    (v) =>
      new URL(v).protocol === 'https:' &&
      !new URL(v).username &&
      !new URL(v).password,
  )
  .nullable()
  .default(null);
export const upload = z
  .object({
    uploadKey: z.uuid(),
    fileName: z
      .string()
      .min(1)
      .max(160)
      .refine((v) => !/[\\/<>]/.test(v) && v !== '.' && v !== '..'),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    dataBase64: z.string().min(4).max(8388608),
    altText: label,
    caption: description.nullable().default(null),
    intendedPurpose: purposes,
    sourceUrl,
  })
  .strict();
export const metadata = z
  .object({
    revision,
    altText: label,
    caption: description.nullable(),
    intendedPurpose: purposes,
    sourceUrl,
    attribution: description,
  })
  .strict();
export const approveMedia = z
  .object({
    revision,
    license: description.refine((v) => v.trim().length >= 3),
    attribution: description,
    scope: z.enum(['DEVELOPMENT', 'PUBLIC']),
    evidenceUrl: sourceUrl,
    evidenceNote: z.string().max(1000).default(''),
    conditions: z.string().max(1000).default(''),
  })
  .strict();
export const rejectMedia = z
  .object({
    revision,
    reason: description.refine((v) => v.trim().length >= 3),
    evidenceUrl: sourceUrl,
    conditions: z.string().max(1000).default(''),
  })
  .strict();
export const presentation = z
  .object({
    fit: z.enum(['contain', 'cover']).default('contain'),
    loading: z.enum(['lazy', 'eager']).default('lazy'),
    alignment: z.enum(['start', 'center', 'end']).default('center'),
    widths: z
      .array(
        z
          .number()
          .int()
          .refine((v) => [320, 640, 1280, 1920].includes(v)),
      )
      .min(1)
      .max(4)
      .default([320, 640, 1280]),
  })
  .strict();
export const reference = z
  .object({
    assetId: z.uuid(),
    purpose: purposes,
    altText: label,
    caption: description.nullable().default(null),
    visible: z.boolean().default(true),
    presentation: presentation.default({
      fit: 'contain',
      loading: 'lazy',
      alignment: 'center',
      widths: [320, 640, 1280],
    }),
  })
  .strict();
export const assignments = z
  .object({ revision, references: z.array(reference).max(24) })
  .strict();
export const listingReference = z
  .object({
    productMediaId: z.uuid().nullable().default(null),
    skuMediaId: z.uuid().nullable().default(null),
    purpose: purposes,
    altText: label,
    caption: description.nullable().default(null),
    visible: z.boolean().default(true),
    presentation: presentation.default({
      fit: 'contain',
      loading: 'lazy',
      alignment: 'center',
      widths: [320, 640, 1280],
    }),
  })
  .strict()
  .refine((v) => !!v.productMediaId !== !!v.skuMediaId);
export const listingAssignments = z
  .object({ revision, references: z.array(listingReference).max(24) })
  .strict();
export const thumbnail = z
  .object({
    width: z.coerce
      .number()
      .refine((v) => [320, 640, 1280, 1920].includes(v))
      .default(640),
  })
  .strict();
export type PriceInput = z.infer<typeof price>;
