# Catalog rollout Stage 3 — final migration and deployment preflight

Prepared November 4, 2026. **Technical preflight PASS; production execution NO-GO
until the approvals and remaining gates below are satisfied.** No production DDL,
foundation/import, service activation/restart, merge, push or Vercel setting change
was performed. All mutating rehearsal operations used an isolated fresh restored
copy, not Neon. No media rights were approved or paid resources created.

Evidence: [Stage 3 results](catalog-stage3-preflight-verification.json),
[fresh recovery procedure](CATALOG_RECOVERY_POINT_20261104.md),
[fresh recovery verification](catalog-recovery-20261104-verification.json).
These supplement the historical milestones; completed staging/recovery checks are
no longer pending merely because an older report says they are.

## Release identities and current state

- At the recorded preflight, Draft PR #2 targeted main with HEAD
  `7223c7817f7c7b93b040c4e5c8201af36ae21e83`; its reported checks pass.
- Reviewed and staged backend tree:
  `2b9e56ee1eae38de6fca204c584ffd508dae945f`. Local HEAD, remote PR backend and
  staged receipt agree. Source and compiled artifact receipts passed again.
- At preflight, ops-only lint correction `fc1d62ceec248dd12864028b219d51ce8f87389d`
  was local and unpushed. Its actual lint block passed the hidden-directory regression,
  including deliberate app/test failures, generated exclusion and empty-input
  rejection. No application source changes or new migration are needed.
- Live API remains `8c75ca5`, PID 33120, restart count 0, loopback-only port 4000.
  Caddy remains PID 6864, restart count 0. Both active; NeedDaemonReload=no;
  local health/readiness and public HTTPS readiness return 200. Saved configuration,
  environment, live checkout and rollback artifacts remain unchanged.
- Both Vercel production deployments are READY on main `39f603a7f1a71cb708f585119d61dad409100cd2`.
  Storefront has no configured project env vars, so catalog mode defaults static.
  Admin retains its six existing Production-only vars. Preview auth still fails
  closed; routing/config and Preview security regressions passed.
- No production Owner password login was attempted. Copied authentication data and
  a clone-only session were exercised in the isolated database without reading a
  production password or using a live token.

## Migration compatibility matrix

Production read-only inspection confirms only `202610290001_admin_security` is
applied, with nine public tables and checksum-matching successful history. Columns,
types, nullability/defaults, constraint/index validity and absence of unexpected
public functions/triggers passed. Record the schema fingerprint in the evidence in
the private operator plan and compare again immediately before DDL.

| Pending migration | Individual review and compatibility | Result |
| --- | --- | --- |
| `202611010001_commerce_foundation` | 11 new scoped-access/context tables and enum. Existing AuditLog gets three nullable scope columns, index, CHECK and foreign keys. Existing rows remain valid with NULL scope. New FKs reference existing users/permissions; validation and locks still matter. No credential/session/legacy-role rewrite. | PASS on restored production copy |
| `202611010002_product_types` | Eight new definition/schema/vocabulary tables, enums, scoped FKs, partial uniqueness, typed CHECKs and immutable/version-pointer triggers. Requires foundation first. | PASS |
| `202611010003_categories_filters` | Eight new hierarchy/route/filter tables; Store currency defaults PKR. Retained routing identities, cycle/depth checks and deferred pointers. Store is new in this upgrade path. | PASS |
| `202611010004_catalog_products` | 18 new product/SKU/listing/media tables. Adds LISTING enum value, allowNoSku and listingId. Replaces catalog_route_owner CHECK and replaces one just-created listing-media trigger with the correct listing guard. These DROP operations affect new commerce objects, not existing authentication data. Enum-dependent route checks use text; ordered migration succeeded on PostgreSQL 18.6. | PASS |
| `202611010005_pricing_inventory_media` | Nine new operational tables; Store timezone and MediaAsset metadata/defaults, stock/price/media CHECKs and append-only/deferred guards. No offers, stock or media authorization seeded. | PASS |
| `202611020006_storefront_read_indexes` | Adds route publication flag and two read indexes. Explicit UPDATE backfills publication provenance on commerce routes; zero preexisting commerce routes in this production baseline. Not a completely DML-free migration, and does not enable public reads. | PASS |
| `202611020007_catalog_import_evidence` | One import journal table with FKs/immutable evidence; Store locale en-PK and nullable listing catalogOrder with bounds. No catalog records imported by migration. | PASS |
| `202611020008_media_review` | One media-review table, enum, reviewer/tenant FKs, indexes and append-only trigger. Depends on MediaAsset and retain_operational_evidence from earlier migrations. No rights auto-approved. | PASS |

The net change is 56 new tables plus additive alterations. No table/column drop,
TRUNCATE, authentication reseed, Owner update or destructive catalog reset was
found. Calling this a net additive upgrade does not mean every SQL statement is
CREATE-only, lock-free or automatically reversible.

