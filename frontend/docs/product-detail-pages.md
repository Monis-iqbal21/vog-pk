# Dynamic product detail pages

Implemented against the existing catalogue on 27 October 2026. No catalogue prices, original image assets, collection flags, or homepage carousel layout were changed.

## Delivered

| Item | Result |
|---|---|
| Canonical product pages | 84 at `/products/<existing-slug>` |
| Compatibility redirects | 84 from `/products/<category>/<existing-slug>` |
| Categories supported | All 12 |
| Products with existing specification data rendered | 84 |
| Products with reviewed additional-angle galleries | 11 |
| Products with confirmed purchasable variant sets | 0 |
| Products with licensed rich marketing content | 0 |

The single template supports galleries, keyboard-accessible thumbnails, a native-dialog image lightbox, category-specific grouped specifications, optional data-driven options, quantity controls, accurate reference pricing, warranty/delivery placeholders, all six requested content block types, and related products using the existing ProductCard and ProductCarousel. Canonical metadata and Product JSON-LD use the actual product identity and images. No fabricated Offers, availability, ratings, reviews or discounts are emitted.

## Routes and data

- `src/app/products/[slug]/page.jsx`: shared, statically generated product detail page and metadata. Invalid slugs use `notFound()`.
- `src/app/products/[slug]/[productSlug]/page.jsx`: verifies category/model membership and redirects to the canonical page. Next.js requires the same first dynamic segment name at this route level, so the compatibility route interprets its first `slug` as the old category.
- `src/lib/products.js`: catalogue lookup, detail augmentation, canonical paths and same-category related products. The current product is excluded.
- `src/data/productDetails.js`: optional per-product additions without rewriting all 84 listing records. The defaults are empty options, variants and content blocks.
- `src/data/product-detail-gallery.js`: eleven reviewed secondary angles. Primary images and listing data remain intact.
- `src/config/productSpecifications.js` and `src/lib/product-specifications.js`: category field groups, labels and omission of unknown/empty values. Other known factual fields remain visible under Additional details. Values are not embedded in React components.
- `src/lib/product-options.js`: explicit variant matching, unavailable-combination handling, variant-specific SKU/specification/media/pricing resolution, and purchase eligibility. Missing variant prices or stock do not inherit an unrelated base SKU's values.

Confirmed future variant definitions can contain `id`, `sku`, `selections`, `price`, `referencePricePKR`, approval flags, verified integer stock, `imageIds` or `gallery`, and specification overrides. Options are displayed only when multiple explicitly defined configurations exist. No Cartesian product of options is generated. The advanced dependency extension supports swatches, buttons and dropdowns with explicit partial selections. Complete selections use `?variant=<id>` through reload and browser history; invalid IDs resolve to no variant and prompt a fresh choice. See [the variant contract and verification report](product-variants.md).

All current products have retailer-reference prices only. Add to Cart and quantity controls stay disabled until verified VOGPK selling prices, stock and an actual cart callback exist. No success toast, local fake cart or checkout was introduced.

## Components and presentation

Created under `src/components/products/`:

- `ProductDetail.jsx`: shared composition and selected-variant state.
- `ProductGallery.jsx`: aspect-preserving main image, thumbnail controls and lightbox.
- `ProductInfo.jsx`: identity, highlights, reference/selling price distinction, availability, guarded purchase controls, warranty and delivery.
- `ProductOptions.jsx`: optional selectors from actual variant data.
- `ProductSpecifications.jsx`: reusable grouped definition lists with stacked mobile rows.
- `ProductContentBlocks.jsx`: `featureText`, `featureList`, `imageText`, `wideBanner`, `verticalPoster`, and `specifications`.
- `RelatedProducts.jsx`: existing cards/carousel, same category, excluding the current product.
- `ProductDetail.css`: scoped styling using existing colour, spacing and typography tokens. Desktop uses two columns; tablet/mobile stack gallery before information.

Rich images require a local source and real width/height metadata. Wide banners and posters use responsive width with automatic height; tall media is not cropped into a square. Unsupported or absent blocks are omitted. Images use Next Image with contain behaviour.

Modified `ProductCard.jsx` to link to canonical detail pages; its separate plus button and carousel drag suppression remain intact. Added the known deployment URL to `src/config/site.js` for absolute canonical and Open Graph URLs. Navbar, footer and homepage hero were not modified.

## Additional image rights and files

Eleven additional hardware-only views were selected from the already reviewed public Open Icecat gallery records, converted to local WebP without upscaling, and saved under `public/images/products/gallery/`. Their original aspect ratios are preserved. Sources, selected indices, permission restrictions and modifications are documented in `product-detail-gallery-sources.json`; per-product entries in `public/images/products/credits.html` include the added source links.

