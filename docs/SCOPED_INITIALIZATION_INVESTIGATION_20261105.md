# Scoped initialization failure investigation — 5 November 2026

**Decision: production NO-GO until the patch is reviewed, published and staged, and a newly approved foundation-only execution plan is verified.** No production retry, cleanup, migration, import, API activation or configuration change was performed in this investigation. Investigation baseline: `a78d54f634ad1b221fdd4182e73f91302d28636c`. Publication and a separate non-running stage were subsequently authorized; their final commit/artifact identity must be checked in the publication receipt before a separately approved retry.

## Findings and limits of the historical evidence

The original production exception code/message was irretrievably discarded by the private `run-reviewed-plan.mjs` wrapper: it captured the child CLI's stderr, threw a generic error on a nonzero exit and then replaced that error with `OPERATOR_PLAN_STOP`. The CLI journal recorded phase/status but omitted the exception code. Retained stderr contains no inner Prisma code; the separately invoked CLI produced no corresponding API journal entries. This report does **not** claim that the original exception was definitely P2028 or P2003.

The failure mechanism is demonstrated on the restored post-migration snapshot, using the same Prisma client/adapter 7.10.1 and PostgreSQL 18.6:

1. The original initializer makes approximately 540 driver calls through sequential empty-update `permission.upsert`, `permissionScope.upsert` and membership upserts. These are emulated SELECT / conditional INSERT / SELECT plans, rather than single native upserts.
2. Ten read-only production ping measurements were 63–64 ms each. With 63 ms injected driver-response latency, the original initializer exceeded its unchanged 30,000 ms interactive-transaction lifetime. An in-progress `permissionScope.upsert` continued around rollback and failed with Prisma **P2003**, PostgreSQL **23503**, `PermissionScope_permissionId_fkey`.
3. A controlled delayed lookup for a missing `media.approve` reproduced the exact production partial state: ROLLBACK occurred, the pending lookup returned, and the emulated plan issued INSERT Permission **after** rollback. The next `permissionScope.upsert` failed with **P2028**. The isolated database retained 28 permissions, including only the new ungranted `media.approve`, zero scope registrations and zero tenant/store/bridge/memberships. This test began with 27 permissions; the delete needed to construct that fixture occurred only in an isolated clone.

The failing application operation in both reproductions is the original `permissionScope.upsert` at `catalog-release-core.mjs:151`. The late permission insertion originates in the immediately preceding emulated `permission.upsert`. Runtime source review confirms that transaction expiry sends ROLLBACK and releases the adapter connection while an in-progress query plan can still resume. The partial permission is a consequence of that race, not evidence that the initializer intentionally commits permissions separately.

The historical wrapper duration was **32.602 seconds**. Its journal START→FAIL interval was **31.174 seconds** (2026-11-04 19:29:16.809Z→19:29:47.983Z). A 30-second transaction lifetime plus network round trips and wrapper/configuration/teardown work explains the observed range; the missing historical query trace prevents assigning every millisecond or identifying the exact historical exception. The latency reproduction failed after about 30.2 seconds of initialization, excluding the explicit test settling wait. The targeted race failed after about 30.5 seconds.

No schema mismatch, permission uniqueness conflict or dependent-insert ordering defect is required to reproduce this failure. Both the existing partial state and clean state initialize successfully at low latency. Current read-only production inspection found zero slow active queries, long active transactions or lock waiters. That observation cannot prove historical lock/pool conditions; those were not retained. Pool exhaustion was not needed for either reproduction. No timeout was increased.

## Minimal correction

- `backend/scripts/catalog-release-core.mjs`: replace emulated upserts with `createMany(skipDuplicates)` for permissions, scope registrations and memberships. Resolve existing permission IDs between the two native batches. Preserve existing descriptions, identities, grants, revoked-membership guards, default-context guards, advisory lock, Serializable isolation and 30-second limit. No retries are added. Attach only whitelisted step/duration metadata to the original error.
- `backend/scripts/catalog-release.mjs` and `release-failure.mjs`: persist sanitized error code, foundation step and elapsed milliseconds in the failure journal before exiting. Never persist raw messages, SQL, arguments, credentials or stacks. The private wrapper may retain its generic public stop message: the inner diagnostic is now recoverable from the private journal. Its release paths and identity guards must be reviewed for a new staged release; do not edit the existing verified stage in place.
- `release-foundation-regression.mjs` and `release-delivery-verification.mjs`: add real-database regression coverage to the existing delivery fixture. The harness refuses non-loopback/non-test destinations and requires a fresh isolated fixture.
- `release-failure.test.mjs`: verify diagnostic allowlisting and private-field exclusion.

**No Prisma schema, migration SQL, NestJS server source, authentication implementation, dependency or feature flag changed.** All nine already-applied migrations remain untouched. This is a backend **operator-script** source change: the PR and staged release/tool receipts must be updated and reviewed before use, even though the running NestJS application does not need a restart for a foundation-only operation.

## Fresh snapshot and isolation

A consistent read-only exported snapshot was dumped with PostgreSQL **18.6**, streamed through age encryption on Oracle and transferred encrypted to the protected Windows recovery directory. The private age identity stayed on Windows. No OCI request/upload or new cloud resource was used; the previous OCI backup is preserved.

