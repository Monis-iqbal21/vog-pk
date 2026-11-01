import { z } from 'zod';
import { fail } from '../product-types/validation.js';
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
export const query = z
  .object({
    category: slug.optional(),
    collection: z.enum(['featured', 'new-arrivals']).optional(),
    related: slug.optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(24).default(12),
    sort: z
      .enum(['editorial', 'name', 'price-asc', 'price-desc', 'newest'])
      .default('editorial'),
    search: z.string().trim().max(80).default(''),
    filters: z.string().max(4096).default(''),
    facets: z.enum(['include', 'omit']).default('include'),
  })
  .strict();
export function facetQuery(raw: string) {
  const params = new URLSearchParams(raw),
    result: Record<string, string[]> = Object.create(null) as Record<
      string,
      string[]
    >;
  let total = 0;
  for (const [key, value] of params) {
    if (
      !/^[a-z][a-z0-9_]{0,63}$/.test(key) ||
      value.length > 120 ||
      ++total > 40
    )
      fail('Invalid or excessive filter parameters.');
    (result[key] ??= []).push(value);
    if (result[key].length > 12) fail('Too many facet choices.');
  }
  return result;
}
export type CatalogQuery = z.infer<typeof query>;
