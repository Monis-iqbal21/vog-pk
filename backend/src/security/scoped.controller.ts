import {Body, Controller, ForbiddenException, Get, Inject, Param, Patch, Post, Query, Req, SetMetadata} from '@nestjs/common';
import {z} from 'zod';
import type {AdminRequest} from './guards.js';
import {SessionOnly} from './guards.js';
import {validId, validate} from './validation.js';
import {DatabaseService} from './database.js';
import {ScopedAuthorizationService, scopeWhere} from './scoped-authorization.service.js';
import {SCOPED_PERMISSIONS, manageRolePermission, viewRolePermission} from './scoped-permissions.js';
import {requestScope} from './scope-request.js';

export const ScopedAccess = () => SetMetadata('scopedAccess', true);
const grants = z.array(z.object({code: z.string().min(1).max(80), canDelegate: z.boolean()}).strict()).max(100).refine(items => new Set(items.map(g => g.code)).size === items.length);
const roleInput = z.object({code: z.string().regex(/^[A-Z][A-Z0-9_]{1,49}$/), name: z.string().trim().min(2).max(100), grants}).strict();
const roleUpdate = roleInput.omit({code: true});
const assignmentInput = z.object({roleIds: z.array(z.uuid()).max(20).refine(ids => new Set(ids).size === ids.length)}).strict();
const memberInput = z.object({userId: z.uuid()}).strict();
const memberEmail = z.string().trim().toLowerCase().email().max(254);

