import {ROLE_DEFINITIONS,PERMISSIONS} from './roles.js';
import {hashPassword} from './auth.service.js';
import {createStaffSchema,validate} from './validation.js';
import type {PrismaClient} from '../generated/prisma/client.js';
export async function seedSecurity(db:PrismaClient){
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
  for(const code of PERMISSIONS)await tx.permission.upsert({where:{code},create:{code,description:code.replaceAll('.',' ').replaceAll('_',' ')},update:{}});
  for(const definition of ROLE_DEFINITIONS){
   const {permissions,...fields}=definition;
   const role=await tx.role.upsert({where:{code:fields.code},create:{...fields,system:true},update:{...fields,system:true}});
   await tx.rolePermission.deleteMany({where:{roleId:role.id}});
   const records=await tx.permission.findMany({where:{code:{in:permissions}}});
   await tx.rolePermission.createMany({data:records.map(permission=>({roleId:role.id,permissionId:permission.id}))});
  }
 },{timeout:30000});
}
export async function bootstrapOwner(db:PrismaClient,input:{name:string;email:string;password:string}){
 const fields=validate(createStaffSchema,{...input,roles:['SUPER_ADMIN']}),passwordHash=await hashPassword(fields.password);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
  if(await tx.adminUserRole.findFirst({where:{role:{code:'SUPER_ADMIN'}}}))return {created:false};
  if(await tx.adminUser.findUnique({where:{email:fields.email}}))throw new Error('Email already provisioned; no changes made');
  const role=await tx.role.findUniqueOrThrow({where:{code:'SUPER_ADMIN'}});
  const user=await tx.adminUser.create({data:{name:fields.name,email:fields.email,passwordHash,roles:{create:{roleId:role.id}}}});
  await tx.auditLog.create({data:{actorId:user.id,action:'owner.bootstrapped',resource:'admin_user',resourceId:user.id}});
  return {created:true};
 });
}
