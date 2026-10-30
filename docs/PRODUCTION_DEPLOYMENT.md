# VOGPK production deployment and readiness

Baseline evidence collected **2026-10-30, Asia/Karachi**; approved backup and isolated restore evidence updated **2026-10-31**. PASS means actually observed or tested; PENDING identifies an unexecuted step or an access/approval gap. The reviewed backend release is prepared on Oracle but is not running. One approved private free-allocation OCI bucket and a restricted instance-principal backup policy were created during the earlier backup phase. This restore drill changed no IAM/firewall policy, production credentials or data, and performed no production restart, deployment, merge or paid resource creation.

## Architecture and observed baseline

| Component | Current deployment |
| --- | --- |
| Git | `Monis-iqbal21/vog-pk`, production baseline `3b65e51e652dce77b8971095bdc9bc167f3b2bf6` |
| Storefront | `https://vogpk.vercel.app`, Vercel project `vogpk`, Next.js / Node 24 |
| Administration | `https://vogpk-admin.vercel.app`, Vercel project **`vog-admin`**, Next.js / Node 24 |
| API ingress | `https://80-225-254-168.sslip.io`, Caddy 2.11.7 |
| API process | `vogpk-api`, Ubuntu user `ubuntu`, Node 24.22.2, NestJS 12 |
| Internal API | `127.0.0.1:4000`, `/home/ubuntu/vog-pk/backend` |
| Oracle | Ubuntu 24.04.5 ARM64, Mumbai `ap-mumbai-1`, A1 Flex, 2 OCPUs / 12 GB RAM |
| Database | Neon PostgreSQL 18.6; Prisma 7; production migration applied |

The browser contacts the admin's same-origin BFF. Only the BFF sends the private bridge header and an opaque session credential to NestJS. NestJS resolves current account status/permissions from PostgreSQL. Caddy terminates TLS and proxies to loopback. Store customers can browse without staff authentication.

Local, fetched GitHub and Oracle all had the baseline revision above. Oracle has exactly one tracked source modification: `app.listen(..., '127.0.0.1')` in `backend/src/main.ts`. It was preserved untouched. The new local `listenOptions` helper makes production default to that binding while retaining local development on all interfaces; `HOST` and `PORT` are validated overrides. No migration, business data, staff role or existing Owner was changed.

The initial Vercel production deployments were READY: storefront `dpl_4WPLyy8QcVS46pxFghj7oAcDfFhk`; admin `dpl_6rZRt5mBDrf2YWSEtzGABF1a1mDJ`. The connector lists the expected production environment keys without decrypting them. Its summary does not expose root directories or usable billing-plan details; verify `frontend` and `admin` roots and the actual subscription in the dashboard. Do not recreate either project.

## Environment names and secret handling

