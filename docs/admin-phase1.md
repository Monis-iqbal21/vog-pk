# VOGPK administration foundation — Phase 1

## Delivered boundary

`admin/` is an independent Next.js 16.4.3 / React application using JavaScript/JSX, Tailwind, Lucide, Inter and centralized VOGPK light-theme tokens. NestJS 12 remains the TypeScript API. Prisma 7.10.1 uses the `prisma-client` ESM generator and PostgreSQL driver adapter. No workspace framework, storefront rewrite, product management, commerce API, payment handling or new catalogue records were added.

The existing pending storefront listing work is preserved. The customer app has no dependency on admin session verification or admin UI. No GitHub push, deployment, Vercel project creation or DNS changes were performed.

## Local startup

Requirements: Node 24.15+ and npm; a dedicated PostgreSQL database. Normal production PostgreSQL hosting is independent of Node. An optional project-local PostgreSQL binary wrapper is included as a dev dependency for machines without Docker/PostgreSQL; it is not production database hosting.

Applications:

| Application | Local address | Root |
|---|---|---|
| Customer storefront | `http://localhost:3000` | `frontend` |
| Administration | `http://localhost:3001` | `admin` |
| NestJS | `http://localhost:4000/api/health` | `backend` |
| Optional local PostgreSQL | `127.0.0.1:5433` | `backend/.local/postgres` |

Install each application's dependencies with `npm ci`. Existing storefront commands are unchanged.

For a fresh local setup, from `backend`:

```powershell
npm ci
npm run env:local
npm run db:local
```

`env:local` creates **random** matching BFF secrets and a random local database password in ignored `backend/.env.local` and `admin/.env.local`. It refuses to overwrite existing files and prints no secret. This helper does not create an account or choose an owner password. If files already exist, edit them locally instead of rerunning the helper. Placeholder-only `.env.example` files document manual setup.

Keep the local database command running. It binds only to loopback, uses SCRAM-SHA-256 and creates `vog_admin_dev` and `vog_admin_test` if absent. No global Windows service or system user is installed. Its wrapper is a development utility; use managed or normally operated PostgreSQL for production.

In another backend terminal:

```powershell
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed
npm run start:dev
```

The migration is `prisma/migrations/202610290001_admin_security/migration.sql`; it is additive and was generated before applying to the newly created local database. No pre-existing migration was overwritten. `db:migrate` uses `prisma migrate deploy`. Configure an empty dedicated database or review migrations before pointing this at an existing environment.

From `admin`:

```powershell
npm ci
npm run dev
```

The customer storefront `/` is public at its own origin. On the separate admin hostname, `/` now redirects to `/login` when logged out and `/dashboard` when authenticated, as specified by the latest routing brief. Protected module visits preserve a validated internal destination in `returnTo`; normal login and authenticated `/login` visits go to `/dashboard`. Account/session verification happens server-side. Protected page data is fetched only after the required permission has been checked. See [the current routing and Netlify guide](admin-routing-netlify.md).

For built local apps, use `npm run build` then `npm start` in admin, and `npm run build` then `npm run start:prod` in backend. Local loopback testing may use HTTP; remote production origins must use HTTPS. The backend build script generates Prisma before Nest compilation.

## Provision the first owner securely

There is no default owner, password or public registration route. Run the owner bootstrap from a trusted backend operator terminal after migrations. Avoid literal passwords in shell history or pasted command lines. PowerShell example:

```powershell
$env:OWNER_NAME = Read-Host 'Owner name'
$env:OWNER_EMAIL = Read-Host 'Owner email'
$ownerSecureInput = Read-Host 'Owner password' -AsSecureString
$env:OWNER_PASSWORD = [System.Net.NetworkCredential]::new('', $ownerSecureInput).Password
try { npm run owner:bootstrap }
finally {
  Remove-Item Env:OWNER_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable ownerSecureInput -ErrorAction SilentlyContinue
}
```

Passwords must have 16–128 characters including upper/lower case, a number and a symbol. Common password patterns are rejected. Credentials are validated, hashed with Argon2id and never logged. Bootstrap obtains the same PostgreSQL transaction advisory lock as staff access changes and refuses to create another owner if **any** owner assignment already exists. Repeated attempts do not overwrite accounts or hashes. Concurrent bootstrap attempts create at most one initial owner. An existing non-owner with the requested email is not silently elevated.

At initial Phase 1 setup, the development database was migrated and seeded with roles only. The later user-authorized real development verification provisioned dedicated development accounts; their encrypted credential handling and post-test state are documented in [the live authentication report](admin-auth-verification.md). Separate standalone security-suite accounts still belong only to `vog_admin_test`. No hardcoded/default password or public account registration exists.

