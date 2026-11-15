// Read-only plan: no DB connection, import, price approval, stock or variants.
import { createHash } from 'node:crypto';
import {
  products,
  productCategories,
} from '../../frontend/src/data/products.js';
export function legacyCatalogPlan() {
  if (
    products.length !== 84 ||
    productCategories.length !== 12 ||
    new Set(products.map((p) => p.id)).size !== 84 ||
    new Set(products.map((p) => p.slug)).size !== 84
  )
    throw Error('Legacy catalog identity changed; review source inventory.');
  const records = products.map((p, index) => ({
    externalReference: p.id,
    sourceSlug: p.slug,
    proposedInternalCode: /^[a-z][a-z0-9_]{0,63}$/.test(p.id)
      ? p.id
      : `legacy_${createHash('sha256').update(p.id).digest('hex').slice(0, 24)}`,
    categorySlug: p.category,
    sourceOrder: index,
    featured: p.featured,
    newArrival: p.newArrival,
    referencePrice: {
      amount: p.referencePricePKR ?? null,
      currency: 'PKR',
      approved: false,
    },
    inventory: {
      verified: p.inventoryVerified === true,
      sourceStock: p.stock ?? null,
      importEligibility: 'MANUAL_REVIEW',
    },
    media: {
      path: p.image,
      source: p.imageSourceUrl ?? null,
      credit: p.imageCreditUrl ?? null,
      rights: p.imageUsageStatus ?? 'unverified',
      developmentOnly: p.imageDevelopmentOnly === true,
      posters: [],
    },
    schemaMapping: 'REQUIRES_REVIEW',
    skuConfigurations: 'NOT_INFERRED',
    sellingMode: 'REFERENCE',
    purchasable: false,
  }));
  return {
    mode: 'READ_ONLY_PLAN',
    categories: productCategories.length,
    products: records.length,
    productionWrites: false,
    records,
  };
}
if (process.argv.includes('--summary')) {
  const p = legacyCatalogPlan();
  console.log(
    JSON.stringify({
      mode: p.mode,
      products: p.products,
      categories: p.categories,
      purchasable: false,
      productionWrites: false,
      inferredVariants: 0,
      posterAssignments: 0,
    }),
  );
}
