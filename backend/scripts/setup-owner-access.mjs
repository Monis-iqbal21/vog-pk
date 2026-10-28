// Trusted local operator command. Password input is hidden and never persisted.
import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createDatabase} from '../dist/security/database.js';
import {hashPassword} from '../dist/security/auth.service.js';
import {createStaffSchema} from '../dist/security/validation.js';
import {readVerificationAccounts} from './development-verification-vault.mjs';

class OwnerSetupError extends Error {}
export function validateOwnerFields(input){
 const result=createStaffSchema.safeParse({name:'Store Owner',...input,roles:['SUPER_ADMIN']});
 if(result.success)return result.data;
 if(result.error.issues.some(issue=>issue.path[0]==='email'))throw new OwnerSetupError('Enter a valid email address. No changes made.');
 throw new OwnerSetupError('Password must contain 16–128 characters, uppercase and lowercase letters, a number, and punctuation such as ! or @ (underscore alone does not count). Avoid password, qwerty, letmein and admin123. No changes made.');
}
export async function configureOwnerAccess(db,input,expected){
 const fields=validateOwnerFields(input),passwordHash=await hashPassword(fields.password);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201901)`;
  const owner=await tx.adminUser.findUnique({where:{id:expected.id},include:{roles:{include:{role:true}}}});
  if(!owner?.active||!owner.roles.some(({role})=>role.code==='SUPER_ADMIN')||![expected.email,fields.email].includes(owner.email))throw new OwnerSetupError('Owner identity changed; no changes made');
  const collision=await tx.adminUser.findUnique({where:{email:fields.email}});
  if(collision&&collision.id!==owner.id)throw new OwnerSetupError('Email already assigned; no changes made');
  await tx.adminUser.update({where:{id:owner.id},data:{name:fields.name,email:fields.email,passwordHash}});
  await tx.adminSession.updateMany({where:{userId:owner.id,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.auditLog.create({data:{actorId:owner.id,action:'owner.access_configured',resource:'admin_user',resourceId:owner.id,metadata:{operatorLocalSetup:true}}});
 });
}
function hiddenInput(prompt){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw new OwnerSetupError('Run this command in an interactive PowerShell terminal so the password can be entered privately.');
 process.stdout.write(prompt);
 const silent=new Writable({write(_chunk,_encoding,done){done();}});
 const reader=createInterface({input:process.stdin,output:silent,terminal:true});
 return new Promise((resolve,reject)=>{
  reader.once('SIGINT',()=>{reader.close();process.stdout.write('\n');reject(new OwnerSetupError('Cancelled. No changes made.'));});
  reader.question('',answer=>{reader.close();process.stdout.write('\n');resolve(answer);});
 });
}
async function main(){
 const args=process.argv.slice(2),index=args.indexOf('--email'),email=args[index+1]?.trim().toLowerCase();
 if(index<0||!email)throw new OwnerSetupError('Provide --email for your owner login');
 const url=new URL(process.env.DATABASE_URL??'http://unconfigured');
 if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_dev'))throw new OwnerSetupError('This setup command is restricted to the local development database');
 const vault=await readVerificationAccounts(),db=createDatabase();
 let password='',confirmation='';
 try{
  const owner=await db.adminUser.findUnique({where:{id:vault.owner.id},include:{roles:{include:{role:true}}}});
  if(!owner?.active||!owner.roles.some(({role})=>role.code==='SUPER_ADMIN')||![vault.owner.email,email].includes(owner.email))throw new OwnerSetupError('Expected local owner not found; no changes made');
  if(args.includes('--check-only')){console.log('Local owner setup is ready. No account or password was changed.');return;}
  console.log('Set your owner password privately. Characters are hidden; nothing is written to a credential file.');
  console.log('Use 16–128 characters with uppercase, lowercase, a number and a symbol.');
  password=await hiddenInput('New password: ');confirmation=await hiddenInput('Confirm password: ');
  if(password!==confirmation)throw new OwnerSetupError('Passwords did not match; no changes made');
  await configureOwnerAccess(db,{email,password},vault.owner);
  console.log('Owner login configured. Previous sessions revoked. Sign in at http://localhost:3001/login.');
 }finally{password='';confirmation='';await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main().catch(error=>{console.error(error instanceof OwnerSetupError?error.message:'Owner setup could not access its local database or protected setup data. Ensure the local database is running and use the same Windows account. Sensitive diagnostics suppressed.');process.exitCode=1;});
