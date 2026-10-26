# Category-aware dependent product variants

Implemented on 27 October 2026 as an extension of the existing product detail pages. All 84 catalogue records, slugs, prices, descriptions, primary images, category assignments, specifications, related-product links and editorial placements remain unchanged. No actual catalogue variants were fabricated. No backend, cart service, admin panel, migration, push or deployment was added.

## Behaviour

One resolver handles any number of ordered option dimensions. The category supplies display defaults; only explicit product definitions and variant records create choices. Technical specifications alone never create a selector. Different CPU models, GPU chipsets or motherboard models remain separate products, reached through the existing related-product links.

Supported controls are colour swatches with visible text, selection buttons, and native dropdowns. Product data can override the display type. Unknown/custom option codes use the same engine; sets with more than seven values default to a dropdown. A single genuine active configuration resolves without choice controls. Products without variant records retain their existing single-configuration behaviour.

Options are evaluated in their declared order. An option value's status considers the selected earlier dimensions and actual declared configurations; later choices never prevent changing an earlier dimension. When an earlier choice changes, the resolver walks later choices in order, preserves each compatible choice, clears conflicts, and announces the cleared labels. It does not choose replacement values automatically. For example, Black/Red → White clears Red because White/Red does not exist. Black/Magnetic → White preserves Magnetic. In the three-dimensional case fixture, changing Black/Mesh/Full → White clears Mesh and preserves Full, then asks for Panel Type.

| Option status | Meaning | Control behaviour |
|---|---|---|
| Not offered | No active declared configuration matches this value and selected earlier dimensions | Disabled, explicit label and struck-through value |
| Out of stock | Matching configurations exist and all have verified zero stock | Selectable for inspection, dashed border and explicit label; purchase disabled |
| Inventory unconfirmed | At least one match has unknown/invalid/contradictory inventory and none has confirmed positive stock | Selectable, explicit label; unknown stock never enables purchase |
| Available | At least one match has verified positive integer inventory | Selectable; purchase still requires a complete variant, an approved price and a real cart callback |

An early option can represent several configurations; its status is the best inventory state among its matches (available, then unknown, then sold out). The resolved configuration's exact stock status is shown separately. These labels do not certify selling-price approval or orderability.

Incomplete selections display the missing option labels and only shared product media/specifications. They have no selected SKU, variant price or inventory. Invalid combinations, invalid/deleted/archived IDs and ambiguous configurations resolve to no variant, with an instruction to choose again. Duplicate active IDs, SKUs, combinations, or malformed option selections fail closed instead of choosing the first match.

## Data contract

Add `optionDefinitions` and `variants` through the existing detail override layer (`src/data/productDetails.js`) when verified configuration data becomes available. Existing `options` with `name` keys are also supported. This example describes the shape only and is not inserted into the real catalogue:

```javascript
{
  optionDefinitions: [
    {
      code: 'color', label: 'Colour', displayType: 'swatch',
      values: [{value: 'black', label: 'Black', swatch: '#111827'}]
    },
    {
      code: 'capacity', label: 'Capacity', displayType: 'button',
      values: [{value: '16gb', label: '16 GB'}]
    }
  ],
  variants: [{
    id: 'stable-variant-id', sku: 'VERIFIED-UNIQUE-SKU',
    selections: {color: 'black', capacity: '16gb'},
    active: true, archived: false,
    price: null, regularPrice: null, salePrice: null,
    pricingApproved: false, promotionApproved: false,
    referencePricePKR: null, sourceUrl: null, sourceCheckedAt: null,
    stock: null, inventoryVerified: false, availability: 'unconfirmed',
    images: [], specifications: {}
  }]
}
```

Only declared records exist; no Cartesian combinations are generated. Codes and stored selection values must be stable strings. Labels can change without changing identity. IDs and SKUs identify a configuration, not a temporary option index. Every variant must select exactly one defined value for each option.

`pricePKR` and `stockQuantity` aliases are accepted for future adapters; current `price` and `stock` fields remain supported. If aliases are supplied, they take precedence. Storefront selling values require `pricingApproved`; discounts also require `promotionApproved` and a positive sale price below the regular price. Unknown values must stay null. A retailer reference price is always labelled as a reference and never authorizes purchase.

