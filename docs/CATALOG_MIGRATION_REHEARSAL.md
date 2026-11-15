# Milestone 7A — legacy catalog migration rehearsal

Branch: `feature/commerce-catalog-migration`, based on `04fad3a`.
Scope: local, disposable PostgreSQL 18.4 only. No production connections, pushes,
deployments, remote providers, cloud resources or operational schedules.

## Implementation and source preservation

`backend/scripts/legacy-catalog-manifest.mjs` inventories the actual static data,
detail-gallery adapter, category filters, descriptions and canonical site setting.
The canonical JSON digest is independent of object key order and source-file line
endings. Image digests use original binary bytes. The checked-in manifest checksum
is `be5f9367bcb48e0f01768d45aea28d1303d1a19cef4043a8a767feed8236b02a`.
Regenerate it rather than editing generated JSON.

The manifest has 84 source products, 12 flat categories, 95 gallery references and
all eight members of each editorial collection. Homepage presentation remains
seven products followed immediately by View All. No source poster, selectable
variant, SKU photo or additional informational block was found or invented.

The importer checks both URL configuration and the actual connected database name
and server address before any mutation. Only development/test execution with a
loopback `_dev`/`_test` database is accepted. The test command owns a fresh random
cluster/database and overwrites connection environment in child processes with its
own in-memory random credentials. It does not use production/local credential files.
The historical ignored `.local/product-types/67b04dbf0329e417` is untouched.

Initialization uses a fresh fixture Owner and foundation only in that newly created
database. **The importer never seeds roles, creates/resets an Owner, changes a
password or grants memberships.** Real authenticated scoped admin APIs create,
review, approve and publish definitions/products/listings. Direct operator writes
only initialize empty-store preferences, retain source evidence and create private
REFERENCE media records. The default store is PKR, en-PK, Asia/Karachi.

One session advisory lock excludes overlapping imports. Each source record is
journaled before import, uses a stable hashed code, and becomes immutable when
complete. Source/manifest changes or conflicting publication history stop import
without overwriting records. Completed records are skipped, not upserted over
admin edits. Interrupted category and product prefixes resume through existing
states. A complete second import makes zero writes/audit additions and no duplicates.
This is resumable per record, **not** an all-or-nothing 84-product transaction;
intermediate approved/public records can exist in the explicitly enabled development
store. A future production backfill must remain behind a closed rollout gate.

## Mapping and publication rules

| Source | Destination and preservation |
|---|---|
| String product ID | Product.externalReference and immutable sourceKey; exact public legacyId. Internal relational UUIDs stay UUIDs |
| Product/category slug | Exact canonical `/products/slug` route; legacy nested product links retain existing 308 handler |
| Category identity | Exact slug/sourceKey plus scoped Category UUID/code; no inferred hierarchy |
| Names/descriptions/brand | Published ProductRevision/ListingRevision and tenant-owned CatalogBrand |
| Original specifications | Original JSON values/types in immutable CatalogImportRecord.source; ordered TEXT attributes preserve displayed values |
| Reviewed scalar/unit measurements | Supplemental NUMBER fields with registered canonical unit and exact decimal grammar; no guessed unit conversions |
| Existing category facets | PRODUCT MULTI_SELECT attributes with exact legacy adapter values, stable option codes, approved filter sets; no variant axes |
| Manufacturer part number | SKU.manufacturerPartNumber, separate from internal SKU code; missing values remain null |
| Legacy product with no options | Exactly one active default SKU pin, no Cartesian combinations |
| Reference price/provenance | Exact CatalogImportRecord.referenceAmount and original source evidence; never StorePrice/PriceRevision |
| Unknown stock | No InventoryItem or quantity records created; public availability unknown |
| Featured/New Arrivals | Store listing featuredOrder/newArrivalOrder retains all eight members; catalogOrder preserves original general/category ordering |
| Gallery/source/rights/alt/order | Private MediaAsset with REFERENCE provider, UNVERIFIED rights, publicUse=false; intended revision/purpose/order retained in immutable mapping |

Raw TEXT values include fourteen numeric Cores/Threads source values displayed as
strings under the existing specification API contract. The exact original JSON
numbers remain in source evidence and have supplemental canonical count fields.
Shared semantics reuse definitions; generic Type/Form factor/Interface labels are
category-qualified to avoid equating unrelated meanings. No attribute is inferred
from product titles. No option sets create alternate purchasable configurations.

Source evidence and its reference amount are immutable. Reference-price projection
requires the exact imported published listing pin; a subsequent listing publication
cannot silently reuse the old reference price. Arbitrary product externalReference
values are not projected as public legacy identities. Public catalog graph reads
remain scoped through the owned listing and compound database foreign keys.

The SQL migration `202611020007_catalog_import_evidence` is additive. It adds the
source journal with ownership FKs/checks/immutability trigger, Store.locale and
ListingRevision.catalogOrder. It has been exercised on disposable databases only.
Existing authentication, category/product/SKU lifecycle constraints and media rights
validation remain enforced. Unapproved media is not attached to published revisions
to work around those constraints.

## Explicit differences and remaining review

`backend/docs/catalog-migration/exceptions.json` contains 130 source review items:
79 missing source-filter values, seven unrecorded manufacturer part numbers and
44 measurements without a lossless registered-unit mapping. Originals are retained;
missing information is not manufactured. All 95 referenced local image files exist.