The fresh restored-copy run applied all eight through the real Prisma deploy
command, verified migration ordering/checksums and byte-equivalent original auth,
session, role, permission, audit and throttle rows immediately after DDL. Recorded
per-migration durations are in the evidence; these are tiny isolated-database
observations, not production timing guarantees.

AuditLog ALTER/validation and its normal index build can briefly block audit writes;
FK installation also locks referenced authentication tables. New table/index builds
consume database CPU, WAL and storage. Use an approved quiet window and monitor
authentication/readiness. The existing CLI caps the migrate subprocess at 120s;
that is not proof of a server-side per-statement lock timeout. Review effective
connection/statement timeouts before execution. Stop on locks, failed history or
drift; inspect and approve a forward recovery plan. Do not reset, db push, fabricate
migration history or assume an interrupted multi-migration run is all-or-nothing.

## Restored-copy rehearsal and rollback evidence

A new PostgreSQL 18.6 cluster restored the verified encrypted snapshot; the private
age identity stayed on Windows. The production destination guard passed before
restore. Data/WAL/archive stayed in owned private tmpfs, swap was off, and the
cluster listened only on loopback with peer socket and restricted local password
access for application tests. It had no public listener.

All 42 restore checks passed again, then all 17 release checks passed:

- Full migration chain and original authentication data preserved.
- Existing active Owner and every active legacy staff member explicitly included;
  one tenant/store bridge, no platform grants, no credential reset. Foundation
  dry-run and repeated apply preserve existing identities and sessions.
- Current `8c75ca5` binary starts on the expanded schema and serves protected legacy
  identity/role/permission/staff/audit endpoints. Anonymous denial passes. It also
  works after foundation/import, supporting an initial application rollback.
- New production-mode API preserves the copied Owner session with both gates off.
  Real importer produces 84 products, 12 categories, 84 default SKUs, 95 private
  media refs and 8+8 collection memberships; URLs, category/SKU identities and
  reference prices pass strict verification. No approved offers or stock invented.
- Repeat import completes with zero catalog writes. Actual operator CLI dry-runs,
  confirmations, wrong-target/revocation rejection and scoped review queue pass.
- Separate API instances enforce their own write/read gates; isolated production
  read testing exposes only the fixed store and rejects foreign scope selection.

The actual deployment shell also passed four **shimmed fixture** cases: exact
prior override restoration, restoration of no prior override, health-failure fallback
and unsafe-binding fallback. It did not invoke real sudo/systemctl or restart
production. Prior binary compatibility was tested with real isolated processes;
production activation/rollback itself remains unexecuted.

The temporary APIs and database are stopped; plaintext and the tmpfs cluster/WAL/
socket were removed. Offline page checksums passed. An initial private harness
Buffer-hashing assertion was corrected; a fresh second restored copy passed. This
was not an application or migration change.

## Exact controlled order and commands — future approval required

These commands are preparation, not current authorization. Use the existing ubuntu
operator and pinned SSH, a private reviewed plan and mode-600 journal; never print
tokens, URLs, environment values or raw private logs. The operator DATABASE_URL
must be the approved direct TLS Neon target, privately provisioned in memory and
checked against the plan. If runtime env is pooled, do not blindly use it for the CLI.
Do not modify the live dotenv or authentication credentials.

```bash
SHA=7223c7817f7c7b93b040c4e5c8201af36ae21e83
ROOT=/home/ubuntu/vog-pk
RELEASE="$ROOT/.local/releases/$SHA/backend"
OPS="$ROOT/.local/operator-tools/deploy-backend-$SHA.sh"
cd "$RELEASE"
PLAN=.local/reviewed-plan.json
JOURNAL=.local/release-journal.jsonl
# PLAN_HASH is the exact canonical reviewed plan hash returned by inspect.
```

1. **Publish/review prerequisites, not merge.** Obtain approval to publish the local
   lint correction and reviewed documentation to the Draft PR; rerun its checks.
   Any new PR/merge SHA must retain the exact backend tree and migration hashes.
   Prepared application SHA remains pinned above; do not silently relabel artifacts.
   Reconfirm actual Vercel production branch/auto-deploy and effective Build Commands.
   The connector omits those settings, so they were not freshly proven here. Treat
   a merge as a production deployment event, never an inert repository operation.
2. **Fresh recovery, plan and freeze.** Verify archive/key custody and full restore
   evidence again, including actual capture age, not just a renewed attestation.
   Snapshot captured Nov 4 at 21:20:03 PKT; prefer DDL within 24h or capture/verify a
   fresh point. Freeze/reconcile edits, explicitly list all active legacy members,
   approve fixed tenant/store/Owner IDs, current schema fingerprint and migration
   baseline. Review database connection/timeout headroom and prior artifacts/unit.
