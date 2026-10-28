import {ConflictException,ForbiddenException,Inject,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database.js';
import {hashPassword} from './auth.service.js';
import {safeIdentity,userGraph} from './roles.js';
import {ROLE_DEFINITIONS} from './roles.js';
import type {Prisma} from '../generated/prisma/client.js';
type Transaction=Prisma.TransactionClient;
@Injectable()
export class StaffService {
 constructor(@Inject(DatabaseService) private readonly db:DatabaseService){}
 async requireActor(tx:Transaction,actorId:string){
  const user=await tx.adminUser.findUnique({where:{id:actorId},include:userGraph});
  if(!user?.active)throw new ForbiddenException('Access denied.');
  const actor=safeIdentity(user);if(!['staff.manage','roles.manage'].every(code=>actor.permissions.includes(code)))throw new ForbiddenException('Access denied.');return actor;
 }
 async rolesFor(tx:Transaction,codes:string[],actorPermissions?:string[]){
  if(codes.some(code=>!ROLE_DEFINITIONS.some(role=>role.code===code)))throw new ForbiddenException('Only predefined roles can be assigned.');
  const roles=await tx.role.findMany({where:{code:{in:codes},system:true},include:{permissions:{include:{permission:true}}}});
  if(roles.length!==codes.length)throw new ConflictException('Roles have not been configured.');
  if(actorPermissions&&roles.some(role=>role.permissions.some(({permission})=>!actorPermissions.includes(permission.code))))throw new ForbiddenException('Cannot grant permissions you do not hold.');
  return roles;
 }
 async list(){return (await this.db.adminUser.findMany({include:userGraph,orderBy:{createdAt:'asc'},take:200})).map(user=>({...safeIdentity(user),createdAt:user.createdAt,lastLoginAt:user.lastLoginAt}));}
 async create(actorId:string,input:{name:string;email:string;password:string;roles:string[]}){
  const passwordHash=await hashPassword(input.password);
  try{return await this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
   const actor=await this.requireActor(tx,actorId),roles=await this.rolesFor(tx,input.roles,actor.permissions);
   const user=await tx.adminUser.create({data:{name:input.name,email:input.email,passwordHash,roles:{create:roles.map(role=>({roleId:role.id}))}},include:userGraph});
   await tx.auditLog.create({data:{actorId,action:'staff.created',resource:'admin_user',resourceId:user.id,metadata:{roles:input.roles}}});return safeIdentity(user);
  });}catch(error){if((error as {code?:string}).code==='P2002')throw new ConflictException('An account already uses that email.');throw error;}
 }
 async update(actorId:string,id:string,input:{active?:boolean;roles?:string[]}){
  if(actorId===id)throw new ForbiddenException('You cannot change your own access.');
  return this.db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
   const actor=await this.requireActor(tx,actorId),target=await tx.adminUser.findUnique({where:{id},include:userGraph});if(!target)throw new NotFoundException('Account not found.');
   const roles=input.roles?await this.rolesFor(tx,input.roles,actor.permissions):null;
   const removesOwner=target.active&&target.roles.some(({role})=>role.code==='SUPER_ADMIN')&&(input.active===false||input.roles!==undefined&&!input.roles.includes('SUPER_ADMIN'));
   if(removesOwner&&await tx.adminUser.count({where:{active:true,roles:{some:{role:{code:'SUPER_ADMIN'}}}}})<=1)throw new ConflictException('The last active owner must retain access.');
   if(roles){await tx.adminUserRole.deleteMany({where:{userId:id}});await tx.adminUserRole.createMany({data:roles.map(role=>({userId:id,roleId:role.id}))});}
   await tx.adminUser.update({where:{id},data:{active:input.active}});
   // Any access change invalidates all of that user's credentials immediately.
   await tx.adminSession.updateMany({where:{userId:id,revokedAt:null},data:{revokedAt:new Date()}});
   await tx.auditLog.create({data:{actorId,action:'staff.access_changed',resource:'admin_user',resourceId:id,metadata:{active:input.active??target.active,roles:input.roles??target.roles.map(({role})=>role.code)}}});
   return safeIdentity((await tx.adminUser.findUnique({where:{id},include:userGraph}))!);
  });
 }
}