No email password recovery or invitation flow is claimed. For owner-assisted recovery, a trusted database operator can set `RECOVERY_EMAIL` and a strong `RECOVERY_PASSWORD` via a secure prompt, then run `npm run owner:recover`. This changes only the chosen password, revokes that user's sessions and records `password.operator_recovery`; it does not enable disabled accounts. Clear the environment password immediately afterward. The account-creation UI lets authorized owners choose an initial strong password; share it only through an approved secure channel, never plaintext email. Self-service password changes/forced first-login changes are future work.

## Database models

| Model | Purpose and constraints |
|---|---|
| AdminUser | UUID, normalized unique email, name, Argon2id password hash, active flag, created/updated/last-login timestamps |
| Role | Unique code, display name, description and system-role flag |
| Permission | Unique granular code and description |
| AdminUserRole | Composite unique user/role assignment; supports multiple roles |
| RolePermission | Composite unique role/permission assignment |
| AdminSession | Unique SHA-256 digest; user foreign key; creation, absolute expiry, activity and revocation timestamps; user and expiry indexes |
| AuditLog | Nullable actor, action, resource and optional target ID, timestamp, safe JSON metadata; actor/date indexes |
| LoginThrottle | Hashed network/account bucket key, atomic attempt count and expiry index; shared across API instances |

Passwords and raw session tokens are never stored in these records. User/role assignment foreign keys prevent orphan records; role deletion is restricted while assigned. There is no account deletion endpoint. The last-active-owner invariant is checked inside the locked access-change transaction for disable and ownership-removal actions. All application access mutations use that service. Direct DBA changes are privileged operational actions, not protected by application code.

## Roles and permissions

Twenty-seven default permissions are defined in `backend/src/security/roles.ts`:

```text
dashboard.view
products.view products.create products.update products.publish products.archive
categories.view categories.manage
variants.view variants.manage
media.view media.manage
inventory.view inventory.manage
homepage.view homepage.manage
coupons.view coupons.manage
orders.view orders.manage
settings.view settings.manage
staff.view staff.manage
roles.view roles.manage
audit.view
```

| Role | Default access |
|---|---|
| SUPER_ADMIN | All 27 permissions; displayed as Owner / Super Admin |
| STORE_MANAGER | Catalogue, inventory, orders, media, homepage and coupons; settings read only; no staff, roles or audit access |
| CATALOG_MANAGER | Dashboard, products, categories, variants and media; no staff, security, orders or refunds |
| ORDER_MANAGER | Dashboard, order viewing and fulfilment management; no product/payment/refund permissions |
| MARKETING_MANAGER | Dashboard, homepage, coupons and media; no staff, inventory or payment permissions |
| VIEWER | Read-only dashboard/catalogue/inventory/homepage/coupons/orders/media; no mutations, staff or security administration |

Mappings are persisted through role-permission records and seeded idempotently. Enforcement uses permission codes, not role-name checks scattered through UI/API handlers. The role code is used specifically to preserve the ownership invariant and bootstrap identity. There is no wildcard bypass. Permissions are loaded from the database for every authenticated request, with no JWT claims or client permission cache trusted for authorization.

Backend `@RequirePermissions(...)` is enforced by a global Nest guard. `@SessionOnly()` explicitly marks authenticated identity/logout endpoints; missing authorization metadata denies access by default. Public health is explicitly marked. The only public authentication action still requires the confidential BFF bridge key. Missing/invalid credentials return 401; authenticated insufficient permissions return 403. No unauthenticated privileged endpoint was added.

Creating staff or changing access requires both `staff.manage` and `roles.manage`. The service rechecks the current actor inside the transaction, accepts existing predefined roles only, and prevents granting permissions the actor does not hold. Users cannot modify their own roles or enabled state. Access changes revoke every active session of the affected account. Custom roles are supported by the schema but no custom-role editor or API mutation was introduced.

## Session and BFF security

Flow: browser → same-origin Next route → authenticated server-to-server Nest request → PostgreSQL session/permissions → safe response. Browser JavaScript receives user display data and permissions for UI only, never a bearer credential, database URL or BFF secret.