Variant media accepts local `images` or `gallery` records with `id`, `src`, `alt`, `width`, `height`, optional `creditUrl`, or existing gallery `imageIds`. Missing/empty variant media uses the parent's verified shared gallery. A resolved variant never borrows another variant's price, SKU or photographs. Variant specifications override only their corresponding shared fields. The gallery is kept mounted, retains contain sizing and thumbnails/lightbox, and resolves its active image by source so unrelated image indices are not carried between configurations.

When no variant is complete, a starting price is shown only if matching candidates have different values and **all** have approved selling prices, or **all** have reference prices. Approved and unapproved values are never combined into one advertised offer. A single candidate's price is not presented as the selected configuration's price before the customer completes the selection.

## URL and cart boundaries

Complete selection: `/products/<slug>?variant=<stable-id>`.

Partial selection: `?option.color=White`; all selected partial dimensions are retained in the URL. Partial query values are validated rather than converted to a default configuration. A valid explicit variant ID takes precedence over stale option parameters. Invalid IDs, including `?variant=`, show an error with no fallback price or SKU.

Native history updates preserve unrelated query parameters and the hash. Reload restores complete or partial selections; browser Back/Forward restores the URL selection. Product canonical URLs remain free of configuration parameters and no per-variant pages or speculative offers are generated. The server renders neutral shared data before the browser applies a selected query; no first variant is assumed.

`getCartItem(product, variant, quantity)` returns `{productId, variantId, quantity}` only after resolving the canonical variant record, checking positive integer quantity within verified stock, and checking approved pricing. Missing variants on a variant-bearing product return null. `ProductInfo` additionally requires a real `onAddToCart` callback before enabling controls. All actual catalogue products and all development routes remain unpurchasable in the current application.

## Files created or changed for this extension

| File | Change |
|---|---|
| `src/config/productOptions.js` | New category/common display defaults; no inventory data |
| `src/lib/product-options.js` | Replaced implicit fallback with strict selection, dependency/status, query, data, starting-price and cart helpers |
| `src/lib/products.js` | Pass through optional `optionDefinitions` from detail overrides |
| `src/components/products/OptionValueControl.jsx` | New swatch/button and native dropdown controls |
| `src/components/products/ProductOptions.jsx` | Shared data-driven controls with distinct inventory states |
| `src/components/products/ProductDetail.jsx` | Partial selection, conflict announcements, URL history, selected data composition |
| `src/components/products/ProductInfo.jsx` | Instructions, exact configuration labels, variant/reference/sale/starting prices and guarded cart payload |
| `src/components/products/ProductGallery.jsx` | Source-based active image and persistent gallery instance |
| `src/components/products/ProductDetail.css` | Accessible option states, swatches, dropdown and mobile wrapping |
| `src/dev/productDetailFixtures.js` | Three isolated fictional fixtures, including three option dimensions |
| `src/app/dev/product-fixtures/[fixture]/page.jsx` | Links among the three dev fixtures and safe lookup |
| `src/app/dev/product-fixtures/media/[name]/route.js` | Original geometric colour test media and safe lookup |
| `scripts/test-product-variants.mjs` | New 49-case resolver/data/cart regression suite |
| `scripts/test-product-variants-browser.cjs` | New three-fixture browser and responsive interaction suite |
| `scripts/test-product-details.mjs` | Existing catalogue preservation suite now includes the advanced variant tests |
| `scripts/test-product-detail-browser.cjs` | Fixture branch delegates to the new interaction suite |
| `docs/product-detail-pages.md` | Updates the old fallback/out-of-stock description |
| `docs/product-variants*.json`, `docs/product-detail-*-verification.json` | Machine-readable results |

## Development fixtures and verification

The three fixture routes are keyboard, mouse and case under `/dev/product-fixtures/`. They contain fictional data and original geometric artwork clearly labelled as development tests. They are never added to the catalogue. Both development mode and `VOG_ENABLE_DETAIL_FIXTURES=1` are required; production always returns 404 even with the flag enabled. Normal development without the flag returns 404. The fixtures contain no offers or purchasing callback and are noindex.

