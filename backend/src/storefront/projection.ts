import type { Prisma } from '../generated/prisma/client.js';
import type { Snapshot } from '../catalog/facts.js';
export const publicGraph = {
  listing: {
    include: {
      importRecords: {
        where: { complete: true, kind: 'PRODUCT' },
        select: { sourceKey: true, referenceAmount: true, mapping: true },
      },
    },
  },
  productRevision: {
    include: {
      product: true,
      brand: true,
      schema: { include: { groups: true, attributes: true } },
      bindings: { include: { attribute: true } },
      values: { include: { choices: { include: { option: true } } } },
      media: { include: { asset: true } },
      skus: {
        include: {
          sku: true,
          values: { include: { choices: { include: { option: true } } } },
          media: { include: { asset: true } },
        },
      },
    },
  },
  skus: true,
  media: {
    include: {
      productMedia: { include: { asset: true } },
      skuMedia: { include: { asset: true } },
    },
  },
  categories: true,
} satisfies Prisma.ListingRevisionInclude;
export type PublicRow = Prisma.ListingRevisionGetPayload<{
  include: typeof publicGraph;
}>;
type Source = PublicRow['productRevision']['media'][number];
export function allowedAsset(asset: Source['asset']) {
  return (
    !asset.archived &&
    asset.rights === 'APPROVED' &&
    asset.publicUse &&
    !asset.developmentOnly
  );
}
export function mediaSources(row: PublicRow, skuRevisionId?: string) {
  const shared = row.productRevision.media.filter(
      (m) => m.visible && allowedAsset(m.asset),
    ),
    variant =
      row.productRevision.skus
        .find((s) => s.id === skuRevisionId)
        ?.media.filter((m) => m.visible && allowedAsset(m.asset)) ?? [];
  const selected = row.media
    .filter((m) => m.visible)
    .flatMap((m) => {
      const source = m.productMedia ?? m.skuMedia;
      if (
        !source ||
        !source.visible ||
        !allowedAsset(source.asset) ||
        source.purpose !== m.purpose
      )
        return [];
      if (
        m.skuMedia &&
        (!row.skus.some((s) => s.skuRevisionId === m.skuMedia!.skuRevisionId) ||
          m.skuMedia.skuRevisionId !== skuRevisionId)
      )
        return [];
      return [{ ...source, ...m, asset: source.asset }];
    });
  // Listing overrides replace shared order per purpose. Variant content supplements
  // shared content: changing a SKU must not discard shared promotional posters.
  const overridden = new Set(
    selected.filter((m) => m.productMediaId).map((m) => m.purpose),
  );
  const sharedSequence = [
    ...shared.filter((m) => !overridden.has(m.purpose)),
    ...selected.filter((m) => !m.skuMediaId),
  ].sort(
    (a, b) =>
      a.purpose.localeCompare(b.purpose) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
  const variantSequence = [
    ...selected.filter((m) => m.skuMediaId),
    ...variant.filter((m) => !selected.some((s) => s.skuMediaId === m.id)),
  ].sort(
    (a, b) =>
      a.purpose.localeCompare(b.purpose) ||
      a.sortOrder - b.sortOrder ||
      a.id.localeCompare(b.id),
  );
  return [...sharedSequence, ...variantSequence];
}
export function mediaDto(row: PublicRow, skuRevisionId?: string) {
  return mediaSources(row, skuRevisionId)
    .filter(
      (m) =>
        m.asset.storageProvider === 'LOCAL_DEVELOPMENT' &&
        process.env.PUBLIC_MEDIA_DEVELOPMENT === '1' &&
        ['development', 'test'].includes(process.env.NODE_ENV ?? ''),
    )
    .map((m) => ({
      id: m.id,
      assetId: m.assetId,
      purpose: m.purpose,
      alt: m.altText || m.asset.altText,
      caption: m.caption,
      width: m.asset.width ?? 1,
      height: m.asset.height ?? 1,
      src: `/api/catalog-media/${row.slug}/${m.assetId}?width=640`,
      sources: [320, 640, 1280, 1920].map((width) => ({
        width,
        src: `/api/catalog-media/${row.slug}/${m.assetId}?width=${width}`,
      })),
    }));
}
export function specifications(row: PublicRow, skuRevisionId?: string) {
  const pr = row.productRevision,
    sku = pr.skus.find((s) => s.id === skuRevisionId),
    all = [...pr.values, ...(sku?.values ?? [])];
  return pr.schema.groups
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((group) => ({
      code: group.code,
      label: group.label,
      fields: pr.bindings
        .filter((b) => {
          const s = b.snapshot as Snapshot;
          return (
            s.visibility.storefront &&
            b.attribute.status === 'ACTIVE' &&
            (b.attribute.visibility as { storefront?: boolean }).storefront &&
            pr.schema.attributes.some(
              (a) => a.id === b.schemaBindingId && a.groupId === group.id,
            )
          );
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((b) => {
          const s = b.snapshot as Snapshot,
            v = all.find((v) => v.bindingId === b.id);
          let value: string | boolean | string[] | null = null;
          if (v) {
            if (s.dataType === 'TEXT') value = v.textValue;
            else if (s.dataType === 'NUMBER')
              value = v.numberValue?.toString() ?? null;
            else if (s.dataType === 'BOOLEAN') value = v.booleanValue;
            else
              value = v.choices
                .filter((c) => c.option.status === 'ACTIVE')
                .map((c) => s.options.find((o) => o.id === c.optionId)?.label)
                .filter((l): l is string => !!l);
          }
          return {
            code: s.code,
            label: s.label,
            level: b.level,
            type: s.dataType,
            unit: s.canonicalUnit,
            value,
          };
        }),
    }))
    .filter((g) => g.fields.length);
}
export function axesDto(row: PublicRow) {
  return row.productRevision.bindings
    .filter(
      (b) =>
        b.axis &&
        (b.snapshot as Snapshot).visibility.storefront &&
        b.attribute.status === 'ACTIVE',
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => {
      const s = b.snapshot as Snapshot;
      return {
        id: b.attributeId,
        code: s.code,
        label: s.label,
        options: s.options.map((o) => ({
          id: o.id,
          code: o.code,
          label: o.label,
          swatch: o.swatch ?? null,
        })),
      };
    });
}
export function selectionsDto(
  row: PublicRow,
  sku: PublicRow['productRevision']['skus'][number],
) {
  return Object.fromEntries(
    sku.values.flatMap((v) => {
      const b = row.productRevision.bindings.find((b) => b.id === v.bindingId);
      return b?.axis && v.choices[0]
        ? [[b.attributeId, v.choices[0].optionId]]
        : [];
    }),
  );
}
