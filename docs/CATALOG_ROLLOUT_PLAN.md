# Catalog rollout plan — unexecuted and approval-gated

Latest delivery preparation: [FINAL_PRODUCTION_DELIVERY.md](FINAL_PRODUCTION_DELIVERY.md)
supersedes the implementation-blocker list below with tested guarded production
operator tooling and independent read switches. The 7B/7C text remains historical
context; all production execution still requires separate approval.

Milestone 7C update: [CATALOG_COMPLIANCE.md](CATALOG_COMPLIANCE.md) contains the
latest evidence and stop gates. There are now nine additive migrations; the first
eight are unchanged. Production catalog mutations additionally require the explicit
server-only `CATALOG_ADMIN_WRITES_ENABLED=1` switch, which remains disabled. No
production read mode, importer or upload adapter has been activated or implemented
by this update.

This plan targets the existing Vercel storefront/admin, Oracle Nest API and Neon
database. It creates no cloud resource and assumes no new paid provider. Production
state was not queried in 7B; historical health, backups, hosting limits and deployed
SHAs must be reverified before approval. The original eight-migration ordering and
baseline runbook remain in `CATALOG_MIGRATION_PRODUCTION_RUNBOOK.md`.

## Staging while static remains active

Yes: an additive schema, non-running release, isolated import rehearsal and compatible
application code can be prepared while the storefront still uses its static catalog.
Neither publishing catalog rows nor deploying code should implicitly switch the
storefront read mode. Keep separate controls for catalog writes/import, API read
exposure and storefront read selection. No such production gate is activated here.

There are actual implementation blockers, distinct from pending approvals:

- Backend public catalog reads currently require development/test and a verified
  loopback database. Hosted storefront dynamic mode accepts only a loopback API.
  A reviewed production mode with an exact HTTPS API allowlist and trusted fixed
  tenant/store selection is required. Do not spoof NODE_ENV or tunnel Neon through
  localhost to evade development checks.
- The importer is development-only. A separately reviewed production dry-run/apply
  entry point must retain manifest validation, locking, exact ownership, resumable
  records, normal publication controls and an explicit approved target.
- Production needs an additive permission/scope/context backfill; the development
  initializer and blanket global RBAC seed are not production migration tools.
- `ops/deploy-backend.sh prepare` compares target schema/migrations with the live
  checkout and **rejects this catalog schema delta**. This is intentional protection.
  A reviewed migration-aware staging extension/tool is needed; do not remove the
  guard, change the live checkout or fabricate RELEASE_COMMIT to bypass it.
- A production media adapter/approved derivative bundle and rights decisions are
  required for initial photos. Current REFERENCE assets have no active public
  delivery. Cloudinary is not an assumed dependency.
- Finalize legacy filter-query translation/reference-price browsing behavior,
  breadcrumb wording and production SEO/noindex policy. Current dynamic filters
  use approved offer semantics and stable option codes, not static reference-price
  URL semantics.

## Exact proposed rollout order

Each numbered stage has a stop gate. None is approved or executed by this milestone.

1. **Inventory and freeze.** Obtain read-only access approval as needed; record exact
   production code/artifact SHAs, unapplied migration checksums, enabled services,
   Caddy health, binding, environment variable names and current Owner/context/grant
   identities privately. Verify Vercel Git auto-deploy behavior and current plan,
   quotas and commercial suitability. Establish a catalog edit freeze, including
   Owner operations, with an explicit approved enforcement/import exception policy.
   Do not disable authentication or rewrite credentials to enforce a freeze.
2. **Current recovery point.** Create/verify a freshly approved encrypted off-server
   PostgreSQL logical backup with compatible PostgreSQL 18 tooling, consistent
   snapshot, checksum, recorded timestamp/size, retained recovery key outside Oracle
   and a successful isolated full restore. Confirm destination capacity/eligibility
   first; no paid snapshot/storage is implied. Earlier recovery success is evidence
   of a procedure, not a current recovery point. Stop if recovery cannot be proven.
3. **Release/DDL rehearsal.** Reconcile production schema drift against all nine
   migrations, in order. Rehearse the exact delta and backfill against an isolated
   restored copy without changing Owner hashes or grants. Stage exact reviewed code
   in an isolated non-running Oracle ARM64 release using migration-aware tooling
   approved after the existing prepare guard is addressed. Build/lint/test without
   production dotenv or inherited secrets; record artifact hashes and rollback
   files. Keep HOST=127.0.0.1 and port 4000. No service restart yet.
4. **Approved additive DDL.** Only after recovery/DDL approval, run `prisma migrate
   status`, the exact reviewed `prisma migrate deploy`, then status and constraint/
   ownership verification with private existing environment injection. Never use
   reset, db push, a destructive down migration or migration-history edits. This
   plan includes the 7C ninth additive media-review migration. Measure locks/duration; stop on unexpected SQL,
   drift or auth-record changes. Old application compatibility must be rehearsed.
5. **Owner/RBAC bridge.** In one separately approved idempotent transaction, add only
   missing Permission/PermissionScope registrations; bind the explicitly selected
   existing tenant/store and existing Owner/legacy staff memberships to the reviewed
   LegacyStoreBridge. Insert missing approved assignments only. Do not reactivate
   revoked memberships or overwrite existing grants; conflicts require decisions.
   Preserve AdminUser IDs/hashes, AdminSession records and global roles. Never call
   seedSecurity, bootstrapOwner or the development foundation initializer. Verify a
   surviving scoped Owner, no inherited platform authority, custom-role boundaries
   and legacy authenticated reads. Do not create the bridge before its required
   active memberships exist; that would deny legacy access.
