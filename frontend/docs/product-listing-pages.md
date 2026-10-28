# Product listing pages

## Delivered routes

The shared listing template supports 15 destinations. Existing category URLs were already `/products/<category>`, so that convention is preserved; no duplicate `/category/` route tree was created. Category slugs and product slugs are disjoint and resolve through the existing shared dynamic segment. The catalogue's established accessories slug is `accessories`, not `gaming-accessories`.

| Route | Source and initial result |
|---|---|
| `/products` | All 84 active catalogue products; 12 per page, seven pages |
| `/products/graphics-cards` | Seven graphics cards |
| `/products/processors` | Seven processors |
| `/products/motherboards` | Seven motherboards |
| `/products/ram` | Seven RAM products |
| `/products/storage` | Seven storage products |
| `/products/keyboards` | Seven keyboards |
| `/products/gaming-mice` | Seven mice |
| `/products/monitors` | Seven monitors |
| `/products/power-supplies` | Seven power supplies |
| `/products/pc-cases` | Seven cases |
| `/products/cooling` | Seven cooling products |
| `/products/accessories` | Seven accessories |
| `/collections/featured` | All eight existing curated Featured assignments in catalogue order |
| `/collections/new-arrivals` | All eight existing curated New Arrivals assignments in catalogue order |

Homepage Featured and New Arrivals still show seven cards followed by See All. Their listing pages expose the eighth curated record. New Arrivals is labelled as a curated development launch collection; no arrival or publication dates were created. The default sort is the existing deterministic curated catalogue order. Date-based Newest sorting is omitted because no reliable publication dates exist.

Existing `/products/<product-slug>` detail pages and 84 legacy category/product redirects remain valid. Unknown category/product slugs and unknown collections return 404. Existing products are never turned into categories or duplicated into a separate catalogue.

## Category filter definitions and coverage

Every listing has Brand and validated retailer-reference price controls. All Products and the two mixed-category collections also have Category. Category pages use their own metadata-defined technical facets. Values come exclusively from the configured structured `specifications` keys. No name, short description or marketing-text parsing is used. Comma-separated compatibility and colour fields are split only when the exact facet definition declares them multivalued.

| Category | Technical groups currently rendered | Missing or incomplete requested data |
|---|---|---|
| Graphics Cards | GPU model, VRAM, memory type | GPU manufacturer absent for all seven; omitted |
| Processors | Socket, core count | Separate manufacturer and processor-family fields absent; omitted; actual Brand remains available |
| Motherboards | Socket, chipset, form factor, memory support | All seven have these structured fields |
| RAM | Capacity, DDR generation, rated frequency/data rate, kit, colour | Colour recorded for one of seven; frequency units retained exactly as recorded |
| Storage | Capacity, interface, form factor | Explicit storage type absent; not inferred from SSD names or field names |
| Keyboards | Switch technology, switch model, keyboard size/layout, connectivity, colour | Switch model absent for one of seven; form factor uses exact recorded sizes rather than renaming 80% as TKL |
| Gaming Mice | Connectivity, sensor technology, DPI, weight, colour | Polling rate absent; sensor technology is Optical, not an invented sensor model |
| Monitors | Screen size, resolution, refresh rate, panel type | Panel type absent for one of seven |
| Power Supplies | Wattage, efficiency certification, modularity | All seven have these structured fields |
| PC Cases | Motherboard support, colour, case type, maximum GPU clearance | GPU clearance absent for one of seven |
| Cooling | Cooling type, socket compatibility, colour | Explicit radiator-size class absent; physical radiator width/depth are not used to invent 240/360mm classes |
| Gaming Accessories | Width, depth, colour | Accessory type, connectivity, compatibility and named size absent; dimensions remain useful verified facets |

Exact DPI and weight values are offered as checkbox options; no unsupported numerical buckets are invented. Missing attributes never match a selected technical value. Facets with no recorded values are omitted entirely. Partially covered facets include only the recorded values. The full per-product missing-attribute IDs and source keys are recorded in `product-listing-data-verification.json` under `coverage`.

