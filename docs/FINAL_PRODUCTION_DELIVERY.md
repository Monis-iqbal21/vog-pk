# VOGPK final production delivery preparation

Prepared locally on 2026-11-03, based on Milestone 7C `31bd50d`.
No production access, migrations, imports, restart, setting changes, push, merge,
media provider or paid resource activation is included. This is delivery tooling,
not a new architecture milestone. See `backend/docs/release-delivery/` for evidence.

## Release decisions

| Component | Status | Stop gate |
| --- | --- | --- |
| Existing commerce contracts and nine additive migrations | READY locally | Rehearse exact delta against a fresh restored production copy |
| Scoped default context, legacy Owner and active staff bridge | READY locally | Explicit context/member plan; never overwrite/revive revoked memberships |
| Resumable 84-product importer, checkpoints and zero-write rerun | READY locally | Reviewed plan, exact target, Owner session and approved write window |
| Independent production read/write switches | READY locally | All remain disabled; API exposure and frontend cutover are separate approvals |
| Generic-placeholder launch path | PENDING APPROVAL | Explicit business acceptance and verified sanitized frontend build |
| Authorized-photo launch path | BLOCKED for initial photographs | Individual rights approval AND reviewed production delivery adapter |
| Persistent staff uploads | BLOCKED / optional for initial launch | Durable provider, IAM/quota, backup and restore validation; uploads stay disabled |
| Source decisions and media rights | PENDING APPROVAL | 10 admin decisions, 62 optional unknowns; 95 private records, 7 unapproved license candidates |
| Legacy filter URLs, reference-price filtering and indexing policy | PENDING APPROVAL | Accept documented semantic differences or approve explicit mapping/filter revisions before cutover |
| Oracle non-running ARM64 staging tool | READY for review | Exact source/artifact verification and actual ARM64 execution still pending |
| Production baseline, recovery, hosting suitability and deployment | PENDING APPROVAL | Fresh read-only drift/quota checks, encrypted backup/full isolated restore and staged approvals |

Overall: **NO-GO for production activation now**. Local test success does not verify
the current Oracle/Neon/Vercel state or authorize deployment. No additional cloud
service is required for the generic-placeholder/reference-only initial release.
Current plan suitability, quotas and costs were not remotely rechecked.

## Concrete delivery gaps addressed

- The development initializer is still development-only. A separate operator
  foundation transaction registers missing permission scopes and creates only the
  explicitly planned tenant/store/memberships/default bridge. It does not seed
  authentication, change passwords/sessions/global role assignments, grant platform
  assignments, create stock or reactivate memberships. All active legacy staff must
  be explicitly listed to prevent bridge-induced lockout. Existing conflicting or
  inactive contexts fail closed; no silent reconciliation occurs.
- The importer retains its development guard. Its separate reviewed-release path
  checks the direct TLS Neon destination, actual database identity, fixed scope,
  operator identity, source manifest and explicit write window. Existing normal
  API approval/publication controls remain intact. Import records journal category
  and product progress and retain immutable provenance; interrupted operations resume.
- Production read configuration is available but defaults off. Backend selection is
  fixed by server-owned tenant AND store, never a request parameter. Frontend
  production mode requires an exact approved HTTPS origin, a separate opt-in and
  a production Vercel environment. Preview fails closed for this mode. Existing
  isolated development fixtures still work; static is the default.
- The existing backend prepare guard still refuses unreviewed schema changes. The
  dedicated catalog preparation command requires an exact reviewed schema-diff
  hash, builds only a non-running archive and records source/runtime hashes. It
  includes frontend source/evidence dependencies needed by the importer. Activation
  checks these receipts before switching; health probing now rejects any additional
  non-loopback listener on port 4000, rather than merely finding one good listener.

No new Prisma migration was added in this preparation. All nine existing migrations
are retained. DDL has no application down-migration: keep additive schema on rollback.
Legacy authentication compatibility is exercised in disposable upgrade/regression
tests; exact live schema drift and old production binary compatibility must still
be rehearsed on an isolated restored production copy before approval.