```powershell
$env:VOG_ENABLE_DETAIL_FIXTURES='1'
npm run dev -- --port 3001
```

Verification performed:

- `node scripts/test-product-details.mjs`: all 84 original catalogue records/specifications/media retained, all 12 categories, and 49 advanced variant logic cases passed. Includes five-dimension resolution, duplicate record rejection, archived records, invalid inventory, shared-specification isolation, parent-price isolation, sale approval and actual cart identity.
- `VOG_BASE_URL=http://localhost:3001 node scripts/test-product-detail-browser.cjs --fixtures`: all three fixtures passed. Conflicting choices clear visibly; valid downstream choices survive; four option states differ; unknown/sold-out variants remain inspectable; exact SKU, reference/sale price, images and specs change; partial/deep URLs reload; Back/Forward restores state; invalid URLs have no fallback; gallery thumbnail/keyboard/lightbox remain functional. All six rich blocks retain their aspect ratios. Eighteen responsive fixture checks cover 1440, 1024, 768, 430, 390 and 320px, with keyboard activation, touch targets and no horizontal overflow.
- `node scripts/test-product-detail-browser.cjs`: 84 canonical routes, 84 compatibility redirects, missing-product 404, all 12 categories at eight widths (96 responsive checks), preserved SEO/specifications/related links and fixture production 404 passed.
- Existing `verify-catalogue-browser.cjs` and `verify-catalogue-interactions.cjs`: homepage collections/category tabs, seven products plus View All, image loading, independent dragging/touch scrolling and suppressed drag-click navigation checked.
- ESLint and production build passed. No browser page errors in the fixture or product-page suites.

Browser tools use `PLAYWRIGHT_MODULE` for the bundled runtime when needed. The browser verification JSON files are in this directory; screenshots are under `%TEMP%/vog-product-details/variants-*`.

## Catalogue gaps and future backend integration

There are still zero verified variant families in the 84 real catalogue products. Before enabling any selectors there, VOGPK must supply actual family relationships, option definitions and allowed combinations, unique SKUs, approved per-variant prices, verified inventory, correct photography and usage rights, and variant-specific specifications where different. Existing seven missing processor manufacturer SKUs, partial specifications, image-clearance review and unconfirmed warranty/delivery terms remain unchanged. Existing separate models were not combined.

Recommended future entities and relationships:

| Entity | Relationship / important fields |
|---|---|
| Product | Shared identity, slug, category, descriptions, shared specifications/media; has many options and variants |
| ProductOption | Belongs to Product; stable code, label, display type, sort order; unique `(productId, code)` |
| ProductOptionValue | Belongs to ProductOption; stable value code, label, optional swatch, sort order; unique within option |
| ProductVariant | Belongs to Product; stable ID, globally unique SKU, active/archive state, normalized configuration key unique within active family |
| ProductVariantSelection | Joins a variant to an option value; exactly one value per option, all from the same parent product |
| ProductVariantImage | Variant-to-media join with sort order; media stores real dimensions, alt text, source, rights and approval metadata |
| VariantInventory | Belongs to Variant; verified non-negative integer on-hand/reserved quantities, verification time and revision |
| VariantPrice | Belongs to Variant; PKR currency, regular/sale money values, approval state, valid dates and audit history; retailer references stored separately |

The future admin should publish a validated DTO matching this contract. Adding an allowed combination or custom dimension then requires data changes only. Enforce unique IDs/SKUs and option membership in the database, and transactionally reject duplicate combination keys. Keep archived IDs stable for historical cart/order references; do not reuse their SKUs. Persist option order because it controls dependency behaviour.

Backend integration must validate the variant belongs to the product, is active, has the requested genuine combination, and can satisfy quantity at the current approved price. Stock, promotions and totals must be revalidated on the server at cart/order time; browser helpers are not authorization. Use decimal or integer minor-unit money storage, separate reference-price provenance, inventory reservations/concurrency controls and versioned updates. No API routes or Prisma schema are implemented in this change.
