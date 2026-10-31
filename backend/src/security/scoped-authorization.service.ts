import {ConflictException, ForbiddenException, Inject, Injectable} from '@nestjs/common';
import {DatabaseService} from './database.js';
import type {Prisma} from '../generated/prisma/client.js';
import {SCOPED_PERMISSIONS, manageRolePermission, manageStaffPermission} from './scoped-permissions.js';
import type {ScopeContext} from './scoped-permissions.js';
import {PERMISSIONS, userGraph} from './roles.js';

export type ScopeTransaction = Prisma.TransactionClient;
export type RoleGrant = {code: string; canDelegate: boolean};
export const scopeWhere = (ctx: ScopeContext) => ({scopeKind: ctx.kind,
  tenantId: ctx.kind === 'PLATFORM' ? null : ctx.tenantId,
  storeId: ctx.kind === 'STORE' ? ctx.storeId : null});
const denied = () => new ForbiddenException('Access denied.');

@Injectable()
export class ScopedAuthorizationService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  // No authorization cache: each request and every write transaction re-resolves
  // active users, memberships, scope ownership and current grants from PostgreSQL.
  async resolve(userId: string, ctx: ScopeContext, tx: ScopeTransaction = this.db) {
    const user = await tx.adminUser.findUnique({where: {id: userId}, include: userGraph});
    if (!user?.active) throw denied();
    if (ctx.kind !== 'PLATFORM') {
      const membership = await tx.tenantMembership.findUnique({where: {tenantId_userId: {tenantId: ctx.tenantId, userId}}, include: {tenant: true}});
      if (!membership?.active || !membership.tenant.active) throw denied();
      if (ctx.kind === 'STORE') {
        const member = await tx.storeMembership.findUnique({where: {tenantId_storeId_userId: {tenantId: ctx.tenantId, storeId: ctx.storeId, userId}}, include: {store: true}});
        if (!member?.active || !member.store.active) throw denied();
      }
    }
    const roles = await tx.scopedRole.findMany({where: {...scopeWhere(ctx),
      ...(ctx.kind === 'PLATFORM' ? {platformAssignments: {some: {userId}}} :
        ctx.kind === 'TENANT' ? {tenantAssignments: {some: {userId, tenantId: ctx.tenantId}}} :
          {storeAssignments: {some: {userId, tenantId: ctx.tenantId, storeId: ctx.storeId}}}),
    }, include: {permissions: {include: {supportedScope: {include: {permission: true}}}}}});
    if (ctx.kind === 'PLATFORM' && !roles.length) throw denied();
    const permissions = new Set<string>(), delegable = new Set<string>();
    for (const role of roles) for (const grant of role.permissions) {
      const code = grant.supportedScope.permission.code;
      if (!SCOPED_PERMISSIONS[code]?.includes(ctx.kind)) continue;
      permissions.add(code);
      if (grant.canDelegate) delegable.add(code);
    }
    let legacyOwner = false;
    // Compatibility is explicitly confined to one stored context, never PLATFORM.
    const bridge = ctx.kind === 'PLATFORM' ? null : await tx.legacyStoreBridge.findUnique({where: {key: 'default'}});
    if (bridge && ctx.kind !== 'PLATFORM' && bridge.tenantId === ctx.tenantId && (ctx.kind === 'TENANT' || bridge.storeId === ctx.storeId)) {
      const storeMember = await tx.storeMembership.findUnique({where: {tenantId_storeId_userId: {tenantId: bridge.tenantId, storeId: bridge.storeId, userId}}, include: {store: true}});
      if (storeMember?.active && storeMember.store.active) {
        legacyOwner = user.roles.some(({role}) => role.code === 'SUPER_ADMIN' && role.system);
        for (const {role} of user.roles) for (const {permission} of role.permissions) {
          if (SCOPED_PERMISSIONS[permission.code]?.includes(ctx.kind)) permissions.add(permission.code);
        }
        // New default-context capabilities are granted only to the existing Owner.
        if (legacyOwner) for (const [code, scopes] of Object.entries(SCOPED_PERMISSIONS)) if (scopes.includes(ctx.kind) && (permissions.has(code) || !(PERMISSIONS as readonly string[]).includes(code))) {
          permissions.add(code); delegable.add(code);
        }
      }
    }
    return {context: ctx, permissions: [...permissions].sort(), delegable: [...delegable].sort(), owner: legacyOwner || roles.some(role => role.owner), roles: roles.map(role => ({id: role.id, code: role.code, name: role.name}))};
  }

  async require(userId: string, ctx: ScopeContext, permissions: string[], tx: ScopeTransaction = this.db) {
    const access = await this.resolve(userId, ctx, tx);
    if (!permissions.length || permissions.some(code => !access.permissions.includes(code))) throw denied();
    return access;
  }

  async requireLegacy(userId: string, tx: ScopeTransaction = this.db) {
    const bridge = await tx.legacyStoreBridge.findUnique({where: {key: 'default'}});
    if (bridge) await this.resolve(userId, {kind: 'STORE', tenantId: bridge.tenantId, storeId: bridge.storeId}, tx);
  }

  // Every mutation shares a lock with existing staff/login operations. Serializable
  // retry handles stale snapshots and concurrent final-owner changes.
  async write<T>(run: (tx: ScopeTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) try {
      return await this.db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
        return run(tx);
      }, {isolationLevel: 'Serializable', timeout: 15000});
    } catch (error) {
      if ((error as {code?: string}).code === 'P2034' && attempt < 2) continue;
      if ((error as {code?: string}).code === 'P2002') throw new ConflictException('A role with that code already exists.');
      throw error;
    }
  }

  async audit(tx: ScopeTransaction, actorId: string, ctx: ScopeContext, action: string, resourceId: string) {
    await tx.auditLog.create({data: {actorId, action, resource: 'scoped_authorization', resourceId,
      scopeKind: ctx.kind, tenantId: ctx.kind === 'PLATFORM' ? null : ctx.tenantId, storeId: ctx.kind === 'STORE' ? ctx.storeId : null}});
  }

  async validateGrants(tx: ScopeTransaction, ctx: ScopeContext, grants: RoleGrant[], delegable: string[]) {
    if (grants.some(g => !SCOPED_PERMISSIONS[g.code]?.includes(ctx.kind) || !delegable.includes(g.code))) throw denied();
    const rows = await tx.permissionScope.findMany({where: {scopeKind: ctx.kind, permission: {code: {in: grants.map(g => g.code)}}}, include: {permission: true}});
    if (rows.length !== grants.length) throw denied();
    return rows.map(row => ({permissionId: row.permissionId, canDelegate: grants.find(g => g.code === row.permission.code)!.canDelegate}));
  }

  async createRole(actorId: string, ctx: ScopeContext, input: {code: string; name: string; grants: RoleGrant[]}) {
    return this.write(async tx => {
      const access = await this.require(actorId, ctx, [manageRolePermission(ctx)], tx);
      const grants = await this.validateGrants(tx, ctx, input.grants, access.delegable);
      const role = await tx.scopedRole.create({data: {...scopeWhere(ctx), code: input.code, name: input.name, permissions: {create: grants}}});
      await this.audit(tx, actorId, ctx, 'scoped.role_created', role.id);
      return {id: role.id, code: role.code, name: role.name};
    });
  }

  async updateRole(actorId: string, ctx: ScopeContext, roleId: string, input: {name: string; grants: RoleGrant[]}) {
    return this.write(async tx => {
      const access = await this.require(actorId, ctx, [manageRolePermission(ctx)], tx);
      const role = await tx.scopedRole.findFirst({where: {id: roleId, ...scopeWhere(ctx)}, include: {permissions: {include: {supportedScope: {include: {permission: true}}}}}});
      if (!role || role.system || role.owner || role.permissions.some(g => !access.delegable.includes(g.supportedScope.permission.code))) throw denied();
      const grants = await this.validateGrants(tx, ctx, input.grants, access.delegable);
      await tx.scopedRolePermission.deleteMany({where: {roleId}});
      await tx.scopedRole.update({where: {id: roleId}, data: {name: input.name, permissions: {create: grants}}});
      await this.audit(tx, actorId, ctx, 'scoped.role_updated', roleId);
      return {id: roleId};
    });
  }

  async assignRoles(actorId: string, ctx: ScopeContext, userId: string, roleIds: string[]) {
    return this.write(async tx => {
      const access = await this.require(actorId, ctx, [manageRolePermission(ctx), manageStaffPermission(ctx)], tx);
      if (ctx.kind === 'PLATFORM') {
        if (!await tx.adminUser.findFirst({where: {id: userId, active: true}, select: {id: true}})) throw denied();
      } else await this.resolve(userId, ctx, tx); // No cross-scope membership provisioning through this API.
      const oldRoles = await tx.scopedRole.findMany({where: {...scopeWhere(ctx), ...(ctx.kind === 'PLATFORM' ? {platformAssignments: {some: {userId}}} : ctx.kind === 'TENANT' ? {tenantAssignments: {some: {userId}}} : {storeAssignments: {some: {userId}}})}});
      const roles = await tx.scopedRole.findMany({where: {id: {in: roleIds}, ...scopeWhere(ctx)}, include: {permissions: {include: {supportedScope: {include: {permission: true}}}}}});
      if (roles.length !== roleIds.length || roles.some(r => r.permissions.some(g => !access.delegable.includes(g.supportedScope.permission.code))) ||
        ([...oldRoles, ...roles].some(r => r.owner) && !access.owner)) throw denied();
      // Removing an elevated assignment is also a privileged operation.
      await this.validateGrants(tx, ctx, (await tx.scopedRolePermission.findMany({where: {roleId: {in: oldRoles.map(r => r.id)}}, include: {supportedScope: {include: {permission: true}}}})).filter((g, i, all) => all.findIndex(x => x.permissionId === g.permissionId) === i).map(g => ({code: g.supportedScope.permission.code, canDelegate: false})), access.delegable);
      if (ctx.kind === 'PLATFORM') {
        await tx.platformRoleAssignment.deleteMany({where: {userId}});
        await tx.platformRoleAssignment.createMany({data: roleIds.map(roleId => ({userId, roleId}))});
      } else if (ctx.kind === 'TENANT') {
        await tx.tenantRoleAssignment.deleteMany({where: {tenantId: ctx.tenantId, userId}});
        await tx.tenantRoleAssignment.createMany({data: roleIds.map(roleId => ({tenantId: ctx.tenantId, userId, roleId}))});
      } else {
        await tx.storeRoleAssignment.deleteMany({where: {tenantId: ctx.tenantId, storeId: ctx.storeId, userId}});
        await tx.storeRoleAssignment.createMany({data: roleIds.map(roleId => ({tenantId: ctx.tenantId, storeId: ctx.storeId, userId, roleId}))});
        await this.requireOwner(tx, ctx);
      }
      await this.audit(tx, actorId, ctx, 'scoped.assignments_changed', userId);
      return {ok: true};
    });
  }

  async requireOwner(tx: ScopeTransaction, ctx: Extract<ScopeContext, {kind: 'STORE'}>) {
    const members = await tx.storeMembership.findMany({where: {tenantId: ctx.tenantId, storeId: ctx.storeId, active: true, store: {active: true}, tenantMembership: {active: true, tenant: {active: true}, user: {active: true}}}, select: {userId: true}});
    for (const member of members) if ((await this.resolve(member.userId, ctx, tx)).owner) return;
    throw new ConflictException('The last active store owner must retain access.');
  }

  async revokeMembership(actorId: string, ctx: ScopeContext, userId: string) {
    if (ctx.kind === 'PLATFORM') throw denied();
    return this.write(async tx => {
      await this.require(actorId, ctx, [manageRolePermission(ctx), manageStaffPermission(ctx)], tx);
      const actor = await this.resolve(actorId, ctx, tx), target = await this.resolve(userId, ctx, tx);
      if (target.permissions.some(code => !actor.delegable.includes(code)) || (target.owner && !actor.owner)) throw denied();
      if (ctx.kind === 'STORE') {
        await tx.storeMembership.update({where: {tenantId_storeId_userId: {tenantId: ctx.tenantId, storeId: ctx.storeId, userId}}, data: {active: false}});
        await this.requireOwner(tx, ctx);
      } else {
        // Tenant revocation must preserve the last owner of every affected store.
        const stores = await tx.storeMembership.findMany({where: {tenantId: ctx.tenantId, userId, active: true}, select: {storeId: true}});
        for (const store of stores) {
          const storeCtx = {kind: 'STORE' as const, tenantId: ctx.tenantId, storeId: store.storeId};
          const storeActor = await this.require(actorId, storeCtx, [manageRolePermission(storeCtx), manageStaffPermission(storeCtx)], tx);
          const storeTarget = await this.resolve(userId, storeCtx, tx);
          if (storeTarget.permissions.some(code => !storeActor.delegable.includes(code)) || (storeTarget.owner && !storeActor.owner)) throw denied();
        }
        await tx.tenantMembership.update({where: {tenantId_userId: {tenantId: ctx.tenantId, userId}}, data: {active: false}});
        for (const store of stores) await this.requireOwner(tx, {kind: 'STORE', tenantId: ctx.tenantId, storeId: store.storeId});
      }
      await this.audit(tx, actorId, ctx, 'scoped.membership_revoked', userId);
      return {ok: true};
    });
  }
}
