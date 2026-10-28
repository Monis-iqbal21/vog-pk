import {createDatabase} from '../src/security/database.js';
import {hashPassword} from '../src/security/auth.service.js';
import {passwordSchema,validate} from '../src/security/validation.js';
const db=createDatabase();
try{
 const email=process.env.RECOVERY_EMAIL?.trim().toLowerCase(),password=validate(passwordSchema,process.env.RECOVERY_PASSWORD);
 if(!email)throw new Error('Missing recovery target');
 const passwordHash=await hashPassword(password);
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
  const user=await tx.adminUser.update({where:{email},data:{passwordHash}});
  await tx.adminSession.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.auditLog.create({data:{action:'password.operator_recovery',resource:'admin_user',resourceId:user.id}});
 });console.log('Password changed and sessions revoked. No credentials were printed.');
}catch{console.error('Recovery failed; verify operator authorization, inputs and database access.');process.exitCode=1;}finally{delete process.env.RECOVERY_PASSWORD;await db.$disconnect();}