6. **Backend activation.** With separate restart approval, capture exact systemd
   drop-in state, previous WorkingDirectory/artifacts, PID/restarts, environment-file
   permissions and localhost binding. Activate the reviewed release through approved
   tooling; retain automatic readiness/binding fallback. Check API/Caddy, local and
   HTTPS `/api/health` and `/api/health/ready`, database readiness, existing admin
   login/logout and protected reads. Keep production catalog exposure/cutover gates
   closed. If integration fails, restore exact previous app/systemd state after
   compatibility checks; never rewind Neon as an application rollback.
7. **Approved catalog backfill.** Use the reviewed production importer, not the dev
   wrapper. Verify target and frozen reviewed-manifest hash before writes. Create
   approved schemas/categories/filter definitions, all 84 identities/default SKUs
   and store listing pins, retain 8+8 editorial memberships and all source provenance.
   Keep REFERENCE selling mode, zero approved selling prices and unknown stock.
   Journal/resume per record; stop on existing edits, route conflicts or checksum
   drift. Repeat must produce zero writes/duplicates. Reconcile any prior 7A imports
   with new approved revisions, never by overwriting immutable completed evidence.
8. **Rights and delivery.** Resolve the 95-image review queue or explicitly accept
   missing-image placeholders for affected products. Approve exact assets using
   scoped media workflows, retain evidence/credits, and deploy only permitted
   derivatives through the reviewed adapter. Remove/replace blocked old static
   copies under separate approval. Verify direct file paths, caches, image fallback,
   responsive dimensions and no unauthorized poster/variant media. Do not approve
   everything under one source/domain or assume an uploaded image is licensed.
9. **API shadow/read verification.** Under explicit read-exposure approval, enable
   the reviewed fixed-store production API gate while storefront reads remain static.
   Public means externally reachable: do not call this a private test. Verify approved
   published data only, all counts/routes/aliases, 58 reviewed corrections and 72
   accepted/omitted pending fields, source prices, same-SKU filters, no stock claims,
   pagination, facets, related items, and tenant/store/draft/media isolation. Disable
   only the new gate if it fails; preserve records/evidence and the working static app.
10. **Compatible admin/storefront code.** Only after schema/backend readiness, approve
    the push/merge or deployments that may trigger both Vercel production builds.
    New admin endpoints and catalogOrder payloads require the compatible backend.
    Keep the catalog write freeze and storefront static read setting through both
    READY deployments; verify old storefront and Owner access. Preview remains
    isolated/fail-closed and never receives production secrets. Do not merge early
    assuming auto-deploy can be stopped later. Required variable names/configuration
    must be checked without exposing values or changing credentials.
11. **Final read cutover.** Obtain separate approval for the server-only production
    catalog mode and exact HTTPS API origin/fixed store. Verify totals, 84 canonical
    products, 12 categories, 84 legacy redirects, 7+View All home rows, editorial order,
    SKU/spec/reference-price presentation, mobile/tablet/desktop, approved media,
    sitemap, canonical metadata and explicitly approved indexability. An outage must
    show unavailable, never stale static offers/stock. No checkout or payment enablement
    is included. Stop on a critical mismatch rather than broadening API permissions.
12. **Edit handoff and observation.** Record the published revision IDs and last
    accepted edit/audit high-water mark, then release the catalog write freeze only
    after approval. Verify controlled normal edits through existing roles and audit
    trails. During the approved observation window, manually check readiness, Caddy,
    HTTPS, logs and auth; agree thresholds for rollback. Backup/monitoring timers,
    alerts and automated deployment remain separate approvals and stay disabled.

## Smoke checks and rollback conditions

Approved operators can use these nonsecret health checks at the relevant stage:

```bash
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health/ready
curl --fail --silent --max-time 8 https://80-225-254-168.sslip.io/api/health/ready
systemctl is-active vogpk-api caddy
ss -lntH 'sport = :4000'
```

The listener must be exactly 127.0.0.1:4000. Check storefront/admin HTML, unauthorized
API rejection, hostile Origin/missing CSRF, private draft/media 404, role-limited
reads and real login/logout without printing credentials/cookies/tokens. Capture
private diagnostics without dumping systemd environments or database URLs.

Stop/roll back for failed readiness/binding, authentication/Owner lockout, cross-scope
data, source loss, unauthorized media, unexpected systemd changes, missing critical
routes or failed Vercel deployment. Retain failed artifacts and sanitized evidence.
The existing activation script's internal fallback restores the exact prior managed
drop-in and application path; verify that saved state/artifact compatibility exists
before using it. External HTTPS/admin failures need an approved manual rollback.

Before accepted database-backed edits, an approved read-gate reversal to the unchanged
static application is possible only after confirming no accepted changes are hidden.
Keep additive schema and import evidence. After the first accepted edit, static
rollback is unsafe: freeze affected writes, retain/export the delta and audit log,
then restore a compatible dynamic artifact or roll forward against the same database.
Do not drop catalog tables, erase import records, restore/rewind production Neon or
reset owners to undo an application release. A production restore needs separate
disaster-recovery approval and an explicitly reconciled data-loss window.

## Costs, approval requirements and decision

No paid resource is proposed as a prerequisite for the fixed 95-image dataset.
Existing hosting/storage/bandwidth usage is not guaranteed free: current plans,
tenancy quota, storage, egress, build and database budgets are unverified and must be
checked before activation. Static derivatives avoid a new image-service account;
new uploads may change capacity/backup requirements. Never upgrade plans, create
snapshots or purchase a service implicitly.

Operational approval is required for pushes/merges, production DDL/backfill, bridge/
membership changes, backend restart/rollback, Vercel settings/deployments, media rights
activation, public API/read cutover and any new schedule/resource/cost. This preflight
has performed none of them. **Production NO-GO until the implementation blockers,
remaining administrator decisions, current recovery proof and staged checks pass.**
