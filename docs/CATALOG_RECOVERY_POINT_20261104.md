# Fresh local encrypted catalog-release recovery point

## Result and approval boundary

On November 4, 2026, the alternative-destination recovery exercise passed. The
existing reviewed capture procedure was used without OCI uploads. Its read-only,
repeatable-read exported snapshot was shared with PostgreSQL 18.6 `pg_dump` over
verified TLS. The dump was encrypted directly with the existing age public
recipient; neither a plaintext dump nor the age private key was written to Oracle
persistent storage. No production records were changed.

See [sanitized verification evidence](catalog-recovery-20261104-verification.json)
for the exact UTC capture timestamp, archive identifier, encrypted size, SHA-256,
restore timing, 42 logical checks and cleanup results. Private per-table checkpoint
counts and restore state are retained only in the protected operator recovery
directory. No credentials, identity hashes, dump contents or recovery keys are in
this document or its sanitized evidence.

The fresh recovery-point gate is satisfied for this captured timestamp. Production
rollout is still **NO-GO without separate approvals**. The previously staged
`7223c7817f7c7b93b040c4e5c8201af36ae21e83` release remains inactive, with source and
artifact hashes verified. Eight additive commerce migrations, foundation/RBAC
initialization, catalog import, backend activation, application deployments,
media decisions, dynamic reads and admin writes remain separate controlled gates.
Nothing in this exercise authorizes any of them.

## Storage and key custody

- Encrypted archive, private manifest, integrity proof and restore state are in
  `D:\work\coding\vog-secrets\recovery\2026-11-04`. Windows ACLs allow only the
  current Windows account and SYSTEM; inherited access was removed.
- The existing private age identity remains exclusively on Windows and was used
  without printing or copying it. The user previously confirmed independent key
  escrow; that custody statement was not independently re-audited here.
- Only ciphertext was transferred from Oracle to Windows through pinned SSH.
  Ciphertext length/SHA-256 and complete decrypted archive length/SHA-256 plus
  PostgreSQL archive magic were checked locally without writing plaintext.
- The prior OCI recovery point was preserved. No OCI SDK operation or upload was
  used; incomplete OCI quota verification remains unresolved.
- Only one physical Windows disk was detected, with no removable offline device.
  A second independent encrypted copy is **PENDING DEVICE**. Another drive letter
  on the same disk is not a separate recovery copy.

## Verified restore procedure

The established restore harness was adapted only for a unique temporary run and
local ciphertext provenance; its OCI download step was removed. No production
application source, configuration or schema was changed.

1. Verify the encrypted archive against the recorded size and SHA-256 before
   attempting decryption. Derive the public recipient from the retained identity
   privately and confirm it matches capture evidence. Never print the identity.
2. On existing Oracle infrastructure, create a fresh owned mode-700 tmpfs directory
   with a run-specific marker. Start the existing PostgreSQL 18.6 binaries as the
   non-root operator with restricted CPU/memory settings, peer authentication,
   host rejection and `listen_addresses=''`. Use a private Unix socket only.
3. Reject inherited PostgreSQL/production connection settings before connecting.
   Verify the actual server database, role, data directory, socket transport and
   version before any restore. A synthetic production-host setting was rejected
   before connection in this exercise.
4. Decrypt on Windows and stream plaintext through pinned SSH to private Oracle
   tmpfs. Check its complete hash and length again before restoration. The private
   identity never leaves Windows. Never save the plaintext to Windows or a
   persistent server volume.
5. Review the archive table of contents for unexpected executable/global objects;
   restore into the verified empty isolated database with `--no-owner --no-acl
   --exit-on-error --single-transaction`. Stop on any mismatch or restore error.
6. Verify schemas, tables, every snapshot table count, column types/defaults,
   constraints, orphan absence, indexes, Prisma migration checksum, six system
   roles, 27 permissions, 79 role-permission links and Owner/session hash formats.
   Check production files, unit configuration and service state remain unchanged.
7. Remove the plaintext archive, stop the temporary cluster, run offline page
   checksum verification, then remove its owned marker-guarded tmpfs data, WAL and
   socket directory. Preserve only encrypted backups and private/sanitized proof.

The private run-specific helpers are retained under
`D:\work\coding\vog\.local\catalog-stage2-20261104`. They deliberately refuse
overwriting this run's state. A future exercise requires a newly reviewed unique
run directory; do not delete existing evidence or reuse an existing database.
Production restore is not approved by this procedure and requires a separate
recovery decision and destination verification.

## Independent offline copy when a device becomes available

Use a user-identified separate offline device. Copy the `.dump.age` archive,
manifest and integrity proof into a protected folder, then independently read the
destination archive and compare its SHA-256 with the recorded digest. Record the
device and verification time privately, eject it and retain it offline. Do not
copy the private key onto the backup device. Until this is completed, the new
backup is off-server but does not provide two independent fresh archive copies.

## Limitations and next rollout gates

This logical archive excludes global Neon database roles, ownership/ACLs,
credentials and external provider configuration; those require separate approved
configuration. Application RBAC relationships were restored and verified.

No automated schedule, continuous recovery or guaranteed RPO/RTO is claimed. The
point-in-time snapshot excludes later session/audit/activity changes. Reassess its
age immediately before approved DDL and reconcile or freeze relevant edits in the
migration window. A lost Windows disk could lose the fresh archive even with an
independently retained key; the older OCI backup is not a substitute for a fresh
offline copy.

No new cloud resources, paid storage or Object Storage requests were introduced.
Existing compute and small SSH transfers remain subject to the current account's
terms; this exercise does not certify account-wide billing or OCI free headroom.

Before activation, separately approve the exact release and reviewed operational
fix, inspect current schema drift, refresh health/artifact/rollback checks, decide
the media presentation policy, and authorize the staged migration/import and
static-mode deployment sequence in the catalog production runbook. Public dynamic
reads and admin writes require their own final controlled cutovers. Neither PR #2
nor production services were changed by this exercise.