Parity retains the existing documented behavior differences: source facet labels
become stable option codes; approved-offer price filtering/sorting does not treat a
reference price as a sellable offer; optional unsupported units remain raw evidence;
breadcrumbs use the full product name. Existing product/category canonical paths and
legacy redirects are preserved. Review old bookmarked filter-query expectations
before cutover rather than claiming identical semantics or weakening offer validation.
The general noindex posture stays in place pending an explicit indexing decision.

## Media and administrator decisions

The 95 original media records/evidence remain private and unapproved. Public dynamic
projections omit them; galleries, SKU media and DETAIL_POSTER relationships remain
separate and immutable at approved revisions. Missing photos use the authored VOGPK
placeholder; absent posters do not break product detail pages. No technical variant,
price, discount, stock or manufacturer part number is invented.

Authorized staff can open Products → **Review imported catalog decisions**. The
tenant-scoped read endpoint returns the ten retained source decisions only for
products imported into that tenant. This is historical review evidence, not an
automatic task-resolution ledger: compare the latest revision before correcting
facts through the normal draft/review/publish flow. Media rights and affected-listing
review remain in Media; no seven-candidate blanket approval is provided.

For the optional generic launch path, the future frontend `npm run build` helper
does nothing in static/development mode. Only an explicitly approved production
Vercel build with `CATALOG_MEDIA_PRESENTATION=generic-approved` may withhold the
95 exact digest-checked product files from that disposable build workspace. It
retains unrelated files and fails on changed paths/digests; it does not delete local
source assets or database media evidence in this task. Test coverage uses its own
temporary fixtures. Confirm the project's real Vercel Build Command uses `npm run
build`; a dashboard override that calls `next build` directly would skip this step
and is a cutover blocker. No dashboard setting was changed here.

Old static/immutable deployment URLs or CDN copies may remain reachable. Separately
approve retirement/cache handling for those artifacts; a new sanitized build does
not retroactively revoke old deployments. Launch with selected photographs instead
requires per-asset authorization and a reviewed delivery adapter/allowlist with
credits and applicable license conditions. An accessible source URL is never approval.

Persistent uploads are not required while staff accept placeholders and do not
upload new images. Current local-development storage intentionally rejects production
delivery. Before uploads begin, approve durable private object storage, scoped IAM,
responsive delivery, retention and recovery testing. Neither Oracle disk alone nor
Vercel temporary files suffice. No Cloudinary subscription is assumed.

## Operator plan and safeguards

Use a private copy of `backend/scripts/catalog-release-plan.example.json` under
the prepared release's `backend/.local/`. It is intentionally non-executable until
all placeholders are replaced. Review:

- exact release SHA and direct existing Neon host/database/port (no pooler),
  existing Owner UUID, chosen tenant/store UUIDs and every active legacy staff UUID;
- actual baseline migration names and inspected schema fingerprint, compared with
  the expected baseline/restored rehearsal, not accepted merely because inspection
  produced a hash;
- frozen manifest `264136158ad771573cd526bfa0b2ad8f26eff5306257da2e7886ba3fa1047c04`;
- encrypted backup checksum and full isolated restore verification within 24 hours,
  with the private recovery key safely retained outside Oracle;
- explicit presentation decision. `PENDING` never signifies approval to cut over.

The recovery fields are operator attestations, not a substitute for inspecting
the backup object and successful restore evidence. The CLI never creates a backup
or cloud resource. A future production plan must have current evidence before use.

Commands accept only `inspect`, `migrate`, `foundation`, `import`, `verify`.
Without `--apply` they do not invoke mutating operations. Apply requires
`--confirm=<canonical plan hash>` returned by inspect. Journals must live in a
private `.local` directory, reject symlinks and use mode 600 on Linux. Public output
contains only status, hashes, migration names and aggregate counts, never credentials.
Database migration history must be a successful checksum-matching prefix of the
nine source migrations. Pending/failed/drifted history stops later commands.

`migrate` requires the approved pre-DDL schema fingerprint and exact baseline
history. If a migration partially succeeds or a retry no longer matches that
baseline, stop, inspect Prisma status, and review a new plan; never fake migration
history, reset, db push or silently accept a new fingerprint. `verify` is a read-only
catalog validation command; it does not publish or repair data. The initial strict
verifier intentionally rejects any accepted post-import edits, added prices/stock
or granted source media: use it before write handoff, never to overwrite later edits.

## Exact future rollout sequence — not executed

Each stage needs its own approval. A local-only commit must be published by approval
before Oracle can fetch it; do not assume it exists on GitHub. Git auto-deploy behavior
must be checked before any merge. Keep compatible frontend/admin on static mode
until database/backend readiness. No timers or automatic deployment are enabled.

1. **Inventory/freeze/recovery.** Privately record deployed SHAs, applied migration
   hashes, active sessions/Owner context, systemd override state/artifacts, binding
   and health. Inspect schema drift and current commercial hosting limits. Freeze
   catalog edits. Create/verify an approved fresh encrypted off-server backup and
   full isolated restore. Approve the exact baseline, plan and schema diff after
   restored-copy rehearsal. Do not copy production credentials into test fixtures.
2. **Non-running ARM64 preparation.** On Oracle, after approved fetch, from the
   existing repo, set nonsecret `SHA`, `BASELINE` and `DIFF_SHA256` to reviewed full
   hashes. Compute/review the diff checksum with the same command as the script:

   ```bash
   git diff --no-ext-diff --binary "$BASELINE" "$SHA" -- backend/prisma | sha256sum
   mkdir -p /home/ubuntu/vog-pk/.local/operator-tools
   PREP="/home/ubuntu/vog-pk/.local/operator-tools/prepare-catalog-release-$SHA.sh"
   OPS="/home/ubuntu/vog-pk/.local/operator-tools/deploy-backend-$SHA.sh"
   # Refuse overwriting existing tools; inspect an existing copy instead.
   test ! -e "$PREP" && git show "$SHA:ops/prepare-catalog-release.sh" > "$PREP"
   test ! -e "$OPS" && git show "$SHA:ops/deploy-backend.sh" > "$OPS"
   chmod 500 "$PREP" "$OPS"
   bash "$PREP" "$SHA" "$BASELINE" "$DIFF_SHA256" --approved-prepare
   cd "/home/ubuntu/vog-pk/.local/releases/$SHA/backend"
   sha256sum --check --status RELEASE_ARTIFACTS.sha256
   ```

   This consumes existing disk/build CPU (minimum free-space guard: 2 GiB), installs
   locked dependencies and runs backend build/lint/tests. It neither starts the
   release nor changes the live checkout/systemd/database. Actual ARM64 execution is
   pending. Build logs are private. The environment link is created after builds;
   production dotenv is never loaded by build commands. Same-UID trusted builds are
   not a hostile-code sandbox. Preserve old artifacts/drop-ins; do not reuse the
   old `8c75ca5` artifact for this schema-changing code.
   The commit-specific tools above are materialized from Git objects into ignored
   operator storage; do not pull/reset or otherwise alter the live checkout to get them.
3. **Schema inspection/dry-run.** Set `PLAN=.local/reviewed-plan.json` and
   `JOURNAL=.local/release-journal.jsonl` in that prepared backend. Inject the
   existing environment with Node's env-file parser, never shell-evaluate dotenv:

   ```bash
   NODE_ENV=production node --env-file=/home/ubuntu/vog-pk/backend/.env.local scripts/catalog-release.mjs inspect --plan="$PLAN" --journal="$JOURNAL"
   NODE_ENV=production node --env-file=/home/ubuntu/vog-pk/backend/.env.local scripts/catalog-release.mjs migrate --plan="$PLAN" --journal="$JOURNAL"
   ```

   Review the schema hash/history against the restored baseline and finalize the
   plan; record the resulting nonsecret `PLAN_HASH`. Keep both catalog gates off in
   actual running configuration and operator environment. Do not trust only the CLI
   environment to prove the live service's gates; verify loaded configuration privately.
   If the existing runtime URL is pooled, stop and privately provision the approved
   direct connection in the operator process environment. Do not edit production
   `.env.local`, invent a direct hostname, expose its URL or change credentials.
4. **Separately approved DDL/foundation.** Repeat the migrate command with
   `--apply --confirm="$PLAN_HASH"`; then run foundation dry-run and approved apply:

   ```bash
   NODE_ENV=production node --env-file=/home/ubuntu/vog-pk/backend/.env.local scripts/catalog-release.mjs foundation --plan="$PLAN" --journal="$JOURNAL"
   NODE_ENV=production node --env-file=/home/ubuntu/vog-pk/backend/.env.local scripts/catalog-release.mjs foundation --plan="$PLAN" --journal="$JOURNAL" --apply --confirm="$PLAN_HASH"
   ```

   Stop on failed history, checksum, schema drift, inactive membership or Owner
   mismatch. No blanket role seed or Owner bootstrap. Verify schema, grants and
   existing login/session compatibility before moving on.
5. **Backend activation, gates off.** With separate restart approval and exact
   prior-artifact/drop-in checks, use the pinned `bash "$OPS" activate
   "$SHA" --approved-restart`. Preserve HOST=127.0.0.1 and port 4000. Verify health,
   readiness, Owner login/logout, surviving sessions and scoped access. The script
   internally falls back to the previous application/configuration on readiness or
   binding failure; it never rewinds Neon. Expected interruption is one API restart
   plus warm-up; no measured production downtime guarantee is available.
6. **Approved import window.** Privately provision an existing authorized short-lived
   Owner Bearer session into `CATALOG_OPERATOR_SESSION`; never paste/log it or write
   it to the plan/journal. `BFF_SHARED_SECRET` comes from the existing private env.
   Set `CATALOG_OPERATOR_API_ORIGIN=http://127.0.0.1:4000`. Separately approve the
   actual backend and operator `CATALOG_ADMIN_WRITES_ENABLED=1` window while staff
   remain frozen. This is a broad catalog unlock, not an import-only grant.

   Run `catalog-release.mjs import --plan="$PLAN" --journal="$JOURNAL"` using the
   same Node/env-file prefix, review the dry-run, then append
   `--apply --confirm="$PLAN_HASH"`. Run approved import again: completedWrites must
   be zero. Run `verify --plan="$PLAN" --journal="$JOURNAL"`: require 84 products,
   12 categories, 84 default SKUs, 95 private refs, 8+8 collection memberships,
   source/category/SKU/URL agreement, zero approved prices and no invented inventory.
   Revoke the operator session normally and clear it from memory. Close the write
   window until separately approved handoff. Retain checkpoints on any failure.