- Captured: **2026-11-04 19:44:42 UTC / 2026-11-05 00:44:42 PKT**.
- Object/file: `vogpk-neon-20261104T194442Z-a09444e7.dump.age`.
- Encrypted size: **281,455 bytes**; logical archive size: **281,191 bytes**.
- Ciphertext SHA-256: `5e17d127d14aed5f875e6ed3bbdf1e6fa660b4c828c4fcde1bbde20341c8d686`.
- Source schema fingerprint: `06716571456a19d8ba4693e700519825afe1c0e51e8eaa03f27f460c3c4b0046`.
- Windows ciphertext integrity, full age decryption hash and archive magic: PASS.
- Restore into native PostgreSQL 18.6, private Unix socket, loopback port 65436, private tmpfs data/WAL, no production listener changes: PASS.
- All **65 table inventories/counts**, including nine migration records, 28 permissions, existing sessions and the ungranted partial permission: PASS.
- Schema inventory: 559 columns, 704 constraints, 200 indexes, 64 triggers and 34 functions. All match, except three individually inspected equivalent CHECK expression renderings produced by dump/reparse (array casts and AND parentheses). The verifier accepts only those exact observed changes; all other differences fail closed. Initial strict-compare attempts stopped and cleaned up before this distinction was established.
- Test-only database clones were created from the isolated snapshot; production received only read-only queries and pg_dump snapshot reads.
- Both final isolated clusters stopped; temporary archive and tmpfs cluster contents removed; offline page checksums PASS; production service/artifact/environment comparison unchanged. No plaintext backup file was written to Windows. Protected encrypted archive and private evidence remain available.

The verified local recovery receipt is the authority for this snapshot. It does not create an off-site/offline second-device copy or activate a schedule. Recheck freshness and protection before a retry; under the prior 24-hour rule this snapshot expires **2026-11-06 00:44:42 PKT**. Obtain another verified recovery point if that window expires or relevant production state changes. Do not reuse an old pre-migration plan/fingerprint merely because a newer backup exists.

## Executed regression results

| Test | Result |
|---|---|
| Original fast initializer on restored partial fixture | PASS; demonstrates schema/ordering compatibility |
| Original at simulated measured 63 ms round trip | Reproduced failure P2003/23503 around deadline rollback |
| Original targeted delayed `media.approve` lookup | Reproduced P2028 and exact single ungranted partial row |
| Patched clean migrated fixture | PASS |
| Patched fixture with existing `media.approve` | PASS; original permission identities/descriptions preserved |
| Fully initialized rerun | PASS; stable context, membership and permission identities; no duplicate roles/permissions |
| Injected scope-registration exception | PASS; complete rollback, original code and step retained |
| Forced 200 ms test-only deadline with delayed native INSERT response | PASS; P2028, no partial or late writes after settling |
| Existing Owner, session rows and legacy roles/grants | PASS; in-memory fingerprints unchanged |
| Scoped Owner tenant/store authorization | PASS; media.approve/listings.publish available in their correct scope |
| Platform scope / Platform Super Admin grants | PASS; access denied, zero assignments, no scoped roles created |
| Patched measured-latency performance | PASS; about 1.4 seconds, approximately 22 driver calls including harness overhead |
| Backend build / lint / unit tests | PASS; 40 tests in 10 files |
| Sanitized error unit tests | PASS; 2 tests |

Publication review reran clean/partial/expiry scenarios on the restored PostgreSQL
18.6 fixture and explicitly checked scoped grant/assignment tables. A successful
rerun preserves all existing identities, grants and memberships and adds exactly
one intended `release.foundation_verified` audit event. This audit write is
intentional; idempotence does not mean suppressing verification evidence. Local
build/lint, all 40 backend unit tests and two diagnostic tests passed again.

Production postcheck: nine applied/zero pending migrations; fingerprint unchanged; zero scoped foundation/catalog records; `media.approve` remains untouched/ungranted; original Owner, sessions, roles and 27 permissions unchanged. API PID **33120**, Caddy PID **6864**, both active with zero restarts and `NeedDaemonReload=no`. Listener **127.0.0.1:4000**; local/public health and readiness, storefront and admin login all HTTP 200. Original staged source/artifact manifests still verify. No login/logout test was performed because this investigation grants no production session/audit writes.

## Approval boundaries and retry recommendation

**Local correction: ready for review. Production initialization-only retry: NO-GO until the following gates pass.**

1. Review/publish the script patch to Draft PR #2 under separate approval; keep the PR Draft. Stage and verify the new exact operator-script source in a separate non-running release; retain original artifacts. No API restart is required or authorized.
2. Prepare a new foundation-only private execution plan against the **post-migration** fingerprint and nine-migration history. Verify current Owner/member IDs and expected exact partial permission state. Recheck original session/legacy RBAC fingerprints, recovery freshness, API health and quiet traffic. Obtain approval for the new plan hash. Do not rerun `migrate`.
3. Only after explicit production-write approval: execute the corrected initializer once. Its error journal must retain the sanitized diagnostic. Stop on any drift, transaction/locking error, failed verification or health regression; do not automatically retry or clean up the partial permission.
4. Verify exactly one VOGPK tenant/store/default bridge, expected active memberships, 82 registered capability codes and 90 scope relationships (plus any separately reviewed unrelated records), zero Platform assignments, unchanged Owner credentials/sessions/legacy grants, and healthy services. Idempotence testing belongs in isolation; do not add an unapproved second production apply.
5. Keep catalog import, operator API, backend activation, Vercel merge/settings, catalog writes/reads and media approvals disabled pending their own approvals.

No database rollback/reset/restore, blanket seed or permission deletion is part of the correction or failure response. This patch repairs future initialization; it does not change the nine applied migrations or the current production partial state.