Data preservation passes; **complete visual/commercial parity is not claimed**:

- Dynamic gallery delivery intentionally withholds all unapproved/development-only
  images. The renderer shows its truthful fallback. Existing static public files
  remain accessible as before; no new approval or public asset was created.
- Dynamic category facets preserve the 177 equivalent source value predicates,
  but approved option codes replace human query values, hyphens become valid
  configuration-code underscores and dynamic URL keys use `f.`. Existing bookmarked
  filter query translation requires a production compatibility decision.
- Dynamic price sorting/filtering concerns approved selling offers, not retailer
  reference prices. Reference-price browsing range/order is not silently represented
  as approved-offer behavior. The imported catalog has no selling offers.
- Monetary display uses exact PKR decimal formatting and an explicit reference label.
- Product breadcrumb links/canonical identities are preserved; the current dynamic
  breadcrumb text uses the full name instead of modelIdentifier. Source model text
  and SEO metadata are retained in evidence.
- Development dynamic pages intentionally remain noindex. Production SEO/gating and
  approved remote media delivery still need separate implementation/review.
- Twelve flat dynamic categories use the existing accessible navbar dropdown to
  avoid horizontal overflow; the dynamic footer includes all twelve. Static default
  navigation/layout remains unchanged.

These are recorded transformations/review decisions, not evidence that a production
switch has been approved. No source data loss was found in the automated comparisons.

## Reproduction and verification evidence

Run from the repository root with existing installed dependencies:

```powershell
npm run catalog:manifest --prefix backend
node backend/scripts/catalog-migration-reports.mjs
npm run test:catalog-migration --prefix backend
npm run test:storefront --prefix backend
npm run test:foundation --prefix backend
npm test --prefix backend
npm run lint --prefix backend
npm run lint --prefix admin
npm run lint --prefix frontend
npm run build --prefix frontend
```

The migration harness applies all migrations to its own fresh database, imports
through real APIs, compares every product/category, repeats import, checks all facet
values, and starts actual clean production-built dynamic and static Next.js apps.
It compares representative category/product metadata/headings at 1440, 768 and
390 pixels, tests dynamic filter interaction, all 84 legacy redirects, media fallback,
homepage limits, canonical URLs, noindex and sitemap. Its temporary API, PostgreSQL,
frontend builds and browser are stopped/removed in finally. No credentials, SQL
parameters or dump contents are included in evidence.

| Evidence under backend/docs/catalog-migration | Purpose |
|---|---|
| manifest.json | Complete source records, hashes, category/product logical mappings and editorial source order |
| mappings.json | Product Types, shared/raw/canonical/filter attribute decisions and source/destination codes |
| exceptions.json | All missing/unmapped source fields requiring review |
| media.json | All 95 references, file digests, rights/purpose/order and delivery restrictions |
| verification.json | Actual migration/API/idempotence/security/browser test outcomes and owned cleanup |
| parity.json | Per-product destination IDs and comparison classifications; all 84/12 coverage |
| browser-parity.json | Real static/dynamic app comparisons and all legacy redirect results |
| performance.json | SQL plan, measured latency and constant query count for page sizes 1 and 24 |
| regressions.json | Final build/lint, auth, multi-industry, isolation and dependency-audit summary |
| synthetic-regression-performance.json | Separate retail same-SKU growth-fixture query evidence |
| security.json | Final staged-content secret scan and changed-file inventory |

The separate M6 suite tests real retail multi-variant keyboards/mice, apparel,
inquiry vehicles, same-SKU price/availability predicates, ordered shared/variant
posters and private drafts/media. These synthetic fixtures never enter the legacy
VOGPK store. M7A additionally uses a different tenant/store with 84 source-name/slug
inquiry shadows plus 200 synthetic inquiries to test isolation and growth. This
is a bounded development performance sample, not production-scale retail load proof.
Public read query counts stay constant with page size; relation batching still
issues multiple SQL statements and warrants load measurement on real infrastructure.

Final migration and M1–M6 regression runs passed with their owned infrastructure
cleaned up. An earlier regression run passed its functional checks but exited on a
Windows EBUSY cleanup error. The retry window was extended and the rerun passed.
The earlier ignored directory `backend/.local/product-types/acd76544aca0301f` remains:
automatic approval review rejected its native PowerShell removal with the reason
“blocked by policy.” A separate read-only process check found zero PostgreSQL
processes owning it. No alternative deletion was attempted; it is excluded from Git.
This is separate from the historical `67b04dbf0329e417` directory, which was preserved.

Runtime dependency audits report zero findings for all three applications. Full
audits retain inherited development-tool moderate findings (backend 2; admin 16;
frontend 16); no forced unrelated dependency upgrades are included. The pg client
emits an existing query-concurrency deprecation warning during relation reads; this
is recorded, not suppressed or claimed as a test failure.

## Recommendation

**GO for reviewing the completed development rehearsal. NO-GO for production migration.**
Resolve the listed media rights/provider, reference-filter/query-URL/breadcrumb
decisions, production import/RBAC installation, actual backup/restore prerequisite,
production catalog gates and compatible staged releases. Follow
`CATALOG_MIGRATION_PRODUCTION_RUNBOOK.md` only under separate approvals. After admin
edits begin, silently reverting to static data is unsafe; preserve/reconcile the
edit delta and prefer a compatible dynamic release or a forward fix.