7. **Compatible Vercel deployment/static staging.** Approve publishing/merging only
   after prior gates; inspect Git auto-deploy and Build Commands first. Require both
   production deployments READY, existing static homepage and Owner access. Storefront
   `CATALOG_MODE=static`; backend public catalog read gate stays off. Preview must
   keep isolated/fail-closed auth and never receive production API secrets.
8. **Read shadow and final cutover.** Approve API exposure separately: server-only
   `PUBLIC_CATALOG_MODE=production`, `PUBLIC_CATALOG_READS_ENABLED=1`, exact
   `PUBLIC_CATALOG_TENANT_ID` and `PUBLIC_CATALOG_STORE_ID`. Run approved public API
   parity checks while the storefront remains static. Public exposure is not a
   private test. Then separately approve storefront build configuration:
   `CATALOG_MODE=dynamic-production`, `CATALOG_PRODUCTION_READS_ENABLED=1`, exact
   `CATALOG_API_ORIGIN` and matching `CATALOG_APPROVED_API_ORIGIN` (existing HTTPS
   API origin). For the generic path also set `CATALOG_MEDIA_PRESENTATION=generic-approved`
   only after business acceptance. Build via `npm run build`, verify all 95 withheld
   paths return 404 on the new deployment and fallback rendering works. Keep dynamic
   pages noindex initially; any indexing policy change is a separate launch decision.
   Rebuild/deploy when changing frontend mode; do not assume an environment edit
   changes already generated static output. Retire old image artifacts as approved.
