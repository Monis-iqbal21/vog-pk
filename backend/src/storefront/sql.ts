import { Prisma } from '../generated/prisma/client.js';
import type { Predicate } from '../categories/compiler.js';
const sql = Prisma.sql;
export const and = (parts: Prisma.Sql[]) =>
  parts.length ? sql`(${Prisma.join(parts, ' AND ')})` : sql`TRUE`;
export function predicate(p: Predicate) {
  let match: Prisma.Sql;
  if (p.source === 'PRICE')
    match = and([
      sql`lr."sellingMode"='RETAIL'`,
      sql`o.currency=${p.currency}`,
      sql`o.amount IS NOT NULL`,
      ...(p.min === undefined ? [] : [sql`o.amount>=${p.min}::numeric`]),
      ...(p.max === undefined ? [] : [sql`o.amount<=${p.max}::numeric`]),
    ]);
  else if (p.source === 'AVAILABILITY')
    match = sql`(CASE WHEN lr."sellingMode"='RETAIL' AND o.amount IS NOT NULL THEN o.availability ELSE 'unknown' END) IN (${Prisma.join(p.values!)})`;
  else if (p.source === 'BRAND')
    match = sql`b.code IN (${Prisma.join(p.values!)})`;
  else {
    const table =
        p.level === 'SKU'
          ? sql`"SKUAttributeValue"`
          : sql`"ProductAttributeValue"`,
      choice =
        p.level === 'SKU'
          ? sql`"SKUAttributeChoice"`
          : sql`"ProductAttributeChoice"`,
      scope =
        p.level === 'SKU'
          ? sql`v."skuRevisionId"=sr.id`
          : sql`v."productRevisionId"=pr.id`;
    let value: Prisma.Sql;
    if (p.kind === 'range')
      value = Prisma.join(
        Object.entries(p.canonicalByVersion ?? {}).map(([id, r]) =>
          and([
            sql`pr."schemaVersionId"=${id}::uuid`,
            sql`v.unit=${r.unit}`,
            ...(r.min === undefined
              ? []
              : [sql`v."numberValue">=${r.min}::numeric`]),
            ...(r.max === undefined
              ? []
              : [sql`v."numberValue"<=${r.max}::numeric`]),
          ]),
        ),
        ' OR ',
      );
    else
      value = sql`(v."textValue" IN (${Prisma.join(p.values!)}) OR v."booleanValue"::text IN (${Prisma.join(p.values!)}) OR EXISTS(SELECT 1 FROM ${choice} c JOIN "OptionValue" ov ON ov.id=c."optionId" AND ov."tenantId"=v."tenantId" WHERE c."valueId"=v.id AND ov.status='ACTIVE' AND ov.code IN (${Prisma.join(p.values!)})))`;
    match = sql`EXISTS(SELECT 1 FROM ${table} v JOIN "ProductAttributeBinding" ab ON ab.id=v."bindingId" JOIN "AttributeDefinition" ad ON ad.id=ab."attributeId" AND ad.status='ACTIVE' WHERE ${scope} AND v."tenantId"=pr."tenantId" AND ab."attributeId"=${p.attributeId}::uuid AND ab.snapshot->'visibility'->>'storefront'='true' AND ad.visibility->>'storefront'='true' AND (${value}))`;
  }
  return and([
    ...(p.versionIds.length
      ? [
          sql`pr."schemaVersionId" IN (${Prisma.join(p.versionIds.map((id) => sql`${id}::uuid`))})`,
        ]
      : []),
    match,
  ]);
}
// One row per valid offered SKU. All SKU predicates, price and availability use
// this very row; independent EXISTS clauses may never select different variants.
export function offerCte(storeId: string, tenantId: string, now: Date) {
  return sql`
WITH stock AS (
 SELECT i.id,i.policy,COUNT(s.id) FILTER(WHERE l.active AND s.known) AS verified,
 COALESCE(SUM(s."onHand") FILTER(WHERE l.active),0) AS quantity
 FROM "InventoryItem" i LEFT JOIN "StockBalance" s ON s."inventoryItemId"=i.id
 LEFT JOIN "InventoryLocation" l ON l.id=s."locationId"
 WHERE i."storeId"=${storeId}::uuid AND i."tenantId"=${tenantId}::uuid GROUP BY i.id
), location_count AS (SELECT COUNT(*) AS n FROM "InventoryLocation" WHERE "storeId"=${storeId}::uuid AND "tenantId"=${tenantId}::uuid AND active), offers AS (
 SELECT sr.id AS "skuRevisionId",sr."skuId",sp.currency,
 CASE WHEN sp.id IS NOT NULL THEN COALESCE(promo.amount,sp."regularAmount") END AS amount,
 sp."regularAmount",promo.label AS promotion,
 CASE WHEN st.policy='NON_STOCK' THEN 'in_stock'
 WHEN st.policy='QUANTITY' AND lc.n>0 AND st.verified=lc.n THEN CASE WHEN st.quantity>0 THEN 'in_stock' ELSE 'out_of_stock' END ELSE 'unknown' END AS availability,
 CASE WHEN st.policy='QUANTITY' AND lc.n>0 AND st.verified=lc.n THEN st.quantity END AS quantity,
 COALESCE(st.policy::text,'UNTRACKED') AS policy
 FROM "SKURevision" sr JOIN "SKU" sku ON sku.id=sr."skuId" AND NOT sku.archived
 LEFT JOIN "StorePrice" price ON price."skuId"=sku.id AND price."storeId"=${storeId}::uuid AND price."tenantId"=${tenantId}::uuid
 LEFT JOIN "PriceRevision" sp ON sp.id=price."publishedRevisionId" AND sp.status='PUBLISHED' AND sp."approvedAt" IS NOT NULL AND sp."publishedAt" IS NOT NULL
 AND (sp."validFrom" IS NULL OR sp."validFrom"<=${now}) AND (sp."validUntil" IS NULL OR sp."validUntil">${now})
 LEFT JOIN LATERAL(SELECT p.amount,p.label FROM "PricePromotion" p WHERE p."priceRevisionId"=sp.id AND p."startsAt"<=${now} AND p."endsAt">${now} ORDER BY p."startsAt",p.id LIMIT 1) promo ON TRUE
 LEFT JOIN "InventoryItem" item ON item."skuId"=sku.id AND item."storeId"=${storeId}::uuid AND item."tenantId"=${tenantId}::uuid
 LEFT JOIN stock st ON st.id=item.id CROSS JOIN location_count lc
 WHERE sr."tenantId"=${tenantId}::uuid AND sr.state='ACTIVE' AND EXISTS(SELECT 1 FROM "ListingSKU" pin JOIN "ListingRevision" listing ON listing.id=pin."listingRevisionId" WHERE pin."skuRevisionId"=sr.id AND listing."storeId"=${storeId}::uuid AND listing.status='PUBLISHED' AND listing.visible)
)`;
}