@Controller(['admin/scopes/platform', 'admin/scopes/tenants/:tenantId', 'admin/scopes/tenants/:tenantId/stores/:storeId'])
@ScopedAccess()
export class ScopedController {
  constructor(@Inject(ScopedAuthorizationService) private readonly authz: ScopedAuthorizationService, @Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get('access')
  access(@Req() request: AdminRequest) { return this.authz.resolve(request.identity.id, requestScope(request)); }
  @Get('permissions')
  async permissions(@Req() request: AdminRequest) {
    const ctx = requestScope(request);
    const access = await this.authz.resolve(request.identity.id, ctx);
    if (!access.permissions.includes(viewRolePermission(ctx)) && !access.permissions.includes(manageRolePermission(ctx))) throw new ForbiddenException('Access denied.');
    return Object.entries(SCOPED_PERMISSIONS).filter(([code, scopes]) => scopes.includes(ctx.kind) && access.delegable.includes(code)).map(([code]) => ({code}));
  }
  @Get('roles')
  async roles(@Req() request: AdminRequest) {
    const ctx = requestScope(request);
    const access = await this.authz.resolve(request.identity.id, ctx);
    if (!access.permissions.includes(viewRolePermission(ctx)) && !access.permissions.includes(manageRolePermission(ctx))) throw new ForbiddenException('Access denied.');
    return this.db.scopedRole.findMany({where: scopeWhere(ctx), take: 100, orderBy: [{code: 'asc'}, {id: 'asc'}], select: {id: true, code: true, name: true, system: true, owner: true,
      permissions: {select: {canDelegate: true, supportedScope: {select: {permission: {select: {code: true}}}}}}}});
  }
  @Get('members') members(@Req() request: AdminRequest) { return this.authz.members(request.identity.id, requestScope(request)); }
  @Get('members/lookup') lookupMember(@Req() request: AdminRequest, @Query('email') email: string) { return this.authz.findMember(request.identity.id, requestScope(request), validate(memberEmail, email)); }
  @Post('members') addMember(@Req() request: AdminRequest, @Body() body: unknown) { return this.authz.addMembership(request.identity.id, requestScope(request), validate(memberInput, body).userId); }
  @Post('roles')
  createRole(@Req() request: AdminRequest, @Body() body: unknown) { return this.authz.createRole(request.identity.id, requestScope(request), validate(roleInput, body)); }
  @Patch('roles/:id')
  updateRole(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: unknown) { return this.authz.updateRole(request.identity.id, requestScope(request), validId(id), validate(roleUpdate, body)); }
  @Post('members/:id/roles')
  assign(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: unknown) { return this.authz.assignRoles(request.identity.id, requestScope(request), validId(id), validate(assignmentInput, body).roleIds); }
  @Post('members/:id/revoke')
  revoke(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: unknown) { validate(z.object({}).strict(), body); return this.authz.revokeMembership(request.identity.id, requestScope(request), validId(id)); }
}

@Controller('admin/contexts')
export class ContextsController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,@Inject(ScopedAuthorizationService) private readonly authz: ScopedAuthorizationService) {}
  @Get('catalog') @SessionOnly()
  async catalog(@Req() request:AdminRequest){
    const memberships=await this.db.storeMembership.findMany({where:{userId:request.identity.id,active:true,store:{active:true},tenantMembership:{active:true,tenant:{active:true}}},take:50,orderBy:{storeId:'asc'},include:{store:true,tenantMembership:{include:{tenant:true}}}});
    const contexts=[];for(const member of memberships){const access=await this.authz.resolve(request.identity.id,{kind:'STORE',tenantId:member.tenantId,storeId:member.storeId});if(['categories.view','category-filters.view','listings.view','pricing.view','inventory.view','settings.view','settings.manage'].some(p=>access.permissions.includes(p)))contexts.push({id:member.storeId,tenantId:member.tenantId,name:member.store.name,tenantName:member.tenantMembership.tenant.name,permissions:access.permissions});}return contexts;
  }
  @Get('products') @SessionOnly()
  async products(@Req()request:AdminRequest){const memberships=await this.db.tenantMembership.findMany({where:{userId:request.identity.id,active:true,tenant:{active:true}},take:25,orderBy:{tenantId:'asc'},include:{tenant:true}});const contexts=[];for(const member of memberships){const access=await this.authz.resolve(request.identity.id,{kind:'TENANT',tenantId:member.tenantId});if(['products.view','media.view'].some(p=>access.permissions.includes(p)))contexts.push({id:member.tenantId,name:member.tenant.name,permissions:access.permissions});}return contexts;}
  @Get('schema') @SessionOnly()
  async schema(@Req() request:AdminRequest){
    const memberships=await this.db.tenantMembership.findMany({where:{userId:request.identity.id,active:true,tenant:{active:true}},take:25,orderBy:{tenantId:'asc'},include:{tenant:true}});
    const contexts=[];
    for(const membership of memberships){const access=await this.authz.resolve(request.identity.id,{kind:'TENANT',tenantId:membership.tenantId});if(['attributes.view','product-types.view','option-sets.view'].some(p=>access.permissions.includes(p)))contexts.push({id:membership.tenantId,name:membership.tenant.name,permissions:access.permissions});}
    return contexts;
  }
  @Get('rbac') @SessionOnly()
  async rbac(@Req() request: AdminRequest) {
    const userId = request.identity.id, contexts: Array<{kind: 'PLATFORM'|'TENANT'|'STORE'; id: string; tenantId?: string; storeId?: string; name: string; tenantName?: string; permissions: string[]; owner: boolean}> = [];
    const platform = await this.db.platformRoleAssignment.count({where: {userId, role: {scopeKind: 'PLATFORM'}}});
    if (platform) {
      const access = await this.authz.resolve(userId, {kind: 'PLATFORM'});
      if (access.permissions.includes('platform.roles.view') || access.permissions.includes('platform.staff.manage')) contexts.push({kind: 'PLATFORM', id: 'platform', name: 'Platform', permissions: access.permissions, owner: access.owner});
    }
    const tenants = await this.db.tenantMembership.findMany({where: {userId, active: true, tenant: {active: true}}, take: 25, orderBy: {tenantId: 'asc'}, include: {tenant: true}});
    for (const member of tenants) {
      const ctx = {kind: 'TENANT' as const, tenantId: member.tenantId}, access = await this.authz.resolve(userId, ctx);
      if (['roles.view', 'roles.manage', 'staff.view', 'staff.manage'].some(p => access.permissions.includes(p))) contexts.push({kind: 'TENANT', id: member.tenantId, tenantId: member.tenantId, name: member.tenant.name, permissions: access.permissions, owner: access.owner});
    }
    const stores = await this.db.storeMembership.findMany({where: {userId, active: true, store: {active: true}, tenantMembership: {active: true, tenant: {active: true}}}, take: 50, orderBy: [{tenantId: 'asc'}, {storeId: 'asc'}], include: {store: true, tenantMembership: {include: {tenant: true}}}});
    for (const member of stores) {
      const ctx = {kind: 'STORE' as const, tenantId: member.tenantId, storeId: member.storeId}, access = await this.authz.resolve(userId, ctx);
      if (['roles.view', 'roles.manage', 'staff.view', 'staff.manage'].some(p => access.permissions.includes(p))) contexts.push({kind: 'STORE', id: member.storeId, tenantId: member.tenantId, storeId: member.storeId, name: member.store.name, tenantName: member.tenantMembership.tenant.name, permissions: access.permissions, owner: access.owner});
    }
    return contexts;
  }
  @Get() @SessionOnly()
  async list(@Req() request: AdminRequest) {
    // Query, nested projections and counts all start from the authenticated user.
    return this.db.tenantMembership.findMany({where: {userId: request.identity.id, active: true, tenant: {active: true}}, take: 100, orderBy: {tenantId: 'asc'},
      select: {tenant: {select: {id: true, slug: true, name: true}}, stores: {where: {active: true, store: {active: true}}, select: {store: {select: {id: true, slug: true, name: true}}}}}});
  }
}
