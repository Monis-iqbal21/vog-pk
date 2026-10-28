# Real development admin authentication and RBAC verification

## Result

**The remaining local authenticated verification is complete.** The real admin application at `http://localhost:3001` used its existing approved API URL, `http://127.0.0.1:4000`, and the normal local PostgreSQL development database. There was no API_URL override, no mock authentication, no hardcoded password, and no weakening of session or permission guards. Both environment files were compared before/after the browser run and remained unchanged.

The authentication foundation is ready for the next local development phase. This is not a claim that hosted HTTPS/Netlify deployment or MFA has been verified or implemented.

No application URL, login design, authentication service, RBAC policy or storefront functionality was changed for this verification task. No push or deployment was performed.

## Real accounts and credential handling

The development database initially had zero accounts. One development verification owner was created using the existing owner-bootstrap service; five limited-role accounts were then provisioned through the real authenticated staff API. Passwords use cryptographically random values, are validated by the existing policy, and are stored in PostgreSQL only as Argon2id hashes. No public registration or default password was added.

Development verification credentials are protected with **Windows current-user DPAPI** in the Git-ignored `backend/.local/development-auth-verification.dpapi`. They were never printed, embedded in reports, sent as command-line arguments, stored in browser localStorage or committed. The vault can only be read by the appropriate Windows user context. Browser test code obtains the credential in memory and submits the actual login form.

The initial vault helper encountered a Windows PowerShell module-loading failure after the fresh verification owner had been created. The helper was corrected to use .NET DPAPI directly and now probes encryption/decryption before provisioning. This session's sole, freshly created verification owner was recovered through the trusted operator password-reset path and audited; no unrelated/existing owner was overwritten. Temporary recovery logic was removed from the final provisioning script. A missing vault alongside an existing owner now causes provisioning to refuse changes.

After successful verification:

- All five limited-role verification accounts are disabled, with their original roles restored.
- All sessions belonging to the six verification principals are revoked.
- The last development owner remains active, preserving the ownership safeguard. It is a verification-only principal with no shared/default credential; use the existing trusted operator recovery workflow if development owner access is later needed.
- Audit records for provisioning, access changes, authentication and verification are retained. No real pre-existing staff account was modified.

Observed cleanup: six verification accounts, one active owner, five disabled limited-role accounts, **zero active verification sessions**.

## Tests actually passed through the normal development application

`admin/scripts/verify-development-auth.cjs` performed **23 successful checks** using the real browser → Next.js BFF → NestJS → PostgreSQL path:

1. Anonymous root and restricted page requests redirect to login; the protected destination is preserved.
2. The real login form rejects an incorrect password with generic feedback.
3. The securely provisioned development owner authenticates and reaches `/dashboard`.
4. Dashboard refresh retains the valid session; authenticated `/` and `/login` return to dashboard.
5. The local session cookie is HttpOnly, SameSite=Strict, host-only and inaccessible to document.cookie; no session token appears in markup or localStorage.
6. The owner opens all eleven protected admin modules.
7. Unauthenticated direct API calls, missing user sessions and forged tokens return 401.
8. Missing-CSRF and hostile-Origin requests are rejected.
9. STORE_MANAGER is restricted by sidebar, page and direct backend/BFF permissions.
10. CATALOG_MANAGER is restricted by the same server-enforced checks.
11. ORDER_MANAGER cannot open Products or gain product mutation/staff permissions.
12. MARKETING_MANAGER cannot access staff administration or elevate roles.
13. VIEWER has only assigned read permissions and cannot mutate staff or elevate privileges.
14. The owner cannot change its own permission assignment.
15. Logout revokes the database session; replay of the old credential returns 401 and the dashboard requires login.
16. A permitted protected destination is restored after successful real login.
17. An external `returnTo` cannot redirect a successful real login off the admin origin.
18. An actually expired absolute session redirects back to login with a safe return path.
19. An idle-expired session is rejected by both the API and protected page.
20. An owner-disabled account immediately loses its session and cannot sign in again.
21. A role change revokes existing sessions; a fresh login uses the current database permissions rather than stale claims.
22. The customer storefront homepage remains publicly accessible; no staff-login route was introduced under frontend `/admin/login`.
23. Approved admin/backend environment files remain unchanged.

Expiration tests changed timestamps only on sessions owned by the dedicated verification principals; no token was forged and no authentication check was bypassed. Disable and role changes used the authenticated staff endpoint and its normal CSRF/permission controls. Test cleanup was limited to the recorded verification identities.

There were zero browser runtime errors. No credentials, authentication tokens, session cookie values or database connection secrets appear in the verification output.

Machine-readable results: `admin/docs/live-auth-verification.json`.

## Automated checks and builds actually passed