9. **Write handoff.** After final parity/auth/role/media checks, record published
   revision IDs and audit high-water mark. Enable normal catalog writes only with
   separate approval. No checkout/payment, paid resource, timer or automatic rollout
   is implicitly enabled by catalog cutover.

## Health, failures and rollback

```bash
systemctl is-active vogpk-api caddy
systemctl show vogpk-api -p NeedDaemonReload -p MainPID -p NRestarts -p WorkingDirectory
ss -lntH 'sport = :4000'
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health/ready
curl --fail --silent --max-time 8 https://80-225-254-168.sslip.io/api/health/ready
```

Require only 127.0.0.1:4000, active API/Caddy and local/public HTTP 200. Test storefront,
admin, existing login/logout/session persistence, forged scope denial, anonymous
privileged requests, CSRF/hostile Origin, draft isolation, reference-only prices,
unknown stock, categories, URLs, default/explicit variants, same-SKU filters/facets,
7+View All homepage rows, poster absence and media withholding. Capture no tokens,
cookies, passwords or environment values.

On authentication/ownership/media leak, drift, missing critical routes, readiness or
binding failure: stop immediately. Do not retry through weakened guards or reseeding.
For an approved application rollback, verify the saved prior artifacts/override and
schema compatibility, then `bash "$OPS" rollback --approved-restart` with the same
reviewed commit-specific operator tool used for activation.
Restore exact previous systemd state; health/binding/auth must pass afterward. External
HTTPS/admin failures require that separately approved manual rollback. Interrupted
migrations require inspection and a reviewed forward plan, never a destructive down.