## Query semantics and presentation

- Repeated values within a facet use OR: `brand=ASUS&brand=GIGABYTE`.
- Separate facets and price limits use AND: `brand=ASUS&vram=16+GB&min=100000&max=500000`.
- Checkbox choices, prices, sorting and page are serialized into the URL. Native history updates run the static query synchronously. Initial server rendering reads the request query, so reload and shared URLs produce the same initial grid. Back/Forward restores the URL state.
- Valid sort values: `default`, `price-asc`, `price-desc`, `name-asc`, `name-desc`. Equal sort values retain catalogue order. Missing prices sort last in either direction.
- `min` and `max` are inclusive non-negative PKR values, with at most two fractional digits. Inputs reject negatives and reversed ranges without applying them. Invalid URL ranges are ignored with an explicit notice. Unknown parameters, unrecognized values and unsupported sorting are ignored safely and reported. A valid value in a repeated group remains applied even if another value is invalid.
- Reference-price filtering consistently uses `referencePricePKR`, matching the current development catalogue. It never enables purchase or manufactures discounts. Reference labels remain on every existing card and on the listing header/price controls.
- Pagination defaults to 12, renders only the current slice into the grid, clamps excessive pages to the last page, and safely handles invalid page numbers. Controls include Previous, Next, numbered pages, ellipses where useful, a current-page indicator and disabled boundary buttons. Pagination is hidden for zero or one page. Filters and sort changes reset to page one. Clear Filters retains the chosen sort and resets pagination.
- Category navigation starts from the clean category URL. Irrelevant category-specific query parameters supplied manually are ignored with a notice rather than producing false matches.
- Facet counts are disjunctive: each group's counts apply all other filters and price bounds while excluding its own selection. Zero-count unchecked values are disabled with explanatory text; zero-count selected values stay enabled for removal. Groups are collapsible; groups with more than six values include a local search field. Active chips remove individual filters, with Clear All available.

The reusable ProductCard retains its existing image, brand, name, description, reference price, plus button, detail link and contain sizing. Its only behavioural extension is using the existing `product-placeholder.svg` when the source is absent or fails to load. No replacement photographs were sourced.

Grid columns: four at 1280px+, three from 1024–1279px, and two below 1024px. Desktop has a filter sidebar. Below 1280px, filters use a native modal drawer with live URL updates and a View Results close action. Native modal behaviour plus explicit Tab wrapping contain focus; Escape closes it, scrolling is locked while open, focus returns to the trigger, and resizing to desktop closes it. Animations respect reduced motion. Narrow-card typography and scoped spacing prevent price/control overlap without changing homepage carousel styles.

Empty scopes show a concise catalogue link; zero matching filters show “No products match your selected filters.” with Clear Filters. There is no artificial loading animation: the current static query is synchronous. No external data-fetch API was added.

## Navigation and SEO

Homepage Featured/New Arrivals See All cards now use their collection routes. Shop by Category already uses `/products/<category>` and now resolves to the selected category listing. Navbar and footer category links using that same convention work without a redesign. Gaming Accessories is included in the Peripherals dropdown. Product-detail category breadcrumbs and related-product See All cards return to their own category listing. The hero's existing Featured CTA destination alone was corrected to `/collections/featured`; hero presentation and carousel behaviour are unchanged.

Each listing has a heading, short description, breadcrumbs, unique title/description, absolute canonical and Open Graph URL. Canonicals always point to the clean category/collection base URL. Request URLs containing query parameters emit `noindex, follow` to avoid indexing filter, sorting and pagination duplicates. Invalid slugs use Next's `notFound()`. No fabricated offers, stock, ratings or reviews are emitted.

Existing unsupported navbar destinations remain visible as before, without invented content or records:

- Gaming PCs: `/products/gaming-pcs`
- Laptops: `/products/laptops`
- Headsets: `/products/headsets`
- Mousepads: `/products/mousepads`
- Controllers: `/products/controllers`
- Deals: `/deals`

