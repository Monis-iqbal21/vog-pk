# Catalog migration production runbook — preparation only

For the current November 4 operational preflight, verified fresh recovery point,
migration compatibility matrix, private operator-listener import sequence and
rollback limits, use [Stage 3 final preflight](CATALOG_STAGE3_FINAL_PREFLIGHT.md).
The historical milestone statements below do not supersede that later evidence.
No production execution is authorized by either document.

Milestone 7A rehearses development migration. **Production NO-GO.** No commands in
this document were executed against Oracle, Neon or Vercel during this milestone.
The last reported production backend was `8c75ca5`; its current state requires a
fresh read-only audit before any future rollout. Static storefront mode remains
the default. Existing operational branches, schedules and credentials are unchanged.

## Approval and recovery prerequisites

Obtain separate approval for the reviewed commit, database DDL/backfill, backend
restart, Vercel deployments, media delivery and catalog cutover. A new encrypted
off-server backup of the actual target database must have recorded digest, size,
off-server key custody and a successful isolated PostgreSQL 18 restore drill.
Historical successful recovery evidence does not prove a new recovery point.
Check current Neon restore history and backup age without purchasing snapshots.

Inventory actual migration history, table counts, owner/membership assignments,
store context, route reservations and existing catalog edits. Record hashes of
authentication identity/role state privately; never put hashes or credentials in
public reports. Establish a change freeze or a captured, reconciled edit window.
Identify the exact tenant/store explicitly; never select them from HTTP Host or
the first tenant/store row. Preserve existing Owner and LegacyStoreBridge identity.

## Required schema ordering

The repository contains the following ordered migrations. Compare their recorded
checksums with the production `_prisma_migrations` table first. Never replay an
already applied migration or edit historical SQL to make drift disappear.

1. `202610290001_admin_security`
2. `202611010001_commerce_foundation`
3. `202611010002_product_types`
4. `202611010003_categories_filters`
5. `202611010004_catalog_products`
6. `202611010005_pricing_inventory_media`
7. `202611020006_storefront_read_indexes`
8. `202611020007_catalog_import_evidence`

Migration 8 adds immutable, store-owned source/import evidence, Store.locale and
ListingRevision.catalogOrder. It does **not** import products, approve offers,
set stock, grant media rights, seed users or publish the catalog. Migrations 1–7
have broader schema requirements; review actual unapplied SQL, duration and lock
impact on a restored isolated production copy before approval. There is no down
migration; keep additive tables/columns when reverting application code.

After approval, the reviewed release's backend directory would run:

```bash
npx prisma migrate status
# Only after backup, rehearsal, drift and DDL approval:
npx prisma migrate deploy
npx prisma migrate status
```

Use existing protected environment injection. Do not print connection URLs, pass
them as command-line arguments, overwrite production .env.local, run migrate reset,
db push or blanket `seedSecurity`. That seed replaces global role grants and is
only used by the fresh disposable test harness. Scoped capability installation
for production needs a separately reviewed additive procedure preserving existing
grants and owners; development foundation initialization is not that procedure.

## Backend and Vercel dependencies

Stage the exact approved backend tree in a non-running Oracle ARM64 release
directory using the existing reviewed deployment tooling. Perform clean dependency
installation, Prisma generation, lint, build and safe tests there. Confirm Node,
PostgreSQL client compatibility, artifact checksums, localhost binding, effective
systemd configuration and rollback artifacts. No migrations run implicitly at
backend startup. Restart only through a separately approved controlled activation.
Verify local and public `/api/health` and `/api/health/ready`, database connectivity,
Caddy TLS, `127.0.0.1:4000`, existing admin login/logout and read-only scoped access.

The development importer in this milestone is **not a production import command**.
It rejects non-loopback and non-development/test destinations, verifies actual
server/database identity and calls real scoped admin publication APIs. Never
change NODE_ENV or tunnel production through loopback to bypass this guard.
A separately reviewed production entry point is required. It must retain the same
manifest hashes, route preflight, locking, ownership checks, immutable evidence,
per-record resumability, RBAC and lifecycle validation with an explicit approved
target and dry-run/apply confirmation. It must not create/reset an Owner or seed
global roles. Its absence is a current production blocker.

Backfill sequence after that review: verify frozen source manifest and current
target; initialize only missing store configuration; create approved Product Types
and reused definitions; activate the twelve flat categories and compatible filter
sets; import all 84 products as REFERENCE with one default SKU each; retain source
prices only as reference amounts and unknown inventory; publish listing/category
and exact SKU pins; retain all eight Featured/New Arrivals members with source
ordering; verify all immutable evidence and route ownership; rerun with zero writes.
Do not attach unapproved media to published revisions. Stop on source/hash drift,
route conflicts or unexpected existing revisions; reconcile instead of overwriting.

