import type { CompiledFilter, SyntheticProduct } from './compiler.js';
import { convertNumber } from '../product-types/registry.js';
// Development-preview data only: generated from the selected schema, never a
// storefront catalogue, actual prices, product import, inventory or facet engine.
export function previewFixtures(
  filters: CompiledFilter[],
  categoryIds: string[],
  kind: string,
): SyntheticProduct[] {
  const versionIds = [
    ...new Set(
      filters.flatMap((f) => f.snapshot.bindings.map((b) => b.versionId)),
    ),
  ];
  if (!versionIds.length) versionIds.push('fixture-default');
  return versionIds.flatMap((id, index) => {
    const fields = filters.filter(
      (f) =>
        !f.snapshot.bindings.length ||
        f.snapshot.bindings.some((b) => b.versionId === id),
    );
    const attrs = (level: string, last: boolean) =>
      Object.fromEntries(
        fields
          .filter((f) => f.source === 'ATTRIBUTE' && f.snapshot.level === level)
          .map((f) => [
            f.attributeId!,
            f.snapshot.dataType === 'NUMBER'
              ? convertNumber(
                  (last ? f.snapshot.max : f.snapshot.min) ??
                    f.snapshot.min ??
                    f.snapshot.max ??
                    '0',
                  f.snapshot.displayUnit!,
                  f.snapshot.bindings.find((b) => b.versionId === id)!
                    .canonicalUnit!,
                )
              : f.snapshot.dataType === 'BOOLEAN'
                ? !last
                : f.snapshot.dataType === 'MULTI_SELECT'
                  ? [
                      f.snapshot.values[last ? f.snapshot.values.length - 1 : 0]
                        ?.code,
                    ]
                  : f.snapshot.values[last ? f.snapshot.values.length - 1 : 0]
                      ?.code,
          ]),
      );
    const brand =
      fields.find((f) => f.source === 'BRAND')?.snapshot.values[0]?.code ??
      'fixture_brand';
    const currency =
      fields.find((f) => f.source === 'PRICE')?.snapshot.displayUnit ?? 'PKR';
    return [
      {
        id: `${kind}-fixture-${index + 1}`,
        categoryIds: [categoryIds[index % categoryIds.length]],
        typeVersionId: id,
        productTypeId:
          fields
            .flatMap((f) => f.snapshot.bindings)
            .find((b) => b.versionId === id)?.productTypeId ?? 'fixture-type',
        brand,
        attributes: attrs('PRODUCT', false),
        skus: [
          {
            id: 'fixture-first',
            active: true,
            valid: true,
            attributes: attrs('SKU', false),
            stock: 1,
            stockVerified: true,
            approvedPrice: { amount: '100', currency, approved: true },
          },
          {
            id: 'fixture-second',
            active: true,
            valid: true,
            attributes: attrs('SKU', true),
            stock: 0,
            stockVerified: true,
            referencePrice: '1',
          },
        ],
      },
    ];
  });
}
