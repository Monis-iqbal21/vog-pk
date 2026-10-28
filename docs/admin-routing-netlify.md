# Admin URLs, authentication redirects and Netlify preparation

## Current URLs and behavior

The customer storefront remains public at `http://localhost:3000/`. Its source/routes were not modified in this routing task. Staff authentication belongs only to the separate administration application:

| URL | Behavior |
|---|---|
| `http://localhost:3001/` | Server-verified session → dashboard; otherwise login |
| `http://localhost:3001/login` | Login screen; verified sessions → dashboard |
| `http://localhost:3001/dashboard` | Verified session required; anonymous/expired → login |
| `http://localhost:3001/staff` (and other internal modules) | Session + module permission required; anonymous/expired → login preserving safe destination |

This implements the latest attached routing brief and supersedes the previous admin-root-to-storefront redirect. It does not make store customers log in. `/admin/login` was not added to `frontend` and is not required.

For a normal sign-in, the destination is `/dashboard`. For an anonymous protected request, e.g. `/orders?view=compact`, the server sends `/login?returnTo=%2Forders%3Fview%3Dcompact`. After successful real NestJS authentication, the original destination is used only if it is valid and the user's current permissions allow that module. Otherwise dashboard is used. A user already signed in who visits `/login` goes to dashboard. Logout always revokes the session and returns to `/login` without retaining a destination.

## Protection and return-path validation

`src/proxy.js` follows Next.js 16's Proxy convention. It overwrites an internal request-context header with a validated destination from the actual request URL. It does **not** authenticate cookies, make database calls or authorize users. Existing server-side session verification, protected layouts/pages and NestJS guards remain the security boundaries. The proxy uses Web Request/Headers/URL APIs and no filesystem or native addons, respecting the adapter's Node middleware limitations.

Only exact existing module paths from `src/config/modules.js` can be return destinations. Relative query/hash components may be retained. Absolute URLs, protocol-relative hosts, backslashes, controls, encoded controls, path normalization tricks, unknown routes, API paths, login/root loops, repeated array parameters and oversized inputs are rejected. Invalid input falls back to `/dashboard`; it is never passed unchecked to `router.replace` or `redirect`. A caller-supplied context header cannot override the real path, and this header cannot grant permissions.

On the server, sessions still call NestJS `/api/admin/auth/me` with a private bridge key and opaque bearer token. All current permissions/active status are resolved from PostgreSQL; expired/revoked/disabled credentials are rejected. Protected data is not cached publicly. API authorization remains independent of the sidebar and return-path UX. The BFF still requires Origin/CSRF checks, and browser JS never receives the session token. No credentials are stored in localStorage.

Hosted cookies are HttpOnly, Secure, SameSite=Strict, host-only, `/`-scoped `__Host-` cookies with no Domain attribute. A custom admin hostname does not share them with the storefront/API hostname. Browser cookie scope ignores ports: the specified loopback HTTP development cookies are host-only localhost cookies, so strict local hostname isolation requires different local hostnames/HTTPS as described in the Phase 1 guide. Do not create a parent-domain cookie to bridge hostnames.

## Environment names

Existing names are retained instead of introducing duplicate public variables:

| Setting | Purpose |
|---|---|
| `ADMIN_ENVIRONMENT` | `local` for explicit loopback development/build testing; `hosted` for deployed administration |
| `ADMIN_ORIGIN` | Exact browser-facing admin origin; equivalent to ADMIN_APP_URL |
| `API_URL` | Server-only backend origin, without `/api`; equivalent to BACKEND_INTERNAL_URL |
| `STOREFRONT_ORIGIN` | Independent public store origin; equivalent to STOREFRONT_URL |
| `BFF_SHARED_SECRET` | Matching confidential random bridge key in admin and NestJS |
| `COOKIE_SECURE` | `false` only for explicit loopback local mode; `true` for hosted HTTPS |
| `TRUST_PROXY_HEADERS` | Leave `0` unless the hosting ingress has been verified to replace incoming forwarding headers |

There is no `NEXT_PUBLIC_API_URL` because the browser only calls same-origin BFF routes; the backend URL and secrets stay server-only. The browser gets neither database credentials nor the bridge secret.

Examples:

- `admin/.env.example`: local values; copy to ignored `.env.local` and supply the real random secret.
- `admin/deploy/netlify.env.example`: illustrative temporary Netlify hostname and remote API placeholders.
- `admin/deploy/custom-domain.env.example`: illustrative custom subdomains. An alternative domain such as vogpk.com works by changing values only.

The example `vogpk-admin.netlify.app` is **not** claimed to be registered, deployed or available. `api.example.com` is a placeholder, not a working API. Replace example origins with actual independently hosted services.

`resolveAdminSettings` rejects missing hosted origins, paths/queries/credentials in origin values, non-HTTPS or loopback hosted targets, shared admin/storefront origins and insecure hosted cookies. Hosted platform flags override a mistaken local-mode setting by rejecting it. Localhost defaults are available only in development or explicit loopback local mode. `npm run check:config` validates settings without printing secrets; `npm run build` runs this preflight before Next. Hosted builds therefore fail instead of silently targeting localhost.

Local commands remain:

```powershell
cd admin
npm ci
npm run dev
# or npm run lint; npm run build; npm start
```

Keep NestJS on 4000 and PostgreSQL configured as described in [Phase 1](admin-phase1.md). No real owner is automatically created by installation; use the documented secure bootstrap if needed.

## Netlify Free project setup — not executed

