// Nondestructive integration runner: creates an empty loopback test database.
import {config} from 'dotenv';
import {Client} from 'pg';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
config({path:'.env.local',quiet:true});
let temporary;
try{
 const source=new URL(process.env.TEST_DATABASE_URL??'http://unconfigured');
 if(!['localhost','127.0.0.1'].includes(source.hostname)||!source.pathname.endsWith('_test')||source.href===process.env.DATABASE_URL)throw new Error('Separate local test database required');
 const run=randomBytes(8).toString('hex'),name=`vog_security_${run}_test`;
 const control=new Client({connectionString:source.href});
 try{await control.connect();await control.query(`CREATE DATABASE "${name}"`);}finally{await control.end();}
 source.pathname='/'+name;
 const original=await fs.readFile('scripts/test-security.mjs','utf8');
 const reset=`await db.$executeRawUnsafe('TRUNCATE TABLE "AuditLog", "AdminSession", "AdminUserRole", "RolePermission", "AdminUser", "Role", "Permission", "LoginThrottle" CASCADE');`;
 const exportAccounts=`await fs.writeFile('.local/security-test-accounts.json',JSON.stringify(accounts));`;
 if(!original.includes(reset)||!original.includes(exportAccounts))throw new Error('Test runner changed; review before running');
 const safe=original.replace(reset,`if(await db.adminUser.count()||await db.role.count())throw new Error('Fresh database is not empty');`).replace(exportAccounts,'void accounts; // Do not persist credentials.');
 temporary=`scripts/.security-fresh-${run}.mjs`;
 await fs.writeFile(temporary,safe,{flag:'wx'});
 const result=spawnSync(process.execPath,[temporary],{env:{...process.env,TEST_DATABASE_URL:source.href,HOST:'127.0.0.1',SECURITY_TEST_PORT:'4002'},encoding:'utf8',stdio:'pipe'});
 if(result.status!==0)throw new Error('Security suite failed');
 console.log(result.stdout);
 console.log('Fresh test database retained locally. No existing database was reset; no credentials exported.');
}catch{console.error('Fresh security verification failed; sensitive diagnostics suppressed. Check local database access, free test port and the reviewed test runner.');process.exitCode=1;}
finally{if(temporary)await fs.unlink(temporary).catch(()=>{});}
