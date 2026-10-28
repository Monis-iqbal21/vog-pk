# Separate Vercel admin project

Prepared for the existing `Monis-iqbal21/vog-pk` repository. This guide does not create or deploy a project. The independently hosted NestJS service and production database must exist first.

## Project settings

Import the same repository as a **new project** named `vogpk-admin`. Select Next.js, Root Directory `admin`, Node.js 24, Install Command `npm ci`, Build Command `npm run build`, and the default Next.js output. Keep SSR, route handlers and Proxy enabled; do not configure a static export or SPA fallback. A separate project per application is supported by [Vercel monorepos](https://vercel.com/docs/monorepos).

Keep the existing `vogpk` storefront project's Root Directory `frontend`. Do not reconnect it to `admin`, change its DNS or copy its environment into the new project. The account connector confirmed an existing production Git deployment of `main` at the previously pushed revision, but its summarized project response does not expose Root Directory. Confirm that field in the existing project's Build and Deployment settings before changing any hosting configuration; no existing setting was modified by this task.

Configure all required variables before the first authorized build/deployment. The build runs a fail-closed configuration preflight. `VERCEL=1` prevents using local mode even if a copied local environment requests it. Do not upload `.env.local` or use `vercel env pull` outputs as source files. Set secrets privately using [Vercel environment settings](https://vercel.com/docs/environment-variables).

## Admin environment

| Name | Required configuration |
| --- | --- |
| `ADMIN_ENVIRONMENT` | Hosted mode |
| `ADMIN_ORIGIN` | Exact HTTPS origin of the new admin hostname; no trailing slash/path |
| `API_URL` | Exact non-loopback HTTPS origin of the independently hosted NestJS backend; no `/api` suffix |
| `STOREFRONT_ORIGIN` | Exact HTTPS customer storefront origin |
| `BFF_SHARED_SECRET` | New cryptographically random secret of at least 64 characters, matching the production backend only |
| `COOKIE_SECURE` | Enabled for HTTPS |
| `TRUST_PROXY_HEADERS` | Optional; leave disabled until the deployed ingress is verified to replace incoming forwarding headers |

Supply these for the appropriate build and runtime environment. None uses a `NEXT_PUBLIC_` prefix. Preview deployments require separate exact origins, an isolated database and separate secrets/accounts; do not share production credentials with previews. The actual admin hostname must be known before setting `ADMIN_ORIGIN`.

The BFF contacts NestJS server-side. The browser must never receive the bridge secret or a database URL. Localhost is not a usable backend from a deployed Vercel function. Admin, backend and storefront origins must be distinct.

## Independently hosted backend and database

Set backend `NODE_ENV`, `PORT`, `DATABASE_URL`, `ADMIN_ORIGIN`, `STOREFRONT_ORIGIN`, `BFF_SHARED_SECRET`, `SESSION_IDLE_MINUTES` and `SESSION_ABSOLUTE_HOURS` in the backend host's private configuration. Use production mode, HTTPS origins and a separate persistent PostgreSQL database over the provider's verified TLS connection. Restrict database networking and credentials to the backend/operator. Do not disable certificate verification or expose PostgreSQL to the browser.

From an authorized backend operator environment, run `npm ci`, `npm run build`, `npm run db:validate`, `npm run db:migrate` and `npm run db:seed`. Migration deployment applies the checked-in schema; never use development reset commands on production. Run the built backend with `npm run start:prod` under the host's process management and HTTPS ingress. This task does not deploy NestJS to Vercel or to another host.

## Production owner provisioning

After migrations and roles exist, provide `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` privately to a trusted, short-lived backend operator process and run `npm run owner:bootstrap`. Use the hosting secret manager or a hidden operator prompt; never put the password in a command argument, Git file, screenshot, shell history or build log. Remove the provisioning password from the host's configuration afterward. Bootstrap refuses to overwrite an existing owner.

Use a new production password. Do not upload the local database, Desktop password file, local owner account, development verification accounts or DPAPI vault. `owner:setup` and `verify:dev:provision` are restricted local tools, not production provisioning commands.

## HTTPS session acceptance checks

Hosted cookies are host-only `__Host-` cookies with Secure, HttpOnly, SameSite=Strict and Path=/, with no Domain attribute. No client token storage is used. Both protected pages and the NestJS API revalidate sessions and current database permissions. Retain exact-origin/CSRF checks and no-store headers.

Once an explicitly authorized production deployment exists, test `/login`, anonymous `/dashboard`, real login, dashboard refresh, role-restricted pages and direct APIs, CSRF failure, logout/replay, expired/disabled sessions, and public storefront access. Inspect cookie attributes without copying cookie values. Local HTTP test success is not proof of remote HTTPS behavior.

Online login remains blocked until the separate admin project, reachable HTTPS backend, production PostgreSQL connectivity, migrations/seed, matching secrets/origins and securely provisioned production owner are ready. MFA, broader staff onboarding and operational monitoring remain future production hardening; business editor placeholders are not completed commerce modules.

## Existing storefront deployment

The existing project has a production Git deployment from `main` in this repository. A normal main push may trigger its existing Git integration ([Vercel Git deployments](https://vercel.com/docs/git)); this task does not create or manually deploy an admin project. Check the new commit's deployment status after pushing. Root-directory and deployment settings must remain unchanged.
