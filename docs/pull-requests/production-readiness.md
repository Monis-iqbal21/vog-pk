<!-- Proposed title: Prepare VOGPK production rollout safeguards -->

The Oracle backend currently relies on an uncommitted loopback-binding change. This PR preserves that production behavior in configurable source, adds a bounded database readiness endpoint, and prepares a repeatable release/rollback process without overwriting the working checkout or environment.

Release preparation runs build/tests in a minimal environment before linking runtime configuration. Its type-aware lint explicitly selects source files and excludes generated code, so the ignored release-directory ancestor cannot silently remove lint coverage. Activation saves the exact prior managed systemd override (or its absence); failed-health and manual rollback restore that state. Unrelated overrides are refused. Existing deployment scripts do not migrate, seed, bootstrap an Owner or restore the database.

The PR also includes encrypted-backup, email-monitoring and service-hardening templates with approval guards, a non-resetting local security runner, and the production/preflight runbooks. Templates remain uninstalled and inactive. No storefront/admin source, authentication/RBAC logic, dependency lockfile or Prisma schema/migration is changed.

Validation:

- 23 operations tests passed on Windows and Oracle Ubuntu ARM64 using disposable mocked fixtures, including activation failure and exact rollback restoration.
- An actual exported backend passed build, source lint and nine unit tests without runtime configuration; existing local dependencies were used, without a new install.
- Bash syntax and all seven systemd unit templates passed validation; no unit was installed or started.
- Git history and reviewed source scans found no secrets; real environment files/generated artifacts and unrelated image/video files are excluded.
- App lint/build, backend unit/HTTP and 25 fresh-database RBAC checks passed on the original feature commit; application source is unchanged in the script-review follow-up. These are local results, not production session tests.
- Read-only Oracle comparison confirmed the original source patch, active services and unchanged API restart count/start timestamp.

Deployment gates:

- Obtain approval before publishing this branch, merging main or restarting production. Main merge may trigger existing Vercel production builds.
- Confirm the actual Neon plan/price/quota and create an approved pre-rollout recovery point before production deployment. None was created by this PR.
- Review the corrected branch HEAD; do not deploy the original 7fb9aeb script alone.
- Live activation/rollback, authenticated production session/RBAC journey, offsite backup and restore drill remain unverified/pending approval.
- SSH/firewall changes, Caddy policy changes, OCI storage, SMTP credentials and monitoring schedules remain outside activation of this release.

See `docs/ROLLOUT_PREFLIGHT.md` for exact changes, cost considerations and approval sequence, and `docs/PRODUCTION_DEPLOYMENT.md` for commands. Normal application rollback restores the previous service configuration/application; it does not rewind Neon data.
