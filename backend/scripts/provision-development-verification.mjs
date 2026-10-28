import {config} from 'dotenv';
import {randomBytes} from 'node:crypto';
import {createDatabase} from '../dist/security/database.js';
import {bootstrapOwner} from '../dist/security/provision.js';
import {readVerificationAccounts,writeVerificationAccounts,verifyVault} from './development-verification-vault.mjs';
config({path:'.env.local',quiet:true});
const url=new URL(process.env.DATABASE_URL??'http://unconfigured');
if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_dev')||Number(process.env.PORT??4000)!==4000)throw new Error('Use only the approved loopback development database and API port');
const db=createDatabase(),base='http://localhost:4000/api/admin';
let token;
const request=async(path,method='GET',body)=>{
 const response=await fetch(`${base}/${path}`,{method,headers:{'Content-Type':'application/json','x-admin-bff-key':process.env.BFF_SHARED_SECRET,...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json();if(!response.ok)throw new Error('Secure development provisioning request failed');return result;
};
try{
 verifyVault();
 let accounts;try{accounts=await readVerificationAccounts();}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!accounts){
  const existing=await db.adminUser.findFirst({where:{roles:{some:{role:{code:'SUPER_ADMIN'}}}}});
  if(existing)throw new Error('An existing owner must authorize verification provisioning; no existing account was changed');
  const runId=randomBytes(6).toString('hex'),make=(role)=>({name:`Development verification ${role}`,email:`dev-verify-${runId}-${role.toLowerCase()}@example.invalid`,password:`Dv!9${randomBytes(24).toString('hex')}`});
  accounts={runId,owner:make('SUPER_ADMIN')};
  const outcome=await bootstrapOwner(db,accounts.owner);if(!outcome.created)throw new Error('Owner bootstrap refused; no existing owner was overwritten');
  accounts.owner.id=(await db.adminUser.findUniqueOrThrow({where:{email:accounts.owner.email}})).id;
  await writeVerificationAccounts(accounts);
 }
 const owner=await db.adminUser.findUniqueOrThrow({where:{id:accounts.owner.id}});if(owner.email!==accounts.owner.email||!owner.email.startsWith(`dev-verify-${accounts.runId}-`))throw new Error('Verification vault identity mismatch');
 token=(await request('auth/login','POST',{email:accounts.owner.email,password:accounts.owner.password})).token;
 for(const role of ['STORE_MANAGER','CATALOG_MANAGER','ORDER_MANAGER','MARKETING_MANAGER','VIEWER']){
  if(accounts[role]){await request('staff/'+accounts[role].id,'PATCH',{roles:[role],active:true});continue;}
  const account={name:`Development verification ${role}`,email:`dev-verify-${accounts.runId}-${role.toLowerCase()}@example.invalid`,password:`Dv!9${randomBytes(24).toString('hex')}`};
  const created=await request('staff','POST',{...account,roles:[role]});accounts[role]={...account,id:created.id};await writeVerificationAccounts(accounts);
 }
 await request('auth/logout','POST',{});token=undefined;
 console.log('Six real development verification accounts provisioned through the existing bootstrap/staff services. Credentials encrypted with current-user DPAPI; none printed.');
}catch{console.error('Development verification provisioning failed; no credentials were printed. Inspect authorized local setup without overwriting existing staff.');process.exitCode=1;}
finally{if(token)await request('auth/logout','POST',{}).catch(()=>{});await db.$disconnect();}
