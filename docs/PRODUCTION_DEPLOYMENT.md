# VOGPK production deployment and readiness

Evidence collected **2026-10-30, Asia/Karachi**. PASS means actually observed or tested; PENDING identifies an unexecuted step or an access/approval gap. Local changes described here have not been installed on Oracle. No production restart, reboot, firewall change, credential change, account reset, database reset or paid resource creation was performed.

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

## Encrypted Neon backups — PENDING APPROVAL

The preferred destination is a **private, dedicated OCI Object Storage Standard bucket in Mumbai**, if the tenancy's actual Always Free entitlement, home region, remaining quota and request budget permit it. The VM is in Mumbai; that alone does not establish the tenancy's home region or bucket eligibility. No OCI storage credentials/CLI/account billing access were available for verification.

Oracle's [Always Free documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) currently lists 20 GB combined storage for Always Free-only accounts and 50,000 requests/month; paid/trial Standard allocations differ. Verify the account-specific allowance, existing usage, retention footprint and temporary prune headroom before approval. Do not enable paid capacity, archive transitions, replication or versioning without evaluating costs. Keep a conservative capacity/request warning threshold and stop before exceeding the approved allowance; this implementation cannot enforce OCI account-wide quotas. Always Free VM reclamation is also a continuity risk; retain recovery assets off the VM.

`postgres-backup.sh` streams `pg_dump` custom format directly into **restic's encrypted remote repository**. No plaintext dump is written to disk. The repository and a dedicated backup identity must be approved first. The storage credentials and encryption password are separate, private and never passed in process arguments. Use [OCI S3 compatibility](https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm), limited bucket permissions and HTTPS. Restic also encrypts before upload, independently of OCI server-side encryption.

Preparation after storage/credential approval:

1. Confirm a dedicated private bucket and least-privilege access to that bucket; no public access or pre-authenticated public URL. Choose the actual namespace/bucket in the console. A restic repository uses the OCI S3-compatible HTTPS endpoint with the namespace, `ap-mumbai-1`, bucket and a dedicated prefix. Verify endpoint/region settings against OCI's current API documentation rather than guessing account identifiers.
2. Privately configure `ops/backup.env.example` as `/etc/vogpk/backup.env` (root 600). Create the unprivileged `vogpk-backup` service account. Store the three referenced private files under `/etc/vogpk/backup`, readable only by that account, with modes 600/400 and restricted parent traversal.
3. Configure a direct, non-pooler Neon host in the service file, `sslmode=verify-full`, and an approved read-only backup database identity able to dump all application tables/sequences. Do not reuse an Owner login or change the existing application credentials. Provisioning new credentials requires approval.
4. Put the database password in the private libpq password file, not `DATABASE_URL`/`PGPASSWORD` or arguments. Use [libpq service files](https://www.postgresql.org/docs/current/libpq-pgservice.html) and the reviewed sample service names. Confirm PostgreSQL client major version 18 or a reviewed compatible newer client.
5. Generate a strong repository encryption password privately; escrow a recovery copy in an approved password manager/offline location independent of the VM and bucket. Do not put the only key in the backup or on the VM.
6. Once approved, initialize the repository **once** under the backup account using the protected environment (`restic init`). Do not source unreviewed shell snippets or print credentials. Never run init on an existing repository to "fix" an access error.
7. Set the destination/dedicated approval flags privately, run one manually approved backup, check `restic snapshots --host vogpk-oracle --tag vogpk-postgres-complete`, and complete a separate-database restore drill. Enable the timer only after those succeed.

Retention: seven daily, four weekly and six monthly recovery points, scoped to the dedicated host and complete-snapshot tag. A failed producer/upload remains pending and is never promoted to a valid recovery point. Pending snapshots need operator review/removal after the failure is understood. Restic `forget` removes snapshot references; bytes remain until prune. With separate pruning approval, the script runs check/prune/check on Sundays. This may consume requests, temporary storage and Neon/network allowance; do not enable it until capacity is reviewed. Without prune, storage use can grow despite snapshot retention. A compromised VM with write/delete storage credentials can delete backups; immutable/offline protection is a separate design/approval, not a property claimed here. See [restic streaming backup](https://restic.readthedocs.io/en/stable/040_backup.html) and [retention/pruning](https://restic.readthedocs.io/en/stable/060_forget.html).

After the manual backup and restore drill are approved and pass:

```bash
sudo systemctl start vogpk-backup.service
sudo systemctl enable --now vogpk-backup.timer
```

These commands were not executed. PostgreSQL client tools, restic and the destination are not installed/configured on Oracle. **Backup storage, credentials, first backup, restore drill and schedule: PENDING APPROVAL.**

### Recovery without overwriting production

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

Neon also provides [point-in-time restore](https://neon.com/docs/postgres/backup-restore/branch-restore). Its [current plan documentation](https://neon.com/docs/introduction/plans) describes limited Free restore history and longer paid windows; the actual project's plan, configured history and snapshot allowance were not accessible here. Check the console instead of assuming the default window. Do not restore the production root branch in place during a test. Provider history is complementary to an independent encrypted backup, not evidence that the offsite strategy is operational.

## Security and reliability actions requiring approval

- **SSH ingress:** port 22 is currently open to any IPv4 source. Obtain trusted static source CIDRs and verify OCI serial-console/break-glass access. Keep the current session open, add a narrow allow rule, test a second independent session, and only then remove the broad SSH allowance and save rules. Review OCI security lists/NSGs as well as host rules; their console state was not available. Do not change default policies first or blindly run firewall-reset recipes.
- **IPv6/rpcbind:** no global IPv6 address exists now, but IPv6 INPUT/FORWARD are ACCEPT and rpcbind listens on IPv4/IPv6 111. IPv4 host rules block it externally. Before enabling IPv6, approve a mirrored policy preserving required ICMPv6/neighbor discovery and SSH access. Review whether rpcbind is needed before disabling its socket/service; no service was disabled here.
- **SSH policy:** password and keyboard-interactive authentication are off; public-key authentication is on. Root key login and X11 forwarding remain permitted. Draft changes should disable unnecessary root/X11 access only after confirming the ubuntu key and a second session; validate with `sshd -t` before an approved reload. SSH socket activation is in use; do not mistake a disabled `ssh.service` for no listening SSH.
- **Service isolation:** API runs as `ubuntu`, with NoNewPrivileges/PrivateTmp and restart-on-failure, but without a read-only filesystem sandbox. The reviewed `vogpk-api-hardening.conf` is optional and uninstalled. A dedicated runtime account and root-controlled immutable releases improve isolation but require permission/path testing and restart approval. Current application/deploy identity is not fully separated.
- **Caddy restart policy:** active/enabled, but `Restart=no` was observed. `caddy-reliability.conf` prepares restart-on-failure; installing/reloading service policy is approval-gated. Do not restart Caddy merely to test the template.
- **Backups/alerts:** explicitly pending; no credentials or timers were activated.
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
| Live release/rollback drill | PENDING APPROVAL | Requires approved commit push and production restart |
| OCI Mumbai eligibility / backup destination | PENDING APPROVAL | Home-region/remaining quota/account verification needed |
| Encrypted backup / retention / recovery drill | PENDING APPROVAL | Scripts/templates prepared; no offsite backup executed |
| Email alerts / external uptime / TLS checks scheduled | PENDING APPROVAL | No account, credentials, recipient or timer activated |
| Commercial hosting eligibility | PENDING | Confirm actual Vercel plan; Hobby unsuitable for commercial launch |

The working production storefront and admin were preserved. The backup, monitoring, release and hardening preparations are reviewable; they are not a declaration that production readiness is complete.
