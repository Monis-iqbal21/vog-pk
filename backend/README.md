# VOGPK NestJS API

NestJS 12 / TypeScript, Prisma 7 and PostgreSQL. Public health remains at `/api/health`; administration routes use a confidential BFF boundary plus database-backed opaque sessions and permission guards.

Production operations are documented in [the deployment runbook](../docs/PRODUCTION_DEPLOYMENT.md). `HOST` defaults to loopback in production and all interfaces in local development. `/api/health/ready` is the bounded, uncached database probe. Use `npm run test:security:fresh` for non-resetting local integration checks; it refuses remote databases and does not export generated credentials.

See [the root Phase 1 guide](../docs/admin-phase1.md) for setup, environment values, owner provisioning, database migration, account recovery, security decisions and deployment requirements.

```powershell
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed
npm run start:dev
```

Configure `.env.local` first. `npm run env:local` can create random ignored local settings for a fresh development setup; `npm run db:local` runs an optional loopback PostgreSQL development cluster. Neither command creates an owner account.

Checks: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run test:security`.

The security suite requires a distinct loopback `TEST_DATABASE_URL` whose database name ends in `_test`. It resets only that explicitly named test database. `node scripts/test-security.mjs --keep-server` retains its test API for the admin browser suite; stop it afterward before starting the normal development API.

`npm run owner:bootstrap` requires securely supplied `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD`; no defaults are used. Refer to the guide for a secure PowerShell prompt. `owner:recover` is a trusted-operator password reset/revocation command, not a public recovery endpoint. `security:cleanup` removes expired throttle records and old expired sessions without removing audit logs.