Monitors is supported at `/products/monitors`. Existing informational/support footer destinations remain outside this listing task. Search, account, cart and checkout are also outside scope.

## Files created and modified

New files:

- `src/config/categoryFilters.js`: exact source-field adapters, category descriptions and facet metadata.
- `src/lib/product-listings.js`: category/scope lookup, eligible record retrieval, facet extraction/counts, URL parsing/serialization, filtering, stable sorting, pagination, metadata and coverage helpers.
- `src/app/products/page.jsx`: All Products route.
- `src/app/collections/[collection]/page.jsx`: shared Featured/New Arrivals route, rejecting unsupported collection names.
- `src/components/products/ProductListingPage.jsx`: shared composition, URL state, toolbar and empty states.
- `src/components/products/ProductFilters.jsx`, `FilterGroup.jsx`: reference-price validation, checkboxes, search and collapsible facets.
- `src/components/products/MobileFilterDrawer.jsx`: accessible native modal drawer.
- `src/components/products/ProductSort.jsx`, `ProductGrid.jsx`, `ProductPagination.jsx`, `ActiveFilterChips.jsx`: presentation components using the shared query result.
- `src/components/products/ProductListing.css`: scoped responsive listing styling; shared global/navbar/footer tokens unchanged.
- `scripts/test-product-listings.mjs`, `scripts/test-product-listing-browser.cjs`: query/data and browser verification.
- `docs/product-listing-data-verification.json`, `docs/product-listing-browser-verification.json`: machine-readable evidence, including missing attribute coverage.

Modified files:

- `src/app/products/[slug]/page.jsx`: category lookup before product lookup, category static-param allowlist, listing metadata, category breadcrumb destinations; the existing detail template stays intact.
- `src/components/home/FeaturedProducts.jsx`, `NewArrivals.jsx`: collection See All links; New Arrivals subtitle accurately describes the curated launch collection.
- `src/components/products/RelatedProducts.jsx`: category listing destination.
- `src/components/products/ProductCard.jsx`: existing placeholder fallback on missing/broken sources.
- `src/config/navigation.js`: real accessories destination in Peripherals; other existing links retained.
- `src/config/heroSlides.js`: existing Featured destination corrected, no visual/media change.
- `scripts/verify-catalogue-browser.cjs`: expected collection destinations and category listing status updated; verification JSON refreshed by regression tests.

Catalogue records, prices, names, descriptions, original image files, SKUs, category assignments, specifications, curated flags, navbar/footer components and homepage carousel implementations were not rewritten. The unrelated local JPG/video files are untouched. No commit, push or deployment was performed for this task.

## Verification results

- ESLint: passed.
- Next.js production build: passed. Listing queries render at request time, while the 84 existing product detail pages remain statically generated; legacy redirects remain available.
- `node scripts/test-product-listings.mjs`: **40 checks passed**, covering all 84 eligible products, 12 categories, eight records per curated collection, OR/AND semantics, price bounds and invalid values, exact technical values, missing attributes, all five sort modes, stable ties, missing prices, pagination, scope changes, facet counts, URL serialization, canonical metadata and record immutability.
- `node scripts/test-product-listing-browser.cjs`: **15 listing routes**, server-rendered filtered counts, canonical/noindex metadata, invalid slugs, brand/technical/price filters, every sort mode, filter + pagination, clear/chip removal, empty states, invalid URL values, reload, Back/Forward, facet search/collapse, and category reset passed. Actual technical checkbox interactions were verified in **all 12 categories**.
- **135 responsive route/viewport checks** passed at 1920, 1440, 1280, 1024, 768, 430, 390, 375 and 320px. Correct grid columns, equal card-row heights, aligned price baselines, contain images, disabled purchasing and no page overflow verified. Representative desktop/mobile screenshots were visually inspected.
- Drawer checks passed at 1024, 768, 430, 390, 375 and 320px: open/close, first focus, Shift+Tab/Tab wrap, live URL filtering, persisted selection, Clear All, View Results, Escape, body scroll lock and trigger focus restoration.
- Final focused checks at 1440 and 390px confirmed Clear All resets unapplied invalid price drafts and their validation messages, as well as applied price filters, in both the sidebar and drawer.
- Navigation tests passed: homepage collection See All, selected category See All, navbar All Products and category dropdown, card → product detail → category breadcrumb, and related-category destination. A deliberately failed product-image request displayed the existing placeholder correctly.
- Existing product-detail suite passed: **84 canonical pages**, **84 legacy redirects**, truthful metadata/specifications, missing-product 404 and **96 responsive product-page checks**, including gallery thumbnail/keyboard/lightbox interactions.
- Existing data preservation and variant unit suite: **84 catalogue records unchanged** and **49 variant cases passed**.
- Existing homepage browser suite: **112 checks passed** across Featured, New Arrivals and all 12 category tabs, with zero image failures/page errors. Dragging, independent carousels, click suppression and native touch swiping passed.
- Development keyboard/mouse/case fixtures: dependent selections, SKU/price/image/spec updates, URL history, availability distinctions, gallery/lightbox and all six rich content blocks regression-tested at six widths. Production fixture routes stay 404.