- Login generates 32 cryptographically random bytes (256 bits) encoded as an opaque token. Only its SHA-256 hash is stored in `AdminSession`. Login always creates a new token rather than adopting an existing browser credential.
- The BFF stores the raw token in an **HttpOnly, host-only, SameSite=Strict** cookie at `/`. It has no Domain attribute. On HTTPS it is Secure and named `__Host-vog_admin_session`; a separately named dev cookie is allowed only on loopback HTTP. The cookie expires at the backend's absolute expiry.
- Absolute timeout defaults to eight hours; idle timeout defaults to 30 minutes. Idle values are bounded to at most 120 minutes and absolute values to at most 24 hours. Nest checks active status, revocation, absolute expiry and idle expiry, then conditionally refreshes activity. Invalid/expired sessions are not accepted just because a cookie exists.
- Logout updates the database revocation timestamp before the BFF clears the cookie. Failed backend logout does not report a fake success. Replaying the old token fails. Disabled users cannot log in; sessions also fail if an operator disables the user directly in the database.
- State-changing BFF methods require an exact configured Origin, non-cross-site Fetch Metadata, JSON content type and a matching random CSRF token supplied in a header and an HttpOnly host-only CSRF cookie. The CSRF challenge is same-origin and no-store. This includes login and logout, protecting login CSRF as well as authenticated mutations. Missing/mismatched tokens or hostile origins return 403. The BFF is a method/path allowlist, not an arbitrary backend proxy, and caps incoming JSON to 16 KiB.
- Nest accepts admin traffic only with the server-only BFF key and validates the opaque session/current permissions separately. A bridge key alone grants no user authorization. Origin is checked when supplied. The API does not use browser cookies; server-to-server bearer requests therefore do not rely on browser CSRF controls. CORS lists exact configured storefront/admin origins, with credentials disabled; there is no wildcard origin.
- Login uses PostgreSQL atomic throttle buckets: 40 attempts per network and ten per normalized email per fixed 15-minute bucket. Network buckets are checked first. All successes/failures count. Limits persist across API processes. Wrong email, disabled user and wrong password use the same failure message and Argon2 verification path. Unknown users use a lazily generated dummy Argon2id hash. Rate-limited requests return 429 and Retry-After.
- In trusted-proxy mode, the admin derives the client network identifier only from proxy-replaced headers; otherwise all local attempts share a local network bucket. Do not enable `TRUST_PROXY_HEADERS=1` on an untrusted direct server or a proxy that preserves attacker-supplied headers. Configure edge/proxy request limits as well before production.
- Auth responses/pages are no-store/noindex, with noindex metadata, robots.txt disallow, X-Robots-Tag and anti-framing/nosniff/referrer headers. Noindex is supplementary; every protected server route independently requires authorization.
- Session invalidation during an API mutation clears the BFF cookie and redirects the mounted admin shell to login. Page navigation also verifies the session on the server. Roles and protected data are never fetched just because a client cookie/name exists.

Cookie isolation is by **hostname, not TCP port**. For the specified localhost ports, development cookies are scoped to localhost and browsers may also send them to localhost:3000; the storefront neither uses nor verifies them. For strict local hostname separation use `admin.localhost` with local HTTPS, or distinct loopback hostnames (and update configured origins). Production `admin.<domain>` host-only `__Host-` cookies are not sent to `www.<domain>` or `api.<domain>`. Never configure a parent-domain cookie.

## Admin screens and API

Public admin UI: `/login`. Admin `/` chooses login/dashboard using a server-verified session; the storefront remains independent. Protected routes:

```text
/dashboard /products /categories /variants /media /homepage
/coupons /orders /settings /staff /audit-logs
```

All share the permission-aware admin shell. Dashboard shows the authenticated name, roles, permitted quick links and an unavailable metrics state; there are no fake sales/orders. Header provides the page title and an account menu with identity, role display and logout. Desktop sidebar collapses to icons; mobile uses an accessible native dialog with focus containment, Escape/outside dismissal, scroll lock and close-on-navigation. Unauthorized modules show Access Denied before protected data loading.

Staff shows up to 200 admin accounts, roles and status, with owner-authorized creation/access changes. It has no fake email invitations or password delivery. Audit shows the latest 100 security events. Full pagination for larger staff/audit datasets is future work. Other modules explicitly state that operational features are not implemented. There are no product, coupon, order or payment mutation APIs in this milestone.

Nest routes (under `/api/admin`):

| Method/path | Policy |
|---|---|
| POST `auth/login` | BFF key, validation, rate limit; returns credential only to the BFF |
| GET `auth/me` | Valid session; safe current identity/permissions |
| POST `auth/logout` | Valid session; revocation |
| GET `roles`, GET `permissions` | `roles.view` |
| GET `staff` | `staff.view` |
| POST `staff` | `staff.manage` AND `roles.manage` |
| PATCH `staff/:id` | Same permissions plus self/last-owner/escalation safeguards |
| GET `audit-logs` | `audit.view` |