Before accepted dynamic edits, a separately approved frontend read reversal to the
unchanged static deployment may be safe after checking no accepted data is hidden.
After accepted edits, **do not roll back to static data**: freeze writes, preserve
revisions/audit/import evidence and reconcile deltas; prefer a forward fix or compatible
dynamic release. Never restore/rewind production Neon as an application rollback.
Keep backups/monitoring/automation disabled until separately approved.

## Final local validation

- Backend build/lint and 40 unit tests passed.
- Full commerce/browser regression: 61 checks passed, including categories, typed
  variants, pricing/inventory, media rights/rejection/posters, tenant boundaries,
  real built admin/BFF and dynamic storefront. Browser upload tests wait for enabled
  controls before file selection; no application validation was weakened.
- Authentication: 25 checks; foundation/Owner/scoped RBAC: 23 checks passed.
- Release rehearsal: 20 groups passed, including actual CLI dry-runs, confirmed
  fixture-only foundation/import, unchanged existing sessions, zero-write repeated
  import, ten scoped source decisions and separate production-mode read cutover.
- Admin routing 19; BFF route assertions 379; Preview configuration 10 and secret-free
  Preview HTTP/build 38 passed. Frontend release flags 11 and mocked operator target/
  migration guards 14 passed; mock checks are not production connectivity evidence.
- Generic build fixture withheld exactly 95 known files while preserving unrelated
  files. Static frontend production build stayed unchanged. Shell syntax and four
  listener cases passed without SSH, systemd or any live service execution.
- All three runtime dependency audits reported zero known vulnerabilities. No
  dependency upgrade or new migration was needed. Final secret-scan evidence is
  recorded beside the release matrix; no local operational artifacts are committed.

Run `npm run test:release-delivery` in backend, `node scripts/test-release-guards.mjs`
in backend, `node scripts/test-catalog-release.mjs` and
`node scripts/test-catalog-media-build.mjs` in frontend, and
`node ops/tests/catalog-release.test.mjs` from repository root to repeat the new
delivery checks. Each integration runner owns a fresh random loopback test directory
and preserves historical ignored fixtures. Existing Node package-type and pg query
deprecation warnings are non-fatal and were not addressed through unrelated upgrades.