1. Import the existing GitHub repository as a **separate** Netlify project for the admin. Do not change the customer storefront's Vercel root or DNS.
2. Because this repository has independent package/lockfiles and no root workspace, set **Base directory = `admin`**, **Package directory = `admin`**. This ensures installation/build runs where the admin package lives. Use the app's `admin/netlify.toml`. If Netlify's monorepo detection leaves Base at the repository root, override it to `admin` for this repository. See [Netlify monorepo configuration](https://docs.netlify.com/build/configure-builds/monorepos/).
3. Build command: `npm run build`. Publish directory: `.next`, relative to that base. `admin/.nvmrc` and `netlify.toml` select Node 24. Do not use `next export`, `output: 'export'`, a `/* → /index.html` SPA catch-all or a manual redirect of protected routes to a static page. The supported [Next.js OpenNext adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) handles App Router SSR, route handlers and Proxy. No adapter package is pinned unnecessarily.
4. Record the **actual** Netlify project hostname assigned/selected in your account, then set exact `ADMIN_ORIGIN`, `STOREFRONT_ORIGIN`, HTTPS `API_URL`, `ADMIN_ENVIRONMENT=hosted`, `COOKIE_SECURE=true` and the matching private bridge secret. Set these in both build and function runtime scopes for the appropriate deployment context. Do not put secrets in TOML or client-prefixed variables. The checked-in TOML sets only nonsecret runtime/build policy. If the first import starts a build before required values are provided, preflight failure is expected; configure them before retrying.
5. Configure the remote NestJS instance with that exact admin origin, the actual storefront origin, the matching bridge key, a separate TLS PostgreSQL connection and the intended session timeouts. The API must be independently reachable over HTTPS; a Netlify function cannot connect to your development laptop's localhost:4000. Database migrations/seeding/owner provisioning remain backend operator steps.
6. Use isolated preview databases/secrets. Preview hosts need their own exact context configuration; they must not inherit production staff credentials. Automatic arbitrary host acceptance would bypass the intended Origin policy, so it is not enabled.
7. After an explicitly authorized deployment, verify direct `/login`, anonymous `/dashboard`, real login, root redirects in both states, protected-route refresh, logout/replay, RBAC 403, CSRF, cookie attributes, cache headers and no redirect loops on the actual assigned HTTPS hostname. Current verification is local, not proof of a deployed site.

Netlify's Free plan still has hosting usage limits. This task does not purchase a plan, establish service availability or certify a deployment; review the provider's current allowance in your account before use. The planned runtime needs SSR/functions, not static-only hosting.

## Future custom admin subdomain — not configured

Once the domain is owned, add the chosen `admin.<owned-domain>` in the admin Netlify project's Domain management. Follow the provider's displayed domain verification and DNS instructions. With external DNS, the subdomain generally uses a CNAME to the **actual** assigned Netlify hostname; use the exact target Netlify provides rather than copying an unregistered example. See [assigning a domain](https://docs.netlify.com/manage/domains/manage-domains/assign-a-domain-to-your-site-app/) and [domain setup](https://docs.netlify.com/manage/domains/get-started-with-domains/).

Wait for domain verification and HTTPS certificate readiness. Update admin `ADMIN_ORIGIN` to the new HTTPS admin origin, update `API_URL` and `STOREFRONT_ORIGIN` if those services also move, and update the backend's exact admin/CORS origin. Rebuild/redeploy with the authorized new environment values. Retain Secure host-only `__Host-` cookies and do not set Domain. Existing temporary-host cookies will not migrate to the custom hostname; users must sign in again. Choose one canonical operational admin origin and do not allow both hosts loosely through wildcard Origin rules.

For example, configured roles can use www.vog.com.pk / admin.vog.com.pk / api.vog.com.pk, or equivalent vogpk.com names; none is embedded in application routing. Storefront customer authentication remains separate.

## Modified/new files for this routing task

- `admin/src/app/page.jsx`: session-aware root redirect, replacing the prior storefront redirect.
- `admin/src/app/login/page.jsx`, `components/LoginForm.jsx`: validated return destination and permission-aware post-login navigation.
- `admin/src/lib/session.js`, `components/AdminShell.jsx`: preserved server/API-expiry destination with safe login URL.
- New `admin/src/lib/return-path.js`: exact internal allowlist and loop/open-redirect prevention.
- New `admin/src/proxy.js`: actual-route context forwarding; no proxy-based authentication.
- New `admin/src/lib/url-settings.js`; updated server-only `lib/config.js`: local/hosted URL and secure-cookie validation.
- New `admin/scripts/check-config.mjs`, `test-routing.mjs`, `test-routing-http.cjs`; existing browser suite root expectations updated.
- `admin/package.json` / lockfile: direct matching @next/env dependency and configuration/routing scripts.
- New `admin/netlify.toml`, `.nvmrc`, hosted example environment files; local `.env.example` and backend local-env helper updated.
- Admin/root READMEs and Phase 1 documentation updated to reflect the latest root behavior and Netlify plan.

No customer storefront source, backend auth/RBAC service, catalogue data or deployment/DNS was changed in this task. Local ignored admin settings explicitly identify loopback mode. No push was performed.

## Verification and limits

- `npm run test:routing`: **19 checks passed** for valid return paths, query/hash handling, external/protocol-relative/encoded/control/path-normalization attacks, login/API loops, repeated/oversized values, permission-aware destination selection, exact origins, mandatory hosted settings, no hosted localhost defaults, Secure cookie enforcement, temporary Netlify names and alternative owned-domain configuration.
- `node scripts/test-routing-http.cjs`: local browser/HTTP checks passed for logged-out root → login, direct `/login`, login refresh, all **11** protected routes, destination preservation including query strings, context-header spoof rejection, forged-cookie rejection, login 200 after each redirect without loops, unauthenticated BFF 401, no-store/noindex headers, no page errors and the unaffected store homepage. No frontend `/admin/login` was introduced.
- Admin ESLint and production build passed, with the proper Next.js 16 Proxy output. URL/cookie preflight passed in explicit local mode.
- Earlier Phase 1 evidence (`backend/docs/security-verification.json`, `admin/docs/browser-verification.json`) separately records real login/logout, 25 security checks, session expiry/revocation and RBAC. Those earlier results are not represented as a new authenticated routing-browser run.
- **The authenticated re-test is now complete through the normal approved development configuration:** the subsequent user-authorized verification securely provisioned development accounts and passed 23 real browser/API checks without any API_URL override. This closes the earlier isolated-override blocker. See [the actual results and cleanup report](admin-auth-verification.md).

Evidence: `admin/docs/routing-unit-verification.json`, `admin/docs/routing-http-verification.json`, and the newer `admin/docs/live-auth-verification.json`. The newer suite actually verified valid-session root/login behavior, destination restoration, open-redirect rejection, refresh, logout, expiry, disable and every default role through the existing login form/BFF/backend. The earlier HTTP report's blocked isolated-run note is historical; use the newer report for the completed authenticated verification.

No hosting account, remote backend URL, DNS record, Netlify hostname reservation or deployed HTTPS endpoint was verified or modified.