The admin's same-origin `/api/admin/...` forwards only these allowed paths/methods; the browser has no access to the secret bridge credential. `/api/auth/csrf` supplies only the CSRF challenge. No register, public invitation, token inspection or password-recovery endpoint exists.

## Environment and deployment preparation

Backend server settings: `DATABASE_URL`, `ADMIN_ORIGIN`, `STOREFRONT_ORIGIN`, `BFF_SHARED_SECRET`, `PORT`; optional timeout settings are in `.env.example`. Local helper additionally needs `LOCAL_POSTGRES_PASSWORD`, and security tests need a distinct `TEST_DATABASE_URL`.

Admin server settings: `ADMIN_ENVIRONMENT`, `ADMIN_ORIGIN`, `STOREFRONT_ORIGIN` (the separate public store origin), `API_URL` (origin only, without `/api`), matching `BFF_SHARED_SECRET`, `COOKIE_SECURE`, optional trusted proxy mode. No private values use `NEXT_PUBLIC_`. Hosted builds validate mandatory HTTPS origins and reject localhost defaults or insecure cookies.

Deployment plan, not executed:

1. Current plan: create a separate Netlify project with Base/Package directory `admin`, Next.js framework, `npm run build`, publish `.next`; keep the customer Vercel project root `frontend`. See the current [Netlify setup guide](admin-routing-netlify.md). Vercel remains an alternative hosting option, not a required dependency.
2. Deploy NestJS `backend` to a suitable Node service with database access. Use managed PostgreSQL with TLS, restricted credentials, backups and restore tests. Generate Prisma during build and run reviewed `prisma migrate deploy` as a controlled release step. Run the idempotent role seed before first provisioning.
3. Set the intended exact HTTPS origins through environment settings. For example, an eventual store domain may use `https://www.vog.com.pk`, `https://admin.vog.com.pk` and `https://api.vog.com.pk`, or equivalent subdomains of the final registered domain. No production domain is embedded in business logic.
4. Set `COOKIE_SECURE=true` and HTTPS admin/API origins. Store the random matching bridge secret only in backend/admin secret stores. Use isolated preview credentials/databases; don't point a public preview at production staff data. Origin validation intentionally rejects a hostname not configured as ADMIN_ORIGIN.
5. Add the admin subdomain to its hosting project when DNS ownership/TLS is ready. Do not share the session cookie with the customer domain; preserve the `__Host-` prefix, `/` path and no Domain attribute. Configure proxy header replacement and exact CORS origins.
6. Provision the real owner from a trusted backend operator terminal. No credentials belong in build logs, URLs or source control.

## Verification

Verified locally with real PostgreSQL and real browser-to-BFF-to-Nest requests:

- Prisma schema validation, client generation and migration deployment against the new dedicated dev database passed. The security suite also applies that migration to the isolated test database.
- Backend build, type-aware lint, existing unit test and HTTP health integration test passed. Backend dependency audit reported zero vulnerabilities after compatible patched transitive dependencies were applied.
- `npm run test:security` builds then executes `scripts/test-security.mjs`: **25 security integration checks passed**. Tests refuse any non-loopback database, database without a `_test` suffix or the development database URL. Only that dedicated test database is reset.
- Checks include idempotent seeds; concurrent one-time bootstrap; no bootstrap overwrites; weak-password rejection; public health; missing BFF/session 401; hostile-Origin rejection; real Argon2id and hashed sessions; generic login errors; strict staff validation; all five lesser roles denied staff mutation/direct access; viewer/read-only policy; multiple-role union; session revocation on role changes; self-edit prevention; live database permission changes; last-active-owner protection through another authorized principal; disable/expiry/idle/logout replay; missing registration; persistent rate limiting; safe audit events; no-store/noindex API headers.
- Admin ESLint and production build passed. Browser runtime checks passed.
- Authentication: success and rejection cases, visibility control and redirects verified.
- Cookies: HttpOnly, host-only and SameSite flags verified.
- Browser storage and HTML did not expose session material.
- Request forgery defenses rejected invalid mutations.
- Owner access: all eleven modules, staff creation/disable and self-edit restrictions verified.
- Five restricted roles denied staff access; Order Manager denied Products.
- Disable, expiry and logout invalidated access.
- **12 responsive checks** cover login/dashboard at 1920, 1440, 1024, 768, 390 and 320px, with no horizontal overflow. Sidebar collapse, modal focus/Tab wrap, Escape, navigation dismissal, scroll lock and focus return passed.
- A further **22 layout checks** covered every one of the 11 admin modules at 1440 and 320px, including staff forms and the scroll-contained audit table. A focused expired-session mutation test confirmed redirect to login without creating an account.
- Browser public bundles were checked for the generated bridge/database secrets; none were present.

