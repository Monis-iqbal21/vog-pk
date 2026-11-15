# Scoped SaaS authorization

VOGPK keeps the existing authentication/session system and its legacy `Role` tables. SaaS authorization uses the separate `ScopedRole` model already present in Prisma; the two role models are not interchangeable.

## Scope rules

- **PLATFORM** roles are assigned through `PlatformRoleAssignment`. They authorize platform administration only and do not create tenant or store memberships.
- **TENANT** roles are assigned through a tenant membership and authorize that tenant only.
- **STORE** roles are assigned through a store membership. Composite foreign keys bind the assignment, role and membership to the same tenant/store.
- The protected Owner is the existing system Owner role in a store context. It cannot be edited. Access changes preserve at least one active Owner in each affected store. Tenant membership revocation checks all affected stores.
- The legacy `SUPER_ADMIN` compatibility bridge is confined to the configured default VOGPK tenant/store. It is never a platform assignment.

Every scoped API request resolves the active account, memberships, active tenant/store and role grants from PostgreSQL without an authorization cache. Scope comes from route parameters; caller-supplied tenant, store or scope headers are rejected. Nest guards require the BFF identity and session, then scoped services enforce operation-specific permissions again inside mutations. PostgreSQL composite constraints provide a second ownership boundary.

Permission grants are server-registered for specific scopes. A role manager can grant only capabilities that the actor is authorized to delegate. `canDelegate` determines whether a granted permission may itself be delegated. Self role assignment and self membership revocation are rejected. Role changes, role assignments, membership additions and revocations are recorded in scoped audit events.

## Admin workflow

The Staff & Roles workspace exposes only contexts resolved for the signed-in user. It supports viewing scoped roles and members, creating/editing custom roles, assigning roles, adding an existing active admin account to a tenant/store, and revoking a membership. Membership addition never creates an account, sets a password or grants a role. Store membership requires an existing active membership in the same tenant. Platform access is a direct platform role assignment because the schema intentionally has no platform membership model.

The UI hides actions when the current context lacks the matching capability; backend authorization remains authoritative. The existing account creation/invitation feature is not used by this workspace. There is no new invitation or password-provisioning flow.

## Security verification

Run the backend foundation suite only against the script-managed, disposable loopback PostgreSQL 18 cluster:

```powershell
cd backend
npm run test:foundation
```

This test harness creates an isolated random test database and refuses non-loopback/non-test destinations. It exercises real Nest HTTP authorization as well as the service against PostgreSQL. No production/Neon migration or write is part of this test command.

The admin app checks can be run separately:

```powershell
cd admin
npm run lint
npm run test:routing
npm run build
```

The one-time `202611010001_commerce_foundation` migration already defines the scoped schema, permission-scope relations and ownership constraints. This RBAC work adds no schema migration.
