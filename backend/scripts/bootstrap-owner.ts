import {createDatabase} from '../src/security/database.js';
import {bootstrapOwner,seedSecurity} from '../src/security/provision.js';
const db=createDatabase();
try{
 const {OWNER_NAME:name,OWNER_EMAIL:email,OWNER_PASSWORD:password}=process.env;
 if(!name||!email||!password)throw new Error('Set OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD securely in this shell');
 await seedSecurity(db);const result=await bootstrapOwner(db,{name,email,password});
 console.log(result.created?'Owner provisioned. Credentials were not printed.':'An owner already exists. No account was overwritten.');
}catch{console.error('Owner provisioning did not complete. Check required inputs, password policy and database access.');process.exitCode=1;}finally{delete process.env.OWNER_PASSWORD;await db.$disconnect();}