| Location | Names |
| --- | --- |
| API | `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL`, `ADMIN_ORIGIN`, `STOREFRONT_ORIGIN`, `BFF_SHARED_SECRET`, `SESSION_IDLE_MINUTES`, `SESSION_ABSOLUTE_HOURS` |
| Admin | `ADMIN_ENVIRONMENT`, `ADMIN_ORIGIN`, `API_URL`, `STOREFRONT_ORIGIN`, `BFF_SHARED_SECRET`, `COOKIE_SECURE`; optional verified-ingress `TRUST_PROXY_HEADERS` |
| Backup | `BACKUP_DESTINATION_APPROVED`, `BACKUP_REPOSITORY_DEDICATED`, `BACKUP_WEEKLY_PRUNE_APPROVED`, `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, `RESTIC_CACHE_DIR`, `PGSERVICEFILE`, `PGPASSFILE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` |

The existing production `.env.local` is `600 ubuntu:ubuntu`. SSH directory/authorized keys are 700/600. Caddy's certificate storage is 700 under the `caddy` account. Keep the SSH key outside Git in the existing secrets directory; do not copy it to the repository or server. Do not print environment files, database connection strings, bridge values, password hashes or cookie values. Existing production credentials must stay in place. A sample of up to 500 recent API journal entries contained none of the configured database/bridge values; those same configured values were absent from Oracle's Git history. This is sampled evidence, not a guarantee about all historical logs or every possible secret.

The current pg driver warns about future TLS interpretation of `sslmode=require`. Current versions treat it as certificate-verifying TLS; no TLS bypass was introduced. Privately review an explicit `sslmode=verify-full` before a future driver upgrade, under credential/configuration-change approval. Do not print or overwrite the database URL to make this adjustment.

## Repeatable application deployment and rollback

`ops/deploy-backend.sh` prepares a separate ARM64 release from an immutable Git commit. It does not pull over the dirty production checkout, replace `.env.local`, run migrations, seed roles, bootstrap an Owner or reset data. Build/install/tests use a minimal environment and do not receive a runtime environment-file link. Only after they pass is the existing private environment linked into the release. These processes still run as the trusted ubuntu operator, so this is not isolation against malicious same-UID dependencies. New dependencies, generated client and build output stay inside ignored release storage. Schema/migration changes are refused for separate review. Preparation runs build, lint and unit tests before writing a release marker.

These are **remaining commands**, not a record of an executed release. First approve publishing the feature branch, then review a draft pull request into main. Publishing the branch may trigger Vercel preview builds; merging main may trigger production builds. Never force push or merge without separate approval:

```powershell
git push --set-upstream origin codex/production-readiness
```

The PR body is prepared in `docs/pull-requests/production-readiness.md`. GitHub cannot create the PR while the branch exists only locally. Confirm an approved database recovery point before production deployment. After approved review/merge, SSH with the existing key and pinned known host:

```powershell
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -i D:\work\coding\vog-secrets\ssh-key-2026-10-28.key ubuntu@80.225.254.168
```

On Oracle, substitute the approved **full 40-character SHA**. Fetching does not overwrite the production source change:

```bash
cd /home/ubuntu/vog-pk
git fetch origin
APPROVED_SHA=FULL_APPROVED_COMMIT_SHA
git cat-file -e "$APPROVED_SHA^{commit}"
mkdir -p .local/operator-tools
git show "$APPROVED_SHA:ops/deploy-backend.sh" > .local/operator-tools/deploy-backend.sh
bash .local/operator-tools/deploy-backend.sh prepare "$APPROVED_SHA"
```

**Obtain restart approval before the next command.** Activation saves the previous managed override (or records its absence), installs one clearly owned systemd drop-in, changes the service's working directory/entry point to the prepared release and restarts `vogpk-api`. It explicitly fixes `NODE_ENV`/`HOST` to production/loopback. Failed health/binding checks restore the exact saved override, or remove only the newly created override if it was absent, then restart the previous application; approval must cover that automatic fallback. The original base unit and source are not rewritten. No database rollback occurs.

```bash
bash .local/operator-tools/deploy-backend.sh activate "$APPROVED_SHA" --approved-restart
systemctl is-active vogpk-api caddy
curl --fail --silent http://127.0.0.1:4000/api/health
curl --fail --silent http://127.0.0.1:4000/api/health/ready
curl --fail --silent https://80-225-254-168.sslip.io/api/health/ready
ss -lnt 'sport = :4000'
```

Manual application rollback also requires restart approval:

```bash
bash .local/operator-tools/deploy-backend.sh rollback --approved-restart
```

The first rollback target is the untouched original backend, whose health probe predates `/health/ready`; legacy rollback checks liveness/binding only. Later releases require readiness. Keep the previous application, its dependencies and the original environment. Release cleanup is manual after health verification and rollback-window approval. This process has isolated safety/syntax tests, but **live activation, automatic rollback and manual rollback drills remain unverified** because no restart was authorized. It involves a brief service interruption; no zero-downtime claim is made.

The rollout preflight added nine deployment-path regression tests, bringing operations coverage to 23 isolated tests on Windows and Ubuntu ARM64. They cover runtime/build environment separation, source linting below the ignored release directory, failed preparation, approval checks, successful activation/manual rollback, byte-exact override restoration, failed-health fallback, unrelated-override refusal and missing rollback state. An actual backend build/source lint/nine-unit-test run also passed without a runtime environment file. This is stronger fixture/build coverage, not a production restart drill. Probe retries can take approximately 150 seconds before fallback, plus service restart time; a maintenance window and active operator are required.

## Health and monitoring

The existing `/api/health` is liveness only; it does not prove the database is available. The new local `/api/health/ready` runs a read-only `SELECT 1`, returns only `{status: 'ok'}` or a generic 503, suppresses connection diagnostics, bounds the response to three seconds and shares an outstanding slow query. It is uncached/noindex and public for probes. It is **not deployed yet**. Do not enable its monitor before the approved release passes health checks. Cold-start latency must be observed on Neon before choosing an alert threshold; do not automatically restart the API merely because the database is slow.

A built local NestJS instance also passed a real PostgreSQL readiness request with HTTP 200 and no-store, beyond the isolated failure-path HTTP tests. The certificate-check script passed directly against Oracle's existing Caddy certificate without installing a service or requesting renewal.

Prepared tools and disabled-by-default templates:

- `monitor-health.sh`: systemd state, local liveness/readiness and external HTTPS proxy; ten-minute timer.
- `check-certificate.sh`: trusted chain, correct hostname and at least 14 days of remaining validity; daily timer.
- `send-alert.sh`: generic email through an existing approved SMTP service and root-only msmtp configuration; no destination or credential defaults.
- `vogpk-backup.service`/timer: daily encrypted backup at 01:30 UTC plus a randomized delay.

Caddy's active certificate covers the sslip.io hostname and expires **2027-01-27 05:14:22 UTC**. Configuration validation and current TLS checks passed. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) manages renewals while the hostname, ingress, writable certificate storage and process remain available; a future renewal has not been forced or claimed as tested.

For free external outage email, prepare UptimeRobot Free HTTP monitors for the API liveness URL, storefront and admin `/login`, plus readiness after release. It currently permits [commercial use and five-minute checks](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan). Confirm/verify the owner's email in that service and test notification delivery only after approval. Database probes keep Neon awake and consume compute allowance; budget their frequency rather than polling continuously. External outage checks are necessary because a monitor on a dead VM cannot send mail.

UptimeRobot Free [does not provide SSL expiry/error monitoring](https://help.uptimerobot.com/en/articles/11358746-monitor-ssl-certificate-expiration-errors-with-uptimerobot). The prepared daily local TLS check plus approved SMTP email supplies certificate warnings without buying that feature. It still depends on the VM being alive; provider outage mail supplies the complementary signal. No monitor account, email recipient, credential or schedule was activated.

After approval, review/install PostgreSQL 18 client tools, restic and msmtp using approved distribution/vendor sources. Ubuntu's older default PostgreSQL client cannot dump this PostgreSQL 18 production database. Do not install a database server or upgrade unrelated packages. Review package changes in a maintenance window. Install reviewed ops files root-owned in `/opt/vogpk/ops`, units in `/etc/systemd/system`, and validate with `systemd-analyze verify` before enabling. Do not install the review-only API/Caddy drop-ins as standalone service files.

The script tests also passed on the actual Ubuntu ARM64 host in a disposable, mocked fixture. `systemd-analyze verify` accepted all seven service/timer units. Temporary files were removed; no unit was installed or started. These checks do not prove provider connectivity, successful mail delivery or a real encrypted restore.

After deployment/install approval, export the approved ops tree without touching the original tracked source, then install only the reviewed monitoring units:

```bash
cd /home/ubuntu/vog-pk
mkdir -p .local/operator-tools
git archive "$APPROVED_SHA" ops | tar -x -C .local/operator-tools
sudo install -d -m 755 /opt/vogpk/ops
sudo install -m 755 .local/operator-tools/ops/*.sh /opt/vogpk/ops/
sudo install -m 644 .local/operator-tools/ops/systemd/vogpk-monitor.service .local/operator-tools/ops/systemd/vogpk-monitor.timer .local/operator-tools/ops/systemd/vogpk-certificate.service .local/operator-tools/ops/systemd/vogpk-certificate.timer .local/operator-tools/ops/systemd/vogpk-alert.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/vogpk-monitor.service /etc/systemd/system/vogpk-certificate.service /etc/systemd/system/vogpk-alert.service
```

Do not run these before approval or before the readiness release/private email setup. Backup installation is a separate approval after tool, account, destination and credential preparation. It adds only the prepared backup service/timer; it does not install either hardening drop-in automatically.

The following commands are for an approved monitoring activation **after** root-owned script installation and private SMTP setup; they were not run:

```bash
sudo systemctl daemon-reload
sudo systemctl start vogpk-monitor.service vogpk-certificate.service
sudo systemctl enable --now vogpk-monitor.timer vogpk-certificate.timer
systemctl list-timers 'vogpk-*'
```

Use `ops/alert.msmtprc.example` for the shape of the private SMTP configuration, with TLS verification retained. `/etc/vogpk/alert.msmtprc`, `/etc/vogpk/alert-smtp-password` and `/etc/vogpk/alert-recipient` must be root-owned 600; none is committed or created by this task. Do not send test mail until the destination and credentials are approved. **Email alert activation: PENDING APPROVAL.**

## Encrypted Neon backup — verified manual checkpoint

Authenticated OCI inspection confirmed Mumbai as the home region, 10 GiB free Object Storage and approximately zero usage before creating the approved private Standard bucket `vogpk-neon-backups`. The first age-encrypted object is `vogpk-neon-20261030T205611Z-e029cde4.dump.age`, 19,619 bytes. Capture began 2026-10-30 20:56:11 UTC (2026-10-31 01:56:11 Asia/Karachi). The private key remains on the user's Windows computer with independently retained recovery material, confirmed by the user. No private key is stored on Oracle or in Git.

An exact-instance dynamic group permits only object create/list/read and bucket-metadata read in that bucket. It has no overwrite/delete, bucket-management or administrator rights. No persistent admin API key was installed on the server. The initial upload/download/full decryption verification passed. The manual backup used PostgreSQL 18.6, an exported read-only consistent snapshot, a direct Neon connection and verified TLS. It is an **age-encrypted object, not a restic repository**. Recovery procedure and the successful full restore exercise are recorded below and in [restore-drill-verification.json](restore-drill-verification.json).

Oracle's [Always Free documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) currently lists 20 GB combined storage for Always Free-only accounts and 50,000 requests/month; paid/trial Standard allocations differ. Verify the account-specific allowance, existing usage, retention footprint and temporary prune headroom before approval. Do not enable paid capacity, archive transitions, replication or versioning without evaluating costs. Keep a conservative capacity/request warning threshold and stop before exceeding the approved allowance; this implementation cannot enforce OCI account-wide quotas. Always Free VM reclamation is also a continuity risk; retain recovery assets off the VM.

### Future scheduled restic strategy — PENDING APPROVAL

`postgres-backup.sh` prepares a separate future strategy using `pg_dump` streamed into **restic's encrypted remote repository**. It was not used for the verified age checkpoint. No restic repository, service account, storage credential files, prune or schedule were configured. That setup requires separate approval and permissions review; the current write-once backup principal deliberately lacks restic's deletion/prune permissions. Do not broaden it automatically. The storage credentials and repository password must remain separate and private. See [OCI S3 compatibility](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm).

Preparation after storage/credential approval:

1. Confirm a dedicated private bucket and least-privilege access to that bucket; no public access or pre-authenticated public URL. Choose the actual namespace/bucket in the console. A restic repository uses the OCI S3-compatible HTTPS endpoint with the namespace, `ap-mumbai-1`, bucket and a dedicated prefix. Verify endpoint/region settings against OCI's current API documentation rather than guessing account identifiers.
2. Privately configure `ops/backup.env.example` as `/etc/vogpk/backup.env` (root 600). Create the unprivileged `vogpk-backup` service account. Store the three referenced private files under `/etc/vogpk/backup`, readable only by that account, with modes 600/400 and restricted parent traversal.
3. Configure a direct, non-pooler Neon host in the service file, `sslmode=verify-full`, and an approved read-only backup database identity able to dump all application tables/sequences. Do not reuse an Owner login or change the existing application credentials. Provisioning new credentials requires approval.
4. Put the database password in the private libpq password file, not `DATABASE_URL`/`PGPASSWORD` or arguments. Use [libpq service files](https://www.postgresql.org/docs/current/libpq-pgservice.html) and the reviewed sample service names. Confirm PostgreSQL client major version 18 or a reviewed compatible newer client.
5. Generate a strong repository encryption password privately; escrow a recovery copy in an approved password manager/offline location independent of the VM and bucket. Do not put the only key in the backup or on the VM.
6. Once approved, initialize the repository **once** under the backup account using the protected environment (`restic init`). Do not source unreviewed shell snippets or print credentials. Never run init on an existing repository to "fix" an access error.
7. Set the destination/dedicated approval flags privately, run one manually approved backup, check `restic snapshots --host vogpk-oracle --tag vogpk-postgres-complete`, and complete a separate-database restore drill. Enable the timer only after those succeed.

Retention: seven daily, four weekly and six monthly recovery points, scoped to the dedicated host and complete-snapshot tag. A failed producer/upload remains pending and is never promoted to a valid recovery point. Pending snapshots need operator review/removal after the failure is understood. Restic `forget` removes snapshot references; bytes remain until prune. With separate pruning approval, the script runs check/prune/check on Sundays. This may consume requests, temporary storage and Neon/network allowance; do not enable it until capacity is reviewed. Without prune, storage use can grow despite snapshot retention. A compromised VM with write/delete storage credentials can delete backups; immutable/offline protection is a separate design/approval, not a property claimed here. See [restic streaming backup](https://restic.readthedocs.io/en/stable/040_backup.html) and [retention/pruning](https://restic.readthedocs.io/en/stable/060_forget.html).

Only after separate approval of the scheduled restic strategy, its credentials and retention/prune capacity may an operator run the following. The successful manual age backup/restore does **not** authorize these commands:

```bash
sudo systemctl start vogpk-backup.service
sudo systemctl enable --now vogpk-backup.timer
```

These commands were not executed. PostgreSQL 18.6 tools are privately extracted; the private OCI bucket, manual encrypted backup and full isolated restore are verified. Restic and its scheduled-service configuration remain uninstalled. **Automatic backup/retention/pruning activation: PENDING APPROVAL.**

### Future restic recovery without overwriting production

Choose a reviewed complete snapshot, verify restic integrity and recover into a **new, separately approved empty database/branch**. `restic dump` decrypts only into a pipe; do not write the dump to an unencrypted shared directory. Provision the empty destination separately and privately configure the `vogpk-restore` service; its target must differ from production. Creation of a recovery branch/database may consume paid allowances and requires approval first.

```bash
# Protected backup environment already loaded by a trusted operator process.
# Verify PGSERVICEFILE/PGPASSFILE and the distinct empty restore target privately.
restic check
restic snapshots --host vogpk-oracle --tag vogpk-postgres-complete
SNAPSHOT=FULL_REVIEWED_COMPLETE_SNAPSHOT_ID
set -o pipefail
restic dump "$SNAPSHOT" /vogpk.dump | pg_restore --list >/dev/null
restic dump "$SNAPSHOT" /vogpk.dump | pg_restore --dbname=service=vogpk-restore --no-owner --no-acl --exit-on-error --single-transaction
```

Do not use `--clean`, `--create`, schema reset or the production connection for a drill. Dumps are trusted executable database content; inspect the archive before restoring, as [PostgreSQL documents](https://www.postgresql.org/docs/current/app-pgrestore.html). Validate schema/migration state, table counts, audit data and application/RBAC behavior in the isolated environment; restored sessions and staff hashes remain sensitive and must not be exported or used as production access. Document the recovery timestamp and data-loss window. Do not switch the production connection until the recovery is reviewed and an approved cutover/rollback plan exists.

Neon also provides [point-in-time restore](https://neon.com/docs/postgres/backup-restore/branch-restore). Authenticated console inspection on 2026-10-31 confirmed the Free plan, a six-hour restore history, 32.32 MB project storage and no snapshots at inspection. Recheck the moving history window and actual snapshot billing before any future resource creation. No Neon snapshot or restore was performed. Never restore the production root branch in place during a test.

### Approved age-backup restore drill — PASS, 2026-10-31

The existing object was freshly downloaded through the restricted instance principal and verified against its ciphertext checksum. Windows age decrypted it locally and streamed plaintext over encrypted SSH into a private memory-backed archive. The private age identity never left Windows. The target was a new PostgreSQL **18.6 ARM64** cluster entirely in `/dev/shm`, with TCP listening disabled, a mode-700 Unix socket directory and peer authentication mapped only to a distinct drill administrator. No database server package was installed into the operating system. CPU affinity, lower process priority, a 2 GiB per-process address-space limit and small database buffers bounded resource use on existing infrastructure.

Before receiving/restoring data, the verifier rejected inherited database connection settings and checked the actual server version, database, user, data directory, empty target and Unix-socket connection. A synthetic non-isolated PGHOST test was rejected before any connection. No production database settings were loaded into the restore process. The archive object list was reviewed for unexpected executable/global objects before a single-transaction restore using `--no-owner --no-acl --exit-on-error`. No migrations, seeds or Owner recovery commands ran.

**All 42 logical checks passed:** all user schemas and nine table counts; eight application tables' column names/types/null/default definitions; Prisma bookkeeping columns and applied migration name/checksum/completion; all six validated foreign keys including delete/update actions and referenced columns; no orphan links; all expected indexes and nine primary keys valid; six system roles, all 27 permission codes and all 79 exact role-permission links; one active Owner; and no unexpected public functions/views/triggers. Application RBAC data was verified; global Neon login roles, ownership/ACLs and credentials are intentionally not recreated by this logical archive.

| Restored table | Checkpoint and restored rows |
| --- | ---: |
| AdminSession | 1 |
| AdminUser | 1 |
| AdminUserRole | 1 |
| AuditLog | 2 |
| LoginThrottle | 2 |
| Permission | 27 |
| Role | 6 |
| RolePermission | 79 |
| _prisma_migrations | 1 |

The temporary cluster was stopped, and offline PostgreSQL page checksums passed: **1,287 files / 3,898 blocks scanned, zero bad checksums**. The plaintext archive had already been removed after restoration; the entire temporary cluster/data/WAL/socket directory was then removed from tmpfs. Swap was disabled. No matching temporary PostgreSQL process or TCP listener remained. No plaintext dump or restored database was left on persistent disk; the encrypted OCI object and protected recovery key remain retained. Production source/build/environment/unit hashes, API start timestamp, restart count and working directory remained unchanged. Local health and the loopback listener were rechecked.

Measured timeline (UTC): preparation began **21:32:24.770**, restore **21:33:10.456–21:33:10.488**, final logical verification **21:34:57.906**, stop/checksum/cleanup completed **21:35:23.057**, all on 2026-10-30 (2026-10-31 in Asia/Karachi). Restore command: **0.032 s**. Whole measured drill: **178.287 s**, excluding tool download/extraction and including verifier corrections. Checkpoint age at drill start: **2,173.233 s**. These are observed exercise timings, not production RTO or scheduled-RPO guarantees. The drill used one additional Object Storage GET; metadata/authentication calls are not a complete tenancy billing meter.

Errors resolved: the privately extracted server needed the Ubuntu liburing2 dependency; it was extracted without an OS installation. An initial verifier assertion omitted the valid `SET NULL` FK action and needed text-array normalization; both were corrected, and all checks passed on rerun. There were **zero pg_restore errors**. The intentional destination-guard rejection is recorded separately from failures. Sanitized evidence: [restore-drill-verification.json](restore-drill-verification.json).

For future recovery of this age object, verify the encrypted checksum, retain the private identity locally and stream age decryption to a guarded, separately approved isolated PostgreSQL 18 target. Do not feed this file to restic. If the current Oracle VM is lost, approve a new narrowly scoped recovery identity because existing access matches that VM only. This exercise does not authorize a production database restore or connection cutover.

**Updated recommendation after final systemd review:** recovery-point and Oracle ARM64 preparation gates are satisfied, and the reload warning is explained below. **Conditional GO for a controlled rollout using the existing prepared release, after explicit approvals.** First perform an approved manager reload without restarting services and require unchanged service/PID/health plus a cleared reload flag. No reload, restart, merge or deployment has been performed. A live release/rollback and production authenticated multi-role browser verification remain separate checks; commercial hosting/security/monitoring items below remain open.

### Final systemd preflight — 2026-10-31

Evidence: [systemd-preflight-verification.json](systemd-preflight-verification.json). The host runs systemd 255.4-1ubuntu8.18. `NeedDaemonReload=yes` comes from the **manager-wide unit_file_state_outdated flag**, not a mismatched API unit. The transient `init.scope` also reports yes despite having no fragment, source file, loaded drop-ins or possible scope drop-ins in any unit search directory. This rules out the file/drop-in branches of [systemd 255's implementation](https://github.com/systemd/systemd/blob/v255/src/core/unit.c#L3589-L3615). Unchanged vendor targets and Caddy report the same global condition. The flag is set by unit-file installation operations and cleared by a manager reload; the available read-only diagnostics do not retain which historical caller last set it. No attribution to a particular operator/package is claimed.

The API base unit was last modified at 2026-10-29 05:45:26 UTC, before its current process began. Loaded properties, all declared on-disk directives and running argv/cwd agree. There are no API-specific, dash-prefix or global service drop-ins in the unit search paths. No base-unit edit or other configuration repair is necessary. The existing `NeedDaemonReload=yes` remains unchanged because this audit did not reload the manager.

| Setting | Current loaded / disk / process | Proposed release override |
| --- | --- | --- |
| User | ubuntu | Inherited unchanged |
| WorkingDirectory | original backend | Prepared 8c75ca5 release/backend |
| ExecStart | Node with --env-file pointing to original .env.local, original dist/main.js | Node release dist/main.js; existing linked .env.local loaded by dotenv |
| Environment | Existing production settings | NODE_ENV=production, HOST=127.0.0.1; existing values retained |
| UMask | 0022 | 0077 |
| NoNewPrivileges / PrivateTmp | Enabled | Inherited unchanged |
| Restart | on-failure, 5 seconds | Inherited unchanged |
| Stop/start timeout | 90 seconds each; Type=simple | Inherited unchanged |

Node --env-file and the release's dotenv parser were compared using an ephemeral HMAC, with no secret values printed. They interpret every existing environment entry identically; Node startup-only options are absent. The compiled release defaults to 127.0.0.1:4000 in production, and the override explicitly fixes HOST to loopback. The original compiled backend also retains its explicit loopback binding.

Rechecked: all 50 tracked backend files and all 96 dist artifacts match the prepared commit/manifest; release marker, environment symlink and versioned operator script match. Both baseline and proposed unit/drop-in copies pass offline systemd validation. That validation emitted only existing OCI vendor monitoring-unit executable-mode warnings; no unrelated permissions were changed. All 23 hermetic operations tests pass again on ARM64. The original backend dist/dependencies and base unit remain available for rollback.

Rollback restores the previous managed override **byte-for-byte or its prior absence**, then reloads systemd and restarts the retained application. In the present baseline no managed override exists, so fallback removes only its new owned override and returns to the original base unit/ExecStart. Unrelated overrides are refused, and original source/environment/database are untouched. This is exact restoration of the prior effective API configuration, not the former PID/uptime, the global dirty-cache flag, or a filesystem-wide snapshot. Live fallback is still untested until an approved activation/drill.

### Exact controlled rollout sequence — approval required

1. Review/publish only the sanitized documentation/evidence to the existing Draft PR after push approval; never include `.local`, secret files or the unrelated frontend assets. Preserve the verified encrypted checkpoint and its independent key. Keep an operator available for fallback.
2. Obtain approval for a **standalone manager reload**, with no service restart. Capture API and Caddy PIDs/start times, then run:

```bash
systemctl show vogpk-api caddy -p MainPID -p ExecMainStartTimestamp -p NRestarts
sudo systemctl daemon-reload
systemctl show vogpk-api -p NeedDaemonReload -p MainPID -p ExecMainStartTimestamp -p NRestarts -p WorkingDirectory -p ExecStart
systemctl is-active vogpk-api caddy
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:4000/api/health
curl --fail --silent --show-error --max-time 15 https://80-225-254-168.sslip.io/api/health
ss -lntH 'sport = :4000'
```

Require NeedDaemonReload=no, unchanged PIDs/start times and API configuration, active services, successful health and only 127.0.0.1:4000. If anything differs or the flag remains yes, stop and investigate; do not activate or repeatedly force reloads. A manager reload does not intentionally restart the API or Caddy and should not cause a service interruption.

3. Obtain **main merge approval**. Treat merging main as triggering both connected Vercel production builds. Monitor them until READY; verify storefront/login and an authorized existing-session admin read against the still-compatible old backend. Do not modify users or roles for a smoke test.
4. Fetch main on Oracle without checking out/resetting the dirty original tree. Confirm the merged backend tree is exactly the prepared backend tree before using the artifact:

```bash
cd /home/ubuntu/vog-pk
CANDIDATE=8c75ca5858d89599108d96c4493a87dc550977bd
git fetch --no-tags origin main
test "$(git rev-parse origin/main:backend)" = "$(git rev-parse "$CANDIDATE:backend")"
# Expected backend tree: 2b2782eee217c114447eea4ec2b0cec7085edb0f
```

If backend trees differ, stop: review and separately prepare that code. Documentation-only commits do not require rebuilding an unchanged backend tree. Recheck artifact integrity and the original rollback artifacts immediately before activation.

5. Obtain **API override installation/restart approval**, explicitly covering a second restart for failed-health fallback. Then use the already-reviewed immutable script:

```bash
OPERATOR=/home/ubuntu/vog-pk/.local/operator-tools/deploy-backend-8c75ca5858d89599108d96c4493a87dc550977bd.sh
bash "$OPERATOR" activate "$CANDIDATE" --approved-restart
```

The script records prior override state, installs only 20-vogpk-release.conf, reloads systemd and restarts vogpk-api. Caddy is not restarted. No migration/seed/database rollback occurs. Normal API interruption should be seconds but is not measured live and is not zero-downtime. Requests may fail during it. The readiness/binding retry budget is up to about **150 seconds**, in addition to systemd stop/start/fallback time; current stop grace is **90 seconds per restart**. Do not present 150 seconds as a total outage bound.

6. After successful activation, verify:

```bash
systemctl is-active vogpk-api caddy
systemctl show vogpk-api -p NeedDaemonReload -p WorkingDirectory -p MainPID -p NRestarts
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:4000/api/health
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:4000/api/health/ready
curl --fail --silent --show-error --max-time 15 https://80-225-254-168.sslip.io/api/health/ready
ss -lntH 'sport = :4000'
```

Require the release WorkingDirectory/RELEASE_COMMIT, only the loopback listener, local/public success and cleared reload flag. Run the private authenticated dashboard/session/logout and allowed/forbidden-read checks plus storefront smoke test. Never print cookies/tokens. The old backend does not provide /health/ready, so only liveness is expected before activation and after initial rollback.

**Automatic fallback:** any switch/install/reload/restart failure, or failure of local readiness/required loopback binding through all 15 attempts, restores prior override bytes/absence and restarts the old application. If restoration or old liveness fails, operator intervention is required. External HTTPS/admin/storefront smoke failures are **not** included in the automatic probe; an operator uses the separately approved manual rollback:

```bash
bash "$OPERATOR" rollback --approved-restart
systemctl is-active vogpk-api caddy
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:4000/api/health
ss -lntH 'sport = :4000'
```

Initial fallback uses legacy liveness plus binding, not database readiness. Check authorized API reads separately. Preserve private rollback metadata and original artifacts; do not restore Neon or overwrite source/environment to fix an application failure. Vercel rollback, if needed, is separate and requires approval to reinstate a known production deployment; never promote the auth-disabled Preview as a production fallback.

## Security and reliability actions requiring approval

- **SSH ingress:** port 22 is currently open to any IPv4 source. Obtain trusted static source CIDRs and verify OCI serial-console/break-glass access. Keep the current session open, add a narrow allow rule, test a second independent session, and only then remove the broad SSH allowance and save rules. Review OCI security lists/NSGs as well as host rules; their console state was not available. Do not change default policies first or blindly run firewall-reset recipes.
- **IPv6/rpcbind:** no global IPv6 address exists now, but IPv6 INPUT/FORWARD are ACCEPT and rpcbind listens on IPv4/IPv6 111. IPv4 host rules block it externally. Before enabling IPv6, approve a mirrored policy preserving required ICMPv6/neighbor discovery and SSH access. Review whether rpcbind is needed before disabling its socket/service; no service was disabled here.
- **SSH policy:** password and keyboard-interactive authentication are off; public-key authentication is on. Root key login and X11 forwarding remain permitted. Draft changes should disable unnecessary root/X11 access only after confirming the ubuntu key and a second session; validate with `sshd -t` before an approved reload. SSH socket activation is in use; do not mistake a disabled `ssh.service` for no listening SSH.
- **Service isolation:** API runs as `ubuntu`, with NoNewPrivileges/PrivateTmp and restart-on-failure, but without a read-only filesystem sandbox. The reviewed `vogpk-api-hardening.conf` is optional and uninstalled. A dedicated runtime account and root-controlled immutable releases improve isolation but require permission/path testing and restart approval. Current application/deploy identity is not fully separated.
- **Caddy restart policy:** active/enabled, but `Restart=no` was observed. `caddy-reliability.conf` prepares restart-on-failure; installing/reloading service policy is approval-gated. Do not restart Caddy merely to test the template.
- **Backup automation/alerts:** manual encrypted backup and isolated recovery verification passed. Automatic backup/prune schedules and all alert credentials/timers remain pending approval. No IAM policy was changed during the restore drill.
- **External identity:** sslip.io is working for this development deployment. A domain under the business's control and a tested DNS/TLS transition should be planned before commercial launch without breaking existing origins/cookies.

## Vercel production checks and commercial launch

Storefront and admin `/login` return 200; anonymous dashboard returns 307 to `/login`; protected BFF and backend reads without a session return 401. A forged session with the correct internal bridge is rejected, a hostile Origin is rejected, malformed login input returns 400, and CORS does not allow an untrusted origin. The production CSRF cookie has Secure, HttpOnly, host-only `__Host-`, SameSite=Strict and no-store behavior; session-cookie attributes still require a real authenticated test. Admin HTTPS headers include HSTS, nosniff, no-store and noindex. The storefront is public and has HSTS; its nosniff header was absent and is a separate optional storefront hardening change.

The browser had no existing authenticated production session. No password was requested in chat, guessed, copied from local development, or reset. Full production login, dashboard refresh, session-cookie checks, logout/replay and multi-role access remain **PENDING**. Safe manual procedure:

1. Sign in privately at the production `/login` with the existing authorized account; verify dashboard, refresh and root/login redirects.
2. Inspect only cookie attributes, never copy values. Open allowed pages without submitting staff/product/order mutations.
3. Using an existing separately authorized limited-role account, verify a forbidden page/API yields 403 and permitted reads work. If none exists, request account-provisioning approval; do not alter the Owner to simulate another role.
4. Sign out of the test session; protected navigation and any approved in-memory replay test must be rejected. Reauthenticate personally if needed. Do not export browser state or session material.

Locally, all 25 real PostgreSQL security/RBAC checks passed using randomly generated accounts in a brand-new loopback test database. This includes expiry, disable, role change and logout invalidation, but is not a claim that production accounts were modified or tested in those states. Use `npm run test:security:fresh`; it refuses remote databases, does not reset any existing database, and does not persist generated credentials. The older resetting test runner must never be used against production.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to non-commercial personal use. The actual team's billing tier could not be verified through this connector. Confirm an appropriate commercial plan or approved alternative before revenue-generating launch; **do not upgrade automatically**. Also review account-specific usage/spending controls, preview isolation, access to deployments, database compute/storage/restore allowances and Oracle's existing free-resource limits. No paid plan was changed.

## Troubleshooting

| Symptom | Safe first checks |
| --- | --- |
| Public API unavailable | `systemctl is-active vogpk-api caddy`; local health; `ss -lnt 'sport = :4000'`; external HTTPS. No blind restart. |
| Ready=503 but live=200 | Database reachability, Neon state/limits, TLS policy and latency. Review logs privately; do not paste connection details. |
| Admin 503 or redirect loop | Verify origin/API/cookie configuration privately, API health and the actual deployed revision. Never use localhost as Vercel's backend. |
| Login 401 | Existing account status/session/password; do not bootstrap or reset Owner as a diagnostic. |
| API 403 | Distinguish Origin/CSRF failure from current role permissions. Do not grant broader roles to make a test pass. |
| Backup failure | Check client major version, private file permissions, approved repository and direct Neon service. A pending snapshot is not a valid recovery point. |
| Certificate warning | Caddy state, domain resolution, ingress 80/443, storage permissions and certificate lifetime. Never disable certificate verification or force repeated issuance blindly. |

## Production-readiness checklist

| Check | Status | Evidence / remaining action |
| --- | --- | --- |
| Baseline Oracle/local/GitHub comparison | PASS | Same Git revision; sole Oracle binding patch identified and preserved |
| Maintainable binding / readiness implementation | PASS locally / PENDING deployment | Unit, HTTP and build tests; no production restart |
| API/Caddy/persistence enabled and active | PASS | systemd read-only inspection |
| HTTPS, proxy and certificate | PASS | Valid hostname/chain; certificate expiry recorded |
| Public IPv4 ports 22/80/443 only | PASS for inspected policy/probes | 4000/111/2019 unreachable externally; OCI console rules not inspected |
| Active firewall equals saved rules | PASS | Compared rules ignoring counters/comments/blank lines; no reboot test |
| SSH limited to trusted sources | FAIL | Current 22 rule allows all IPv4; CIDRs and lockout-safe approval required |
| IPv6 policy ready for public IPv6 | FAIL | ACCEPT policy; no global IPv6 address currently |
| Environment / SSH key / TLS storage permissions | PASS for inspected paths | API 600; SSH 700/600; Caddy storage 700 |
| Service least privilege and crash recovery | PENDING HARDENING | API uses deploy account; Caddy Restart=no; templates not installed |
| Production database, migration, seeded RBAC | PASS | Read-only query; one applied migration; six roles / 27 permissions / one active Owner |
| API authorization, CORS, generic errors | PASS for safe probes | 401/403/400 and exact-origin behavior |
| Production authenticated session / multi-role journey | PENDING | No browser session or securely provisioned test credentials available |
| Production secrets in sampled journal/Git | PASS for sampled checks | No configured production secret matches; no values disclosed |
| Local security/build/operations tests | PASS | See sanitized verification JSON |
| Oracle ARM64 release preparation | PASS | Reviewed 8c75ca5 staged but not running; build/lint, 9 unit tests and 23 isolated ops tests passed in the earlier preparation phase |
| Systemd loaded/disk/process comparison and reload cause | PASS | Global registry stale flag proven; no API divergence; offline unit validation passed; no reload performed |
| Staged release/artifact recheck and operations tests | PASS | 50 tracked / 96 dist files match, environment parsing compatible; 23 ARM64 isolated operations tests |
| Live release/rollback drill | PENDING APPROVAL | Standalone daemon-reload/post-check, main merge and API restart/fallback require separate approval |
| OCI Mumbai eligibility / manual backup destination | PASS | Home region/free allowance verified; private Standard bucket and restricted exact-instance principal |
| Manual encrypted backup / full isolated recovery drill | PASS | Fresh OCI download, Windows decryption, 42 logical checks, offline page checksums and complete temporary-cluster cleanup |
| Automatic backup retention/prune/schedules | PENDING APPROVAL | No restic repository/service/timer or automated lifecycle rules activated |
| Email alerts / external uptime / TLS checks scheduled | PENDING APPROVAL | No account, credentials, recipient or timer activated |
| Commercial hosting eligibility | PENDING | Confirm actual Vercel plan; Hobby unsuitable for commercial launch |

The working production storefront and admin were preserved. The manual recovery gate is verified; production deployment, live rollback, monitoring and hardening remain separately approval-gated. No merge or production deployment was performed.
