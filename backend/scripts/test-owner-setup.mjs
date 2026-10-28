import {randomBytes} from 'node:crypto';
import * as argon2 from 'argon2';
import {createDatabase} from '../dist/security/database.js';
import {hashPassword} from '../dist/security/auth.service.js';
import {configureOwnerAccess} from './setup-owner-access.mjs';
const url=new URL(process.env.TEST_DATABASE_URL??'http://unconfigured');
if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test')||process.env.TEST_DATABASE_URL===process.env.DATABASE_URL)throw new Error('Separate local test database required');
const db=createDatabase(process.env.TEST_DATABASE_URL),run=randomBytes(8).toString('hex'),password=`Os!9${randomBytes(20).toString('hex')}`,nextPassword=`Os!9${randomBytes(20).toString('hex')}`;
let id,checks=0;
const ensure=(value)=>{if(!value)throw new Error('Owner setup security check failed');checks++;};
try{
 const role=await db.role.findUniqueOrThrow({where:{code:'SUPER_ADMIN'}}),oldEmail=`owner-setup-${run}@example.invalid`,email=`owner-ready-${run}@example.invalid`;
 const user=await db.adminUser.create({data:{name:'Setup test',email:oldEmail,passwordHash:await hashPassword(password),roles:{create:{roleId:role.id}}}});id=user.id;
 await db.adminSession.create({data:{userId:id,tokenHash:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+60000)}});
 await configureOwnerAccess(db,{email,password:nextPassword},{id,email:oldEmail});
 const updated=await db.adminUser.findUniqueOrThrow({where:{id},include:{roles:{include:{role:true}}}});
 ensure(updated.email===email);ensure(await argon2.verify(updated.passwordHash,nextPassword));ensure(updated.roles.some(({role})=>role.code==='SUPER_ADMIN'));ensure(await db.adminSession.count({where:{userId:id,revokedAt:null}})===0);ensure(await db.auditLog.count({where:{actorId:id,action:'owner.access_configured'}})===1);
 let refused=false;try{await configureOwnerAccess(db,{email,password:'weak'},{id,email:oldEmail});}catch{refused=true;}ensure(refused);
 refused=false;try{await configureOwnerAccess(db,{email:'different@example.invalid',password:nextPassword},{id,email:'wrong-identity@example.invalid'});}catch{refused=true;}ensure(refused);
 ensure((await db.adminUser.findUniqueOrThrow({where:{id}})).email===email);
 console.log(`Owner setup security checks passed: ${checks}. No credentials printed; only an isolated test record was modified.`);
}catch{console.error('Owner setup security checks failed; sensitive diagnostics suppressed.');process.exitCode=1;}
finally{if(id)await db.adminUser.delete({where:{id}});await db.$disconnect();}