| Check | Result |
|---|---|
| Admin routing/configuration unit suite | 19 checks passed |
| Admin ESLint | Passed |
| Admin production build and URL/cookie preflight | Passed |
| Backend type-aware lint | Passed |
| Prisma schema validation | Passed |
| Existing backend unit test | One test passed |
| Existing backend HTTP health integration test | One test passed |
| Backend Prisma generation/Nest production build | Passed through `npm run test:security` |
| Existing standalone PostgreSQL/HTTP security suite | 25 checks passed |

The **23 authenticated browser checks** used the unchanged normal development API/database. Separately, the existing **25-check backend regression suite** used its documented, explicitly named test database with a `_test` suffix, and no admin environment override. The development API was stopped only while that standalone suite owned its default port and then restarted using the documented `npm run start:dev`. The standalone suite did not reset or replace the development database.

That additional suite confirmed idempotent seeds, one-time/concurrent bootstrap, hash storage, generic login failures, 401/403 boundaries, role unions, live permission changes, disabled/expired/idle/revoked sessions, rate limits, last-owner protection, safe audit events and cache/robots headers. Evidence remains in `backend/docs/security-verification.json` and `admin/docs/routing-unit-verification.json`.

## Repeating safely

Keep the configured local PostgreSQL running. Start applications from their own directories:

```powershell
# backend
npm run start:dev
# admin, in another terminal
npm run dev
```

Use the existing `.env.local` values. **Do not set or override API_URL for this procedure.** The verification provisioner checks for the documented loopback API port and a development database suffix. It will not overwrite an existing unrecognized owner, truncate the development database, or use a production database.

From backend, after a successful build and with the approved API running:

```powershell
npm run verify:dev:provision
```

This reads the existing Windows-user DPAPI vault when available, safely re-enables only those known limited verification principals, or provisions a first verification owner only when no owner exists. If a genuine owner already exists and no verification vault is available, stop and use the owner's authorized account-provisioning process; do not reset or replace that owner.

From admin:

```powershell
npm run test:auth:development
```

Playwright/Edge must be available. The supplied environment used `PLAYWRIGHT_MODULE` to select the existing bundled Playwright installation; that is a tool-module path, not an API/authentication configuration override. The script never prints secrets. After the run, review only its sanitized report and cleanup status. Repeated login testing is subject to the real rate limits; wait for the documented window if necessary instead of clearing production/development throttles to force a pass.

New verification/support files:

- `backend/scripts/development-verification-vault.mjs`: current-user DPAPI encryption/decryption and preflight probe.
- `backend/scripts/provision-development-verification.mjs`: guarded real account provisioning through the existing bootstrap/staff services.
- `admin/scripts/verify-development-auth.cjs`: actual browser, BFF, backend and session/permission verification, with sanitized errors and cleanup.
- Corresponding npm script entries and this report. Production authentication/routing code was not rewritten.

## Unverified and remaining work

**No required local authentication/RBAC check remains blocked or unverified.** The previous API_URL-override approval blocker was avoided by following the user's approved normal-development procedure; no rejected override was retried or bypassed.

The following remain outside this local verification:

- Deployed Netlify/remote backend behavior, actual custom DNS, HTTPS certificate configuration and remote Secure-cookie behavior. Local HTTP intentionally uses the development cookie; hosted HTTPS must use Secure `__Host-` cookies.
- MFA, invitation/first-password-change onboarding, production monitoring, capacity/rate-limit operation, backup/restore and deployment-specific hardening described in Phase 1. MFA is not implemented.
- Business operations in placeholder product/order/marketing modules; those do not become working editors because authentication passed.

The smallest later hosted smoke test is: open the actual assigned HTTPS admin `/login`, authenticate with an authorized hosted account, refresh dashboard, inspect cookie flags without copying values, confirm an unauthorized role receives 403, sign out and confirm replay/protected access fails, then open the public storefront separately. This requires an explicitly authorized hosted environment and was not simulated here.

The foundation is ready to proceed with the next development modules while retaining the existing backend guards and server-side checks.

## Operational owner setup and commit audit

The original development verification owner was subsequently converted, with the user's authorization, to an operational local owner using a private password file. Its Argon2id hash was verified and previous sessions revoked. No password, hash, account export or vault data belongs in Git. The original verification vault is intentionally stale and must not be used to overwrite the operational account or store its password.

The subsequent commit audit passed ten real browser/BFF checks with the operational account: login, dashboard refresh, authenticated redirects, cookie attributes, all eleven owner modules, direct unauthorized API rejection, CSRF rejection, logout/replay and post-logout protection, public storefront and runtime-error checks. See `admin/docs/commit-auth-verification.json`. Only sanitized results were saved. All 25 backend security/RBAC checks also passed in a newly created isolated local test database; no existing database was reset. The old 23-check fixture result above remains historical evidence, not a claim that its stale credentials were rerun.
