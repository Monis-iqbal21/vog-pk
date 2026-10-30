# VOGPK rollout preflight

Reviewed on 2026-10-30 (Asia/Karachi). Feature branch: `codex/production-readiness`; target: `main`. Original reviewed commit: `7fb9aebeb591305b53334aeb0017152846c283fb`. This report covers that commit and the local follow-up corrections. No push, merge, production restart, SSH/firewall change or resource creation occurred.

## Commit scope and review verdict

The original commit contains 34 files: backend binding/readiness code and tests, a non-resetting local security runner, operation scripts/templates, ignore/line-ending rules and documentation. It changes no Prisma schema/migrations, dependency lockfile, storefront source, admin source or authentication/RBAC implementation. The two unrelated untracked user image/video assets remain outside the commit.

Gitleaks scanning found no secrets in the original commit/history or the reviewed final index. Environment examples contain placeholders only. Real environment files, SSH material, generated output, local database state and private backup/alert data remain excluded. Secret scanning is evidence about scanned material, not a guarantee against every secret format.

**Original-script finding 1:** preparation linked the production environment before dependency installation/build/tests. The follow-up defers that link until these steps pass and runs them with a minimal environment, removing accidental dotenv loading and inherited runtime values. A same-UID build is still trusted code able to access the operator's files; full hostile-code isolation would require separately approved build/runtime identities or external CI. Do not execute unreviewed commits or lockfile changes on the VM.

**Original-script finding 2:** rollback rebuilt an override based on the previous directory rather than restoring the prior configuration. The follow-up privately records the exact previous managed override or its absence. Both manual and failed-health rollback restore that state, then reload/restart. Unrelated overrides are refused. Saved rollback state and release artifacts must remain available.

**Original-script finding 3:** an actual credential-free backend build succeeded, but the original lint invocation failed with zero selected files because the release is below the ignored `.local` ancestor. The follow-up explicitly enumerates source/test TypeScript files, excludes generated Prisma code and invokes the already installed type-aware linter with ignore discovery disabled. It refuses an empty file list and uses offline execution to avoid an implicit tool download. Actual secret-free build, lint and nine unit tests subsequently passed.

Verdict: use the corrected branch HEAD for review and rollout; **do not deploy the original `7fb9aeb` script on its own**. Approval and recovery-point gates remain outstanding.

## Oracle comparison and preservation

Oracle's Git HEAD remains `3b65e51e652dce77b8971095bdc9bc167f3b2bf6`. The only tracked uncommitted change is:

```diff
- await app.listen(Number(process.env.PORT??4000));
+ await app.listen(Number(process.env.PORT??4000), '127.0.0.1');
```

The new helper defaults to that same address in production, and the planned release override explicitly fixes it. Local development retains an all-interface default; validated `HOST`/`PORT` remain configurable. The candidate is extracted into a separate release path, so no checkout/reset/stash/pull is needed over Oracle's working files. Preserve the old built artifacts as the initial rollback target. The original source, compiled code and environment are not overwritten by preparation.

During this preflight, `vogpk-api` and Caddy were active; health returned success. API restart count was zero and its active timestamp remained the previously observed value. No production authentication attempt, account modification or database write was used to review the scripts.

## Verification actually executed

- 23 isolated operations tests passed on Windows/Git Bash.
- The same 23 tests passed on Oracle Ubuntu ARM64 in a disposable fixture with service/network/install commands replaced by stubs.
- Bash syntax passed; seven systemd service/timer templates passed `systemd-analyze verify` on Oracle. No template was installed or activated.
- Original commit `7fb9aeb` records the earlier passing app lint/build checks, nine backend unit tests, three HTTP tests and 25 fresh-database security/RBAC checks. Application source has not changed in this follow-up; those are prior results, not newly claimed production tests.
- An exported copy of the backend passed a real build, explicit source lint and nine unit tests with a minimal environment and no runtime environment file. Existing reviewed local dependencies were linked for that check; it was not a new npm install or a real Oracle release build.
- Git history/tree secret scanning passed; original-commit review excluded unrelated files. New deployment fixtures test both success and failure paths without controlling real services.

Not executed: real ARM64 release build/install, production activation, live rollback drill, a production authenticated browser journey, backup creation or database restore. Prepare/activate must still be reviewed against real resource limits and current service configuration at execution time.

## Recovery point before deployment — PENDING APPROVAL