Evidence: `backend/docs/security-verification.json`, `admin/docs/browser-verification.json`, local screenshots under `%TEMP%/vog-admin`. Test accounts/passwords are generated per run and saved only in ignored `backend/.local/security-test-accounts.json` for the browser suite, never printed. They are for the isolated test DB only.

## Files created and modified

- New `admin/package.json`, lockfile, `next.config.mjs`, ESLint/JS path configuration, `AGENTS.md`, `.env.example`, `README.md`, copied public VOGPK logo and disallowing `robots.txt`.
- New admin routes: root layout/root redirect, login, protected layout and generic module route, safe error state, same-origin CSRF challenge and allowlisted BFF handler.
- New admin components: `AdminShell.jsx`, `LoginForm.jsx`, `StaffPanel.jsx`; module metadata in `src/config/modules.js`; shared theme in `src/styles/admin.css`.
- New admin server-only configuration, API client and session-verification helpers, plus a same-origin client mutation helper in `src/lib/`. Browser tests and their result JSON are under `admin/scripts` and `admin/docs`.
- New backend Prisma schema, initial migration/lock and `prisma.config.ts`, role seed and `.env.example`.
- New backend `src/security/`: configuration, database client, permission/role definitions, validation schemas, authentication/session service, staff service, provisioning functions, guard/decorators, admin controller, module and safe HTTP exception filter.
- New backend scripts for one-time owner bootstrap, operator-assisted password recovery, random local environment setup, optional local PostgreSQL, retention cleanup and real security integration tests; evidence under `backend/docs`.
- Modified backend `src/main.ts`, `app.module.ts`, `app.controller.ts`, package/lockfile and README to wire auth, CORS, headers, health access and scripts.
- Modified root `.gitignore` to exclude local database/test material and generated Prisma output, and root README for the three-app setup. Existing storefront changes were preserved without editing catalogue/homepage/product design in this milestone.

To repeat the combined verification:

```powershell
# backend, with the optional local database running:
npm run build
node scripts/test-security.mjs --keep-server
# Keep the isolated API running for the next command on port 4000.
# admin, in another terminal with its API_URL pointing to that local test API:
npm run build
npm start
# another admin terminal:
node scripts/test-admin-browser.cjs
```

The browser script requires Playwright/Edge; an existing bundled Playwright module may be specified with `PLAYWRIGHT_MODULE`. Stop the isolated API afterward and start Nest against the normal dev DATABASE_URL. The suite should never be run against production data. Test credentials do not become the real owner. `.env.local`, `.local/`, generated Prisma output and database files are ignored by Git.

The default test API port 4000 must be free before starting the suite. If retaining the normal API, set `SECURITY_TEST_PORT` to a separate local port and point the admin verification environment's API_URL at that isolated service; do not run the browser test against the real development staff database.

## Remaining before production

- Real managed database, real HTTPS origins, deployment secrets, trusted-proxy configuration, backup/recovery procedures and monitoring are not configured here. No DNS or hosted deployment was performed.
- MFA is **not implemented**. Before privileged production administration, integrate and require a real second factor (e.g. WebAuthn or a reviewed TOTP provider), enrolment/recovery controls, and session step-up verification between password verification and session issuance. Do not treat today's password-only sessions as MFA verified.
- Owner-controlled initial passwords and operator-assisted recovery are implemented. Invitation onboarding, mandatory initial-password change and self-service password changes are not implemented and must be designed before wider staff rollout.
- Schedule `npm run security:cleanup` through the production operations system to remove expired throttle buckets and sessions that expired more than 30 days ago; it does not remove audit logs. Define an audit retention/access policy and protected backups before production. No automatic external scheduler was created.
- Add operational login alerting, edge limits and deployment-specific CSP/nonce hardening during production review. Password hashing is memory-intensive; capacity-test authentication concurrency and resource limits on the chosen host.
- Full product/category/media/homepage/coupon/order/settings editors are intentionally placeholders. No order processing, refund or payment operations exist. Customer accounts and storefront auth remain separate future work.

No environmental blocker prevented migrations, real authentication or local end-to-end verification. A development verification owner now exists following the explicit real-verification request; see the live verification report for safe account handling before operational use.