3. **Separately approved DDL with catalog gates off.** Run inspect and migrate dry-run:

   ```bash
   NODE_ENV=production CATALOG_ADMIN_WRITES_ENABLED=0 PUBLIC_CATALOG_READS_ENABLED=0 \
     node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs inspect --plan="$PLAN" --journal="$JOURNAL"
   NODE_ENV=production CATALOG_ADMIN_WRITES_ENABLED=0 PUBLIC_CATALOG_READS_ENABLED=0 \
     node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs migrate --plan="$PLAN" --journal="$JOURNAL"
   # Only with DDL approval and the exact unchanged reviewed plan:
   NODE_ENV=production CATALOG_ADMIN_WRITES_ENABLED=0 PUBLIC_CATALOG_READS_ENABLED=0 \
     node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs migrate --plan="$PLAN" --journal="$JOURNAL" --apply --confirm="$PLAN_HASH"
   ```

   Stop on drift/failed or partially applied history. The old API remains running;
   check local/public health and existing authentication before proceeding.
4. **Separately approved foundation.** Run foundation dry-run, then confirmed apply
   with the same env-file, private direct operator target, plan and journal:

   ```bash
   NODE_ENV=production node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs foundation --plan="$PLAN" --journal="$JOURNAL"
   NODE_ENV=production node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs foundation --plan="$PLAN" --journal="$JOURNAL" --apply --confirm="$PLAN_HASH"
   ```

   Require unchanged authentication/session identities and legacy role edges,
   explicit active memberships and no platform assignments. Never blanket-reseed.
5. **Separately approved Oracle activation with both gates off.** Verify receipts,
   exact operator script, prior override/artifacts and env flags, then:

   ```bash
   bash "$OPS" activate "$SHA" --approved-restart
   ```

   Require health/readiness/HTTPS/binding plus Owner/session/scoped access checks.
   Keep existing Vercel apps on static behavior while validating new backend.
6. **Separately approved catalog import through a private operator API.** Current
   importer requires a production write-enabled API; keeping every API gate off
   through import is impossible. Recommended: leave main port 4000 write-disabled,
   run the same reviewed release temporarily on **127.0.0.1:4011** with its own
   write gate enabled, and stop it after import. Caddy currently proxies 4000 and
   contains no 4011 upstream; 4011 was unused. Recheck both before launch.

   Acquire the deployment lock for this window (not across step 5), keep staff frozen,
   provision a normal authorized short-lived Owner session privately in memory, and
   direct the CLI to this listener. Never put the session in command arguments or
   write it to the plan/journal. Example launch, after explicit approval:

   ```bash
   umask 077
   exec 9>"$ROOT/.local/deploy-state/deploy.lock"
   flock -n 9 || exit 1
   test -z "$(ss -lntH 'sport = :4011')" || exit 1
   NODE_ENV=production HOST=127.0.0.1 PORT=4011 \
     CATALOG_ADMIN_WRITES_ENABLED=1 PUBLIC_CATALOG_READS_ENABLED=0 \
     node --env-file="$ROOT/backend/.env.local" dist/main.js >.local/import-api.log 2>&1 &
   IMPORT_PID=$!
   # Keep ownership of this foreground shell/child; stop this child on any failure.
   trap 'kill -TERM "$IMPORT_PID" 2>/dev/null || true; wait "$IMPORT_PID" 2>/dev/null || true' EXIT
   # Verify actual PID, loopback-only :4011 binding, readiness and main :4000 gate.
   export CATALOG_OPERATOR_API_ORIGIN=http://127.0.0.1:4011
   NODE_ENV=production CATALOG_ADMIN_WRITES_ENABLED=1 \
     node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs import --plan="$PLAN" --journal="$JOURNAL"
   # Review dry-run before the approved apply:
   NODE_ENV=production CATALOG_ADMIN_WRITES_ENABLED=1 \
     node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs import --plan="$PLAN" --journal="$JOURNAL" --apply --confirm="$PLAN_HASH"
   # Repeat that approved apply; require completedWrites=0. Then:
   NODE_ENV=production node --env-file="$ROOT/backend/.env.local" scripts/catalog-release.mjs verify --plan="$PLAN" --journal="$JOURNAL"
   # Revoke the short-lived session normally; stop only the owned import child.
   # Confirm :4011 is absent, clear token from memory and release the deployment lock.
   ```

   This sequence has NOT run in production. Independent API gate behavior and real
   import on a loopback-only write-enabled process passed on the restored copy.
   Review the exact launcher/cleanup and connection limits at approval time; allow
   one additional API process and its pool (max 10) plus CLI/lock connections. No
   public route, firewall change, durable daemon or new cloud resource is needed.
   Do not substitute a broad main-API write unlock without separate approval.