The preferred immediate checkpoint is a **manual Neon snapshot of the existing production branch**, after verifying the actual account plan, available snapshot slot, price and recovery permissions in the console. This preserves a point without changing the active connection or restoring/rewinding the database. Do not create a new project, replace an existing snapshot to free a slot, or enable a paid schedule. The [Neon snapshot overview](https://neon.com/blog/three-ways-to-use-your-snapshots) describes snapshot recovery into a separate branch.

After explicit resource/cost approval, the authorized operator should:

1. Verify the production project/branch privately; check its plan, snapshot quota, existing snapshots and PITR history. Do not share connection values or API keys.
2. Create one clearly named pre-rollout snapshot of that exact branch in Backup & Restore. Record the snapshot ID, creation time in UTC, source branch ID and candidate full commit SHA in a private operations record.
3. Wait for successful availability and confirm the documented restore path/permissions. A successful creation is not the same as a completed recovery drill. An isolated restore drill needs separate resource/cost approval.
4. Leave the working production branch and connection untouched. Do not proceed if the snapshot/recovery path cannot be verified. Do not rely on an assumed PITR window.

Snapshot creation and account quota inspection were not possible through a connected Neon management API here. The database URL does not authorize control-plane resource creation. No recovery point has been created by this preflight.

An independent encrypted PostgreSQL 18 `pg_dump`/restic recovery point is a useful additional option after the destination, tools, private access and retention costs are approved. The OCI destination remains unapproved; do not create a bucket or run a plaintext dump as a workaround. Restoring any checkpoint must target a separately approved isolated database/branch first. A normal application rollback for this schema-unchanged release must **not** restore or rewind production data.

## Exact production changes proposed

| Stage | Planned effects | Unchanged |
| --- | --- | --- |
| Feature branch publication / PR | Git objects and PR metadata; may trigger Vercel previews | Oracle services and database |
| Approved main merge | Main Git revision; possible existing storefront/admin production builds | No frontend/admin source, environment or auth changes in this PR |
| Release preparation | New `.local/releases/FULL_SHA/backend`, dependencies/generated build, private build log, runtime environment symlink after successful tests | Original checkout, environment contents, services, database |
| Approved activation | Private rollback metadata; owned `20-vogpk-release.conf`; service working directory/entry point, production/loopback policy, umask; daemon reload and API restart | Caddy, SSH, firewall, Owner, credentials, schema and data |
| Failed-health or approved manual rollback | Restore exact prior owned override/absence, daemon reload, restart previous API | No database restore, no original source overwrite |
| Backup/monitor/hardening templates | Remain uninstalled/inactive | No bucket, SMTP credential, timer or firewall activation |

Only prepare from a reviewed full SHA that exists in Oracle's fetched Git objects. Because schema and migrations are unchanged, no migration/seed/bootstrap command belongs in this release. Preparation refuses schema/migration differences. Runtime readiness adds a bounded public `SELECT 1` check; frequent external polling may consume Neon compute allowance. Cold-start latency and the three-second response bound can cause temporary 503 responses; observe rather than disabling TLS or broadening access.

## Rollback execution after approval

The prepared rollout commands are in [the production runbook](PRODUCTION_DEPLOYMENT.md). Use the corrected script from the approved branch HEAD/full deployment SHA. The manual command, only after explicit production restart approval, is:

```bash
cd /home/ubuntu/vog-pk
bash .local/operator-tools/deploy-backend.sh rollback --approved-restart
```

It uses the private saved override state; it does not reconstruct the old unit or rewind Neon. Confirm `vogpk-api` is active, loopback port 4000 is listening, local/public health works, and the existing admin/storefront remain accessible. The legacy initial application has no readiness route; its rollback uses liveness plus binding checks. Check current active release identity through the service working directory/release marker, not the unchanged original checkout's Git HEAD.

Activation may briefly interrupt admin API requests. Probe retries can consume roughly 150 seconds before automatic fallback, plus restart time. Live fallback is not proven until an approved drill; retain an operator and the original artifacts. If private rollback state is missing/corrupt or an unrelated override has appeared, stop and inspect; do not overwrite it, reset Git or restore the database as a shortcut.

## Cost assessment

No cloud resource was provisioned or plan upgraded. No new recurring resource has been activated. Exact account bills/remaining quotas are unavailable; normal checks/builds use existing infrastructure allowances.

- **Neon checkpoint:** [published plan documentation](https://neon.com/docs/introduction/plans) lists one manual snapshot on Free and more on paid plans, with snapshot storage pricing of $0.09/GB-month and manual snapshots billed as full snapshots. Verify the actual plan and console estimate before creation; do not promise the checkpoint is free. A conditional paid-storage estimate is snapshot GB × $0.09/month; restore compute/branch usage is additional when applicable.
- **Existing PITR:** verify the actual enabled window; it is not an assumed durable pre-rollout checkpoint.
- **Application rollout:** no new VM or service subscription; release copies/dependency installs consume existing VM disk/CPU/network. Git pushes/merges may use Vercel preview/production build allowance. Account-specific overage behavior remains to be checked.
- **OCI encrypted backup:** remains PENDING APPROVAL. Mumbai/free-tier eligibility, account usage, storage/request/egress/prune headroom and credentials must be confirmed before selecting it.
- **Monitoring/email:** remain inactive. No account, recipient or credentials have been created. Do not enable schedules or purchase a plan as part of the initial rollout.

## Pull request preparation and approval sequence

The PR title/body are prepared in `docs/pull-requests/production-readiness.md`. Remote inspection found `main` at the baseline revision and no `codex/production-readiness` branch. Therefore **no GitHub PR has been published** and no PR URL/number is claimed.

After approval to push this feature branch only:

```powershell
git push --set-upstream origin codex/production-readiness
```

Then create a draft PR in GitHub with base `main` and compare `codex/production-readiness`, using the prepared body. If GitHub CLI is already installed/authenticated, the equivalent is:

```powershell
gh pr create --draft --base main --head codex/production-readiness --title "Prepare VOGPK production rollout safeguards" --body-file docs/pull-requests/production-readiness.md
```

The GitHub CLI is not currently installed here; no tool or account was installed to bypass that. A branch push may trigger Vercel previews. Admin variables currently target production; an unconfigured preview can fail closed. Do not copy production secrets into previews to obtain a green build. PR review can proceed without deploying a preview, or an isolated preview environment can be separately approved.

Separate approvals are still required for main merge, checkpoint resource/cost creation, API restart/fallback, any SSH/firewall change, and backup/alert activation. Current rollout status: **HOLD pending approvals and a verified recovery point**.
