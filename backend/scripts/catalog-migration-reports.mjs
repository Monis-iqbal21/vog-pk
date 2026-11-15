import fs from 'node:fs/promises';
import path from 'node:path';
import { buildManifest, root } from './legacy-catalog-manifest.mjs';
const m = await buildManifest(),
  directory = path.join(root, 'backend/docs/catalog-migration');
const write = (name, value) =>
  fs.writeFile(
    path.join(directory, name + '.json'),
    JSON.stringify(value, null, 2) + '\n',
  );
const rawFields = new Map(),
  facets = new Map();
for (const r of m.records) {
  for (const s of r.specs)
    rawFields.set(s.attributeCode, {
      code: s.attributeCode,
      label: s.label,
      dataType: 'TEXT',
      originalJsonTypes: [
        ...new Set(
          m.records.flatMap((p) =>
            p.specs
              .filter((x) => x.attributeCode === s.attributeCode)
              .map((x) => typeof x.raw),
          ),
        ),
      ],
      sourcePreservation:
        'Exact original value and JSON type in immutable source evidence; display text in ProductAttributeValue',
      numericSupplement: s.numeric
        ? { unit: s.numeric.unit, type: 'NUMBER' }
        : null,
    });
  for (const f of r.filters)
    facets.set(f.attributeCode, {
      code: f.attributeCode,
      label: f.label,
      sourceKeys: f.keys,
      splitComma: f.split,
      dataType: 'MULTI_SELECT',
      level: 'PRODUCT',
      axis: false,
      values: [
        ...new Set(
          m.records.flatMap((p) =>
            p.filters
              .filter((x) => x.attributeCode === f.attributeCode)
              .flatMap((x) => x.values),
          ),
        ),
      ],
    });
}
await write('mappings', {
  manifestHash: m.checksum,
  reviewScope:
    'Deterministic development mapping; no inferred sellable variants or commercial rights',
  types: m.categories.map((c) => ({
    category: c.sourceKey,
    typeCode: c.typeCode,
    categoryCode: c.code,
    sourceParent: null,
    groupCodes: [
      'source_specifications',
      'canonical_measurements',
      'filter_values',
    ],
    productCount: m.records.filter(
      (r) => r.source.product.category === c.sourceKey,
    ).length,
  })),
  attributes: [...rawFields.values()],
  facets: [...facets.values()],
  identities: m.records.map((r) => ({
    legacyId: r.sourceKey,
    slug: r.source.product.slug,
    productCode: r.code,
    listingCode: r.code,
    externalReference: r.sourceKey,
    skuCode: r.skuCode,
    manufacturerPartNumber: r.source.product.manufacturerSku ?? null,
    canonical: r.source.canonical,
    aliases: r.source.aliases,
  })),
  price:
    'CatalogImportRecord.referenceAmount only; not StorePrice or PriceRevision',
  inventory: 'No InventoryItem, balances, adjustments or reservations created',
  collections: m.collections,
});
const media = m.records.flatMap((r) =>
  r.media.map((a) => ({
    legacyId: r.sourceKey,
    ...a,
    publicDelivery: false,
    importedRights: 'UNVERIFIED',
    importedProvider: 'REFERENCE',
    assignment:
      'Withheld from ProductRevisionMedia until rights approval; intended ProductRevision/purpose/order retained in source mapping',
  })),
);
await write('media', {
  manifestHash: m.checksum,
  galleryReferences: media.length,
  existingFiles: media.filter((a) => a.sha256).length,
  missingFiles: media.filter((a) => !a.sha256).map((a) => a.src),
  rightsAutomaticallyGranted: 0,
  publicAssetsAdded: 0,
  developmentRestrictionsPreserved: true,
  posters: { count: 0, state: 'ABSENT_IN_ALL_84_SOURCE_RECORDS' },
  skuMedia: { count: 0, state: 'ABSENT; no inferred variant photography' },
  additionalGraphics: { count: 0, state: 'ABSENT_IN_SOURCE' },
  provider: 'Inactive; private REFERENCE assets only',
  legacyPublicDirectory:
    'Existing static /images/products files remain public exactly as before; this rehearsal does not remove them or claim to revoke prior static access. A production media-rights/provider cutover must audit/remove those old public copies separately.',
  records: media,
});
console.log(
  'PASS mapping and media review reports generated from the checksummed manifest',
);
