# VOGPK — Vision of Gamers

Monorepo with three independently installed applications:

| App | Stack | Local address |
|---|---|---|
| `frontend/` | Next.js 16, React, JavaScript/JSX | http://localhost:3000 |
| `admin/` | Separate Next.js administration app | http://localhost:3001 |
| `backend/` | NestJS 12, TypeScript, Prisma 7, PostgreSQL | http://localhost:4000/api/health |

Node.js 24.15+ and npm are required. There is no Turborepo/Nx workspace. Run `npm ci` inside each application. Git is managed at this root.

The storefront includes the hero, curated product carousels, 84 development products, product detail pages and galleries, dependent variant architecture, and category/collection listings with filters. Products retain retailer-reference prices and unverified inventory; no checkout or fake purchasing is implemented.

## Administration setup

Read **[Admin Phase 1 setup, security, owner provisioning and deployment guide](docs/admin-phase1.md)**. This includes the exact startup sequence, local PostgreSQL helper, manual database setup, configuration examples, CLI owner bootstrap and security-test commands.

There is **no default owner password and no public registration**. Migrations/role seeding do not create an account. Supply your own owner credentials securely through the documented bootstrap command.

Start each application in its own terminal after database/configuration setup:

```powershell
cd frontend
npm run dev
```

```powershell
cd backend
npm run start:dev
```

```powershell
cd admin
npm run dev
```

Backend and admin require local environment configuration; placeholder-only `.env.example` files are provided. Do not commit `.env.local`, database files, generated test credentials or secrets. The optional database helper is development-only, binds loopback on port 5433, and does not install a system service.

## Checks

- Storefront: `npm run lint`, `npm run build`; listing/product/gallery/variant verification scripts are documented in its reports.
- Admin: `npm run lint`, `npm run build`; `node scripts/test-admin-browser.cjs` against the isolated test API verifies browser/BFF/session/RBAC flows.
- Backend: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run db:validate`, `npm run build`, `npm run test:security`.
- Migrations: `npm run db:migrate`; roles/permissions: `npm run db:seed` (both from backend, against an explicitly configured database).

## Implementation reports

- [Product detail pages](frontend/docs/product-detail-pages.md)
- [Dependent variants and future catalogue schema](frontend/docs/product-variants.md)
- [Product listing routes, facets and future API contract](frontend/docs/product-listing-pages.md)
- [Secure admin foundation, database models, roles, sessions and verification](docs/admin-phase1.md)
- [Completed real development authentication and RBAC verification](docs/admin-auth-verification.md)

## Deployment preparation

Keep the storefront in its existing Vercel project rooted at `frontend`. The independent admin is prepared for a Netlify project rooted at `admin`; see the [admin routing, Netlify and custom-domain guide](docs/admin-routing-netlify.md). Deploy `backend` independently to a suitable Node.js service with PostgreSQL. Origins, API URLs and cookie security are configurable; no production domain is hardcoded into admin business logic. Production administration requires HTTPS, host-only Secure cookies and server-only secrets.

No DNS/deployment configuration is performed automatically. MFA, invitations/password change onboarding, operational monitoring and production database/backup setup remain launch prerequisites. Product/order/marketing administration modules are protected placeholders in Phase 1; full editors, payments, customer accounts and checkout are outside this milestone.