Admin/storefront deployment must follow compatible database/backend code. Vercel
may automatically deploy when an approved change reaches its configured branch;
check project Git settings and required checks before merging. Preview remains
fail-closed and must not receive production secrets. Rollout must preserve the
working admin URLs, BFF secret boundary, CSRF and session behavior.

## Production catalog gate — deliberately not implemented

Current settings are development-only:

| Application | Development settings | Production behavior |
|---|---|---|
| Backend | PUBLIC_CATALOG_MODE=development, PUBLIC_CATALOG_STORE_ID; NODE_ENV=test/development and verified loopback `_dev`/`_test` database | Refuses dynamic catalog reads |
| Storefront | CATALOG_MODE=dynamic-development, CATALOG_DEVELOPMENT=1, fixed loopback CATALOG_API_ORIGIN | Static unless explicitly configured; development origin cannot reach Oracle from hosted Vercel |
| Media | LOCAL_DEVELOPMENT plus rights/public-use checks | No remote delivery provider activated |

A production-enabled backend/storefront mode with an exact HTTPS API allowlist,
trusted store/domain selection, published catalog version, server-only configuration
and reviewed caching/invalidation is required before cutover. Do not reuse the
development gate in production. Never let query parameters, cookies, Host headers
or client flags select a store or catalog mode.

There is currently no persistent catalog cache: React.cache deduplicates only a
single render, Nest responses are no-store and reads use repeatable-read snapshots.
If persistent caching is introduced later, keys must include trusted store,
publication/version identity, normalized filters/sort/page and media-rights version.
Pricing/stock/rights changes must invalidate it. No stale static price/stock fallback
is permitted. An API outage produces a truthful unavailable state; fix/recover the
API rather than silently substituting static content.

## Integrity, smoke checks and media prerequisites

Before cutover, reproduce all 84-product/12-category comparisons and evaluate every
record, not just counts. Verify source IDs/external references, names, descriptions,
original specification values and types, typed supplements, manufacturer part
numbers, 84 default SKU identities, listing/category pins, source prices/provenance,
95 gallery references/digests, absent posters, editorial order and 96 canonical paths.
Check all 84 legacy `/products/category/product` redirects, sitemap and canonical
URLs. Keep noindex on development. Review production SEO indexability explicitly.

Confirm zero source-derived selling prices, no invented inventory/discounts and no
new public media grants. Verify two tenants/stores including published slug twins,
private drafts, scoped Owner access, CSRF/BFF rejection and same-available-SKU AND
predicates. Test desktop/tablet/mobile, search, page boundaries, facets and empty
states; record query plans and realistic server latency.

Differences requiring acceptance/remediation: dynamic selling-price filters do not
sort/filter retailer reference prices; static filter URLs use human values while
dynamic URLs use approved option codes and `f.` keys; legacy breadcrumb model text
is retained in source but the dynamic renderer uses the full name; dynamic
development is noindex. Do not treat these as unreviewed production equivalents.

All existing media is development-only/unverified. Preserve source, credit and
purpose/order privately. Obtain actual rights, configure and test an approved
remote provider adapter, responsive derivatives, delivery ACLs and archival rules,
then attach/publish immutable relationships through the M5 workflow. No Cloudinary
account/provider is assumed. Audit existing frontend/public/images/products and
remove/restrict unapproved static copies as a separately approved launch action;
blocking the dynamic media API alone does not revoke old static-file access.

## Failure handling and rollback

Stop on failed backup/restore proof, migration drift, route collision, missing source
facts, duplicates, cross-scope data, unauthorized media, authentication failures,
unhealthy readiness, unexpected service configuration, or critical browser errors.
No automatic data deletion or destructive rollback is authorized.

Before the first accepted dynamic admin edit, an explicitly approved gate reversal
to the unchanged static application may be used only after confirming no accepted
database edits would be hidden. Revert backend/Vercel artifacts through their
reviewed rollback procedures, preserve additive schema/evidence and recheck health
and authentication. Never restore/rewind Neon merely to revert application code.

**After database-backed edits begin, static fallback is unsafe**: it hides accepted
products, prices, rights decisions and SKU changes. Disable affected catalog writes,
capture/export the edit delta and audit evidence, then roll forward or use a
compatible previous dynamic release against the same database. An isolated restore
may assist diagnosis; production restoration needs separate recovery approval and
an explicitly reconciled data-loss window. Import reruns reject drift rather than
overwriting new revisions. Keep production NO-GO until these blockers are resolved.