These are development demonstration assets subject to the same existing launch-clearance restrictions, not newly cleared production photography. No retailer posters were copied. The unassigned user JPG and video are untouched.

Reproducible preparation: `node scripts/prepare-product-detail-gallery.mjs`. It uses the documented allowlist, stops on failed/restricted downloads and adds the image credits. If the older base catalogue generator regenerates `credits.html`, rerun this detail-gallery preparation step afterward to restore the additional-angle notices.

## Isolated development fixtures

`src/dev/productDetailFixtures.js` contains clearly fictional test SKUs, prices, stock, options and original geometric SVG layout artwork. This data is never imported into the real catalogue.

The fixture page and media routes under `src/app/dev/product-fixtures/` require **both** development mode and `VOG_ENABLE_DETAIL_FIXTURES=1`. Normal development without that flag and every production build return 404. They are marked noindex. The fixture notice explicitly says the data is fictional and not available for purchase; no real cart callback is supplied.

To run fixtures locally in PowerShell:

```powershell
$env:VOG_ENABLE_DETAIL_FIXTURES='1'
npm run dev -- --port 3001
```

Fixture URLs are `/dev/product-fixtures/keyboard`, `/dev/product-fixtures/mouse` and `/dev/product-fixtures/case`. They test dependent configurations and all six block types, landscape/portrait media, a 4:1 banner, a 1:3 poster, undefined option combinations, stock-zero variants, reference/approved pricing separation and query-string selection. No fake variants or marketing artwork are shown on the real product pages.

## Verification

- ESLint: passed.
- Production build: passed, with 84 static detail pages and 84 compatibility redirects.
- `node scripts/test-product-details.mjs`: all 84 identities, prices, stock, collection flags and original specifications preserved; all local gallery files/dimensions valid; all 12 groups render; related products exclude the current product. Variant guards, price isolation, missing/invalid variant handling, stock validation and discount approval pass.
- `node scripts/test-product-detail-browser.cjs`: HTTP 200 for all 84 canonical pages, HTTP 308 with correct Location for all 84 legacy paths, and 404 for missing products and mismatched category/product paths. Server-rendered titles, descriptions, canonical URLs, Open Graph images, exact per-product specification rows and honest Product JSON-LD verified.
- 96 product page browser checks: one representative from each of 12 categories at 1440, 1280, 1024, 768, 430, 390, 375 and 320px. Images decode, thumbnails switch by mouse/keyboard, lightbox opens and closes with Escape, layouts adapt, purchase controls stay disabled, related cards load, and there is no horizontal page overflow or page error.
- `node scripts/test-product-detail-browser.cjs --fixtures`: SKU, price, image and specification updates; undefined combinations disabled and existing out-of-stock configurations inspectable with purchasing disabled; query reload/back/forward; invalid variants resolve to no configuration; all six block types; and rich media aspect ratios at six widths passed. Production fixture page and media access both return 404.
- Existing homepage regression checks: 112 section/viewport checks passed, with canonical product card links. Seven products plus View All remain in Featured/New Arrivals; category behaviour is unchanged. Separate desktop dragging, touch swiping, independent scrolling and click-suppression checks passed.

Browser scripts use `PLAYWRIGHT_MODULE` when Playwright is provided by an external workspace runtime, and `VOG_BASE_URL` to select the local production or fixture server. The fixture test requires the flagged development server. Verification JSON files are stored in this directory; screenshots are local under `%TEMP%/vog-product-details`.

## Missing information and scope limits

- Seven processor records have model names/numbers but no recorded manufacturer SKU. Those SKU fields are omitted.
- Specification coverage is factual but partial; absent clocks, caches, power requirements, ports, dimensions or other fields are omitted rather than guessed.
- VOGPK warranty and delivery terms are unconfirmed for all 84 products. No retailer coverage or delivery promise is presented as VOGPK policy.
- All 84 selling prices and stock remain unapproved/unverified. Purchasing stays disabled.
- Zero live products have confirmed variant sets or licensed marketing posters/banners. Architecture support is implemented and fixture-tested, not fabricated into catalogue entries.
- Existing image-quality exceptions for i9-14900K resolution and the i5-11400 photographed specimen remain documented in the catalogue audit; product-page work did not replace those identities or prices.
- Category-listing, all-products, deals and other non-product destination pages remain outside this product-detail task. The related carousel's browse card links to the existing homepage category section.
- No backend, checkout, payments, admin, reviews or account features were added. No push or deployment was performed for this task.