Browser scripts accept `PLAYWRIGHT_MODULE` for the bundled Playwright runtime and `VOG_BASE_URL` to select a server. Screenshots are local under `%TEMP%/vog-product-listings`. Existing product-detail/fixture evidence remains in its own verification JSON files and screenshot directory. The intentional missing-image test is distinct from normal catalogue image failures.

## Future NestJS listing contract

The current static query is intentionally isolated in `src/lib/product-listings.js`. Replace its retrieval/query adapter with a NestJS client later; reusable filter/grid/sort/pagination components consume the same normalized result and do not contain category-specific logic.

Suggested endpoint: `GET /api/products` with scope parameters `category` or `collection`, repeated facet parameters, `min`, `max`, `sort`, `page`, and a backend-validated `pageSize` (initially 12). Category scope comes from the route; the mixed All Products Category filter can be mapped separately by the adapter so it does not override route scope.

Request example:

```text
GET /api/products?category=graphics-cards&brand=ASUS&vram=16%20GB&sort=price-asc&page=1&pageSize=12
```

Normalized response shape:

```javascript
{
  items: [/* existing ProductCard-compatible summaries with original product IDs/slugs */],
  total: 5, eligibleCount: 7,
  page: 1, pageSize: 12, pageCount: 1, start: 1, end: 5,
  state: {filters: {brand: ['ASUS'], vram: ['16 GB']}, min: null, max: null, sort: 'price-asc', page: 1, ignored: []},
  facets: [{code: 'vram', label: 'VRAM capacity', values: [{value: '16 GB', label: '16 GB', count: 5}]}]
}
```

Illustrative counts describe the contract only; the actual adapter must calculate them from current data. The admin should manage category-to-attribute assignments, stable attribute/value codes, labels, source units, multivalue flags, display order and verified product values. It should also manage curated collection memberships and rank, approved prices, stock and image rights. Unknown fields remain null or absent. The storefront components can accept newly configured checkbox facets without code changes; only the current static source adapter maps legacy specification keys.

The backend must enforce OR within facets, AND across facets, scope eligibility, disjunctive counts, allowed sort fields, maximum page size, valid numeric bounds, stable tie-breaking, and appropriate public visibility. It should return only current-page summaries instead of shipping the full future catalogue. Map public facet parameters through an allowlist rather than interpolating SQL or arbitrary JSON paths. Use indexed typed attributes and currency-safe prices.

Approved VOGPK price filtering will replace reference-price filtering in the future adapter and must be explicit in both labels and the response price provenance. Reliable publication timestamps are required before offering Newest sorting. Verified option families and variant data can provide explicit normalized facet values; do not infer them from product names. Server-side API errors/loading states should be added with the asynchronous adapter rather than simulating delays in today's synchronous catalogue.

No NestJS API, PostgreSQL schema, Prisma migration, cart, payment, authentication or admin implementation is included here.