7. **Separately approved merge and Vercel production deployment, static mode.** Only
   after DDL/foundation/backend/import verification, finalize PR checks and approve
   ready/merge. The new admin requests contexts/schema, contexts/catalog and
   contexts/products; legacy 404 tolerance preserves login but does not provide
   working commerce administration on the old backend. Backend-first prevents that
   incomplete state. New backend supports the currently deployed legacy BFF paths.
   Monitor both production deployments to READY; verify static catalog, authentication,
   contexts and protected reads. Keep public catalog gate and main admin write gate off.
8. **Admin write handoff, separately approved.** Only after backend/import and new
   admin verification, record revision/audit checkpoints, approve and enable main
   API writes through the reviewed runtime configuration/restart process. Do not
   hand off yet if accepting edits would make the planned static read fallback stale.
   Recommended: defer normal staff edits until dynamic reads are also accepted;
   otherwise freeze/reconcile every accepted database edit before read cutover.
9. **Media and dynamic reads, separately approved.** Resolve generic-placeholder
   business acceptance or asset-specific rights/delivery approval; the 95 references
   and seven candidates stay unapproved. Retain the 10 source decisions. Confirm
   effective frontend build uses `npm run build` for the media-withholding hook.
   First approve fixed-scope backend API exposure, verify it while storefront stays
   static, then approve server-only frontend dynamic flags and production rebuild.
   Require 84/12 parity, 7+View All rows, correct variants/filters, reference-only
   prices, unknown inventory, no posters handled safely and no unauthorized images.

## Failure handling and rollback

Before any activation, record the currently loaded unit/drop-ins, hashes, previous
working directory and artifact receipts privately. The activation script saves the
exact previous managed override (or its absence). It performs no DDL or credential
operation. It automatically restores that state and restarts the previous app if
new local readiness or loopback binding fails (15 attempts, curl timeout up to 8s,
2s delay). One restart/warm-up is expected; a fallback needs a second restart.
Neither an exact interruption duration nor production RTO is claimed.

For external HTTPS, BFF/authentication or other critical failures, stop the operator
import listener first if running. With separately approved restart/rollback and
unchanged verified prior artifacts/configuration:

```bash
bash "$OPS" rollback --approved-restart
systemctl is-active vogpk-api caddy
systemctl show vogpk-api -p MainPID -p NRestarts -p NeedDaemonReload -p WorkingDirectory
ss -lntH 'sport = :4000'
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health
curl --fail --silent --max-time 8 http://127.0.0.1:4000/api/health/ready
curl --fail --silent --max-time 8 https://80-225-254-168.sslip.io/api/health/ready
```

Require only 127.0.0.1:4000, saved previous working directory/configuration, active
services and HTTP 200, then Owner/session/protected-route checks. No API rollback
changes Caddy or rewinds Neon. Keep all additive tables, imported revisions and
evidence. Failed DDL needs a reviewed forward fix, not a down migration. A backup
restore would lose subsequent records and requires separate disaster-recovery
approval; it is not routine rollback.

If Vercel fails, stop and obtain approval to return production aliases to the
recorded previous deployments. No automatic Vercel rollback is authorized here.
Do not revert public reads to stale static content after accepted dynamic edits.
Likewise, the old API is not a safe indefinite rollback after new scoped security
revocations/assignments that its legacy authorization cannot represent. Freeze
writes, retain revisions/audit high-water marks and prefer a compatible forward fix.

## Remaining gates and recommendation

| Gate | Status |
| --- | --- |
| Eight migrations + current baseline review | READY; refresh fingerprint before DDL |
| Fresh encrypted Windows recovery point + full restore | READY for recorded timestamp; offline second copy pending device |
| Oracle release/source/artifacts and previous binary compatibility | READY |
| Lint fix and sanitized documents | READY locally; publish/re-review PENDING APPROVAL |
| Actual production migration plan, direct target, lock window/timeouts and memberships | PENDING APPROVAL/recheck |
| Private operator API import/write window, bounded process and cleanup | PENDING APPROVAL; not launched in production |
| Backend restart, merge/automatic Vercel rollout and staff write handoff | PENDING APPROVAL |
| Fresh effective Vercel Git auto-deploy/Build Command confirmation | PENDING; connector omits settings |
| Media/presentation/filter semantics/indexing decisions and public dynamic cutover | BLOCKED pending explicit decisions; no approvals invented |

Proceed only by separately approved stages in the order above. This preflight does
not authorize production changes. At preflight, documentation was local and
uncommitted, local HEAD was fc1d62c and remote reviewed PR SHA was 7223c78. The JSON
evidence preserves those timestamped facts, including publication flags; it is not
a live PR status feed. Separately approved publication creates a new PR HEAD but
need not change the reviewed backend tree or require
rebuilding identical application artifacts. Re-verify that equality before using them.
