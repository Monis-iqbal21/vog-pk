// Real PostgreSQL + HTTP integration tests. Refuses every non-loopback/non-test DB.
import {config} from 'dotenv';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
const testUrl=process.env.TEST_DATABASE_URL;
if(!testUrl)throw new Error('TEST_DATABASE_URL is required');
const parsed=new URL(testUrl);
if(!['localhost','127.0.0.1'].includes(parsed.hostname)||!parsed.pathname.endsWith('_test')||testUrl===process.env.DATABASE_URL)throw new Error('Tests require a separate loopback database with a _test suffix');
process.env.DATABASE_URL=testUrl;
execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:process.env,stdio:'pipe'});
const {createDatabase}=await import('../dist/security/database.js');
const {bootstrapOwner,seedSecurity}=await import('../dist/security/provision.js');
const {hashPassword,hashToken}=await import('../dist/security/auth.service.js');
const db=createDatabase(testUrl),port=Number(process.env.SECURITY_TEST_PORT??4000),base=`http://127.0.0.1:${port}`;
await db.$executeRawUnsafe('TRUNCATE TABLE "AuditLog", "AdminSession", "AdminUserRole", "RolePermission", "AdminUser", "Role", "Permission", "LoginThrottle" CASCADE');
let checks=0,server;
const accounts={};
const password=()=>`Test!9${randomBytes(20).toString('hex')}`;
const test=async(name,run)=>{await run();checks++;console.log(`PASS ${name}`);};
const call=async(path,{method='GET',token,body,key=true,origin,ip='test-network'}={})=>{
 const headers={'Content-Type':'application/json','x-admin-client-ip':ip};if(key)headers['x-admin-bff-key']=process.env.BFF_SHARED_SECRET;if(token)headers.Authorization='Bearer '+token;if(origin)headers.Origin=origin;
 const response=await fetch(base+'/api/admin/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),headers:response.headers};
};
try{
 await test('Idempotent default role/permission seed',async()=>{await seedSecurity(db);await seedSecurity(db);assert.equal(await db.role.count(),6);assert.equal(await db.permission.count(),27);});
 accounts.owner={name:'Test Owner',email:'owner@example.invalid',password:password()};
 await test('One-time owner bootstrap cannot overwrite or duplicate',async()=>{
  const outcomes=await Promise.all([bootstrapOwner(db,accounts.owner),bootstrapOwner(db,{name:'Other Owner',email:'other@example.invalid',password:password()})]);assert.equal(outcomes.filter(result=>result.created).length,1);
  // Whichever concurrent bootstrap won is the account used by this isolated run.
  const owner=await db.adminUser.findFirstOrThrow({where:{roles:{some:{role:{code:'SUPER_ADMIN'}}}}});
  if(owner.email!==accounts.owner.email){await db.adminUser.update({where:{id:owner.id},data:{email:accounts.owner.email,name:accounts.owner.name,passwordHash:await hashPassword(accounts.owner.password)}});}
  const before=await db.adminUser.findUniqueOrThrow({where:{email:accounts.owner.email}});assert.equal((await bootstrapOwner(db,{...accounts.owner,password:password()})).created,false);assert.equal((await db.adminUser.findUniqueOrThrow({where:{id:before.id}})).passwordHash,before.passwordHash);
 });
 await test('Weak owner password rejected',async()=>{await assert.rejects(()=>bootstrapOwner(db,{name:'Weak Owner',email:'weak@example.invalid',password:'password'}));});
 server=spawn(process.execPath,['dist/main.js'],{env:{...process.env,NODE_ENV:'test',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let exited=false;server.on('exit',()=>{exited=true;});
 for(let index=0;index<100;index++){if(exited)throw new Error('Test API exited before startup');try{if((await fetch(base+'/api/health')).status===200)break;}catch{}if(index===99)throw new Error('Test API startup timed out');await new Promise(resolve=>setTimeout(resolve,100));}
 await test('Public health remains available',async()=>assert.deepEqual(await (await fetch(base+'/api/health')).json(),{status:'ok'}));
 await test('No BFF key / no session returns 401',async()=>{assert.equal((await call('auth/me',{key:false})).status,401);assert.equal((await call('staff')).status,401);assert.equal((await call('auth/login',{method:'POST',key:false,body:accounts.owner})).status,401);});
 await test('Hostile Origin rejected even with a valid bridge key',async()=>assert.equal((await call('auth/me',{origin:'https://hostile.invalid'})).status,403));
 const signIn=async(account,ip)=>call('auth/login',{method:'POST',body:{email:account.email,password:account.password},ip});
 const ownerLogin=await signIn(accounts.owner);assert.equal(ownerLogin.status,201);let ownerToken=ownerLogin.body.token;const ownerId=ownerLogin.body.user.id;
 await test('Real owner login + safe identity',async()=>{assert.ok(/^[a-f0-9]{64}$/.test(ownerToken));assert.equal(ownerLogin.body.user.permissions.length,27);assert.equal(ownerLogin.body.user.passwordHash,undefined);assert.equal(ownerLogin.body.user.tokenHash,undefined);assert.equal((await call('auth/me',{token:ownerToken})).status,200);});
 await test('Stored credentials are Argon2id / SHA-256 hashes',async()=>{const user=await db.adminUser.findUniqueOrThrow({where:{id:ownerId}});assert.match(user.passwordHash,/^\$argon2id\$/);assert.notEqual(user.passwordHash,accounts.owner.password);const session=await db.adminSession.findUniqueOrThrow({where:{tokenHash:hashToken(ownerToken)}});assert.notEqual(session.tokenHash,ownerToken);});
 await test('Unknown email and wrong password use same generic response',async()=>{const wrong=await signIn({...accounts.owner,password:'wrong'}),unknown=await signIn({email:'unknown@example.invalid',password:'wrong'});assert.equal(wrong.status,401);assert.deepEqual(wrong.body,unknown.body);});
 for(const role of ['STORE_MANAGER','CATALOG_MANAGER','ORDER_MANAGER','MARKETING_MANAGER','VIEWER']){
  const account={name:`Test ${role}`,email:`${role.toLowerCase()}@example.invalid`,password:password()};accounts[role]=account;
  const created=await call('staff',{method:'POST',token:ownerToken,body:{...account,roles:[role]}});assert.equal(created.status,201);account.id=created.body.id;
  account.token=(await signIn(account)).body.token;
 }
 await test('Owner staff creation validates roles and strong credentials',async()=>{assert.equal((await call('staff',{method:'POST',token:ownerToken,body:{name:'Bad',email:'bad@example.invalid',password:'weak',roles:['VIEWER']}})).status,400);assert.equal((await call('staff',{method:'POST',token:ownerToken,body:{name:'Bad',email:'bad@example.invalid',password:password(),roles:['UNDECLARED']}})).status,403);assert.equal((await call('staff',{method:'POST',token:ownerToken,body:{...accounts.VIEWER,roles:['VIEWER'],token:'injected'}})).status,400);});
 await test('Unauthorized roles cannot access or mutate staff directly',async()=>{for(const code of ['STORE_MANAGER','CATALOG_MANAGER','ORDER_MANAGER','MARKETING_MANAGER','VIEWER']){const token=accounts[code].token;assert.equal((await call('staff',{token})).status,403,code);assert.equal((await call('staff/'+ownerId,{method:'PATCH',token,body:{roles:['SUPER_ADMIN']}})).status,403,code);assert.equal((await call('staff',{method:'POST',token,body:{...accounts.owner,email:'elevate@example.invalid',roles:['SUPER_ADMIN']}})).status,403,code);}});
 await test('Viewer has read-only permissions, Order Manager has no products/refunds',async()=>{const viewer=(await call('auth/me',{token:accounts.VIEWER.token})).body;assert.ok(viewer.permissions.every(code=>code.endsWith('.view')));const order=(await call('auth/me',{token:accounts.ORDER_MANAGER.token})).body;assert.equal(order.permissions.includes('products.update'),false);assert.equal(order.permissions.some(code=>code.includes('refund')||code.includes('payment')),false);});
 await test('Multiple roles union permissions through database records',async()=>{const updated=await call('staff/'+accounts.CATALOG_MANAGER.id,{method:'PATCH',token:ownerToken,body:{roles:['CATALOG_MANAGER','ORDER_MANAGER']}});assert.equal(updated.status,200);const current=(await signIn(accounts.CATALOG_MANAGER)).body.user;assert.ok(current.permissions.includes('products.update'));assert.ok(current.permissions.includes('orders.manage'));assert.equal(current.permissions.includes('staff.manage'),false);});
 await test('Role change revokes prior sessions immediately',async()=>assert.equal((await call('auth/me',{token:accounts.CATALOG_MANAGER.token})).status,401));
 await test('No self-permission / account status changes',async()=>{for(const body of [{roles:['VIEWER']},{active:false}])assert.equal((await call('staff/'+ownerId,{method:'PATCH',token:ownerToken,body})).status,403);});
 await test('Current database permissions override stale session claims',async()=>{const role=await db.role.findUniqueOrThrow({where:{code:'SUPER_ADMIN'}}),permission=await db.permission.findUniqueOrThrow({where:{code:'staff.view'}});await db.rolePermission.delete({where:{roleId_permissionId:{roleId:role.id,permissionId:permission.id}}});assert.equal((await call('staff',{token:ownerToken})).status,403);await db.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});assert.equal((await call('staff',{token:ownerToken})).status,200);});
 await test('Last active owner cannot lose ownership through another authorized admin',async()=>{
  const role=await db.role.create({data:{code:'TEST_SECURITY_DELEGATE',name:'Test delegate',description:'Test only',permissions:{create:(await db.permission.findMany()).map(permission=>({permissionId:permission.id}))}}});
  const delegate=await db.adminUser.create({data:{name:'Test Delegate',email:'delegate@example.invalid',passwordHash:await hashPassword(accounts.owner.password),roles:{create:{roleId:role.id}}}});
  const token=(await signIn({email:delegate.email,password:accounts.owner.password})).body.token;
  assert.equal((await call('staff/'+ownerId,{method:'PATCH',token,body:{active:false}})).status,409);assert.equal((await call('staff/'+ownerId,{method:'PATCH',token,body:{roles:['VIEWER']}})).status,409);
  await db.adminUser.update({where:{id:delegate.id},data:{active:false}});
 });
 await test('Disabled user cannot log in and existing session is revoked',async()=>{assert.equal((await call('staff/'+accounts.VIEWER.id,{method:'PATCH',token:ownerToken,body:{active:false}})).status,200);assert.equal((await call('auth/me',{token:accounts.VIEWER.token})).status,401);assert.equal((await signIn(accounts.VIEWER)).status,401);await call('staff/'+accounts.VIEWER.id,{method:'PATCH',token:ownerToken,body:{active:true}});});
 await test('Absolute session expiry enforced in the backend',async()=>{const token=(await signIn(accounts.ORDER_MANAGER)).body.token;await db.adminSession.update({where:{tokenHash:hashToken(token)},data:{expiresAt:new Date(Date.now()-1000)}});assert.equal((await call('auth/me',{token})).status,401);});
 await test('Idle session expiry enforced in the backend',async()=>{const token=(await signIn(accounts.ORDER_MANAGER)).body.token;await db.adminSession.update({where:{tokenHash:hashToken(token)},data:{lastActivityAt:new Date(Date.now()-31*60000)}});assert.equal((await call('auth/me',{token})).status,401);});
 await test('Logout revokes database session, replay fails',async()=>{const token=(await signIn(accounts.MARKETING_MANAGER)).body.token;assert.equal((await call('auth/logout',{method:'POST',token,body:{}})).status,201);assert.equal((await call('auth/me',{token})).status,401);});
 await test('No public registration endpoint',async()=>assert.equal((await call('auth/register',{method:'POST',body:{}})).status,404));
 await test('Login rate limiting persists in PostgreSQL',async()=>{for(let i=0;i<10;i++)assert.equal((await signIn({email:'rate@example.invalid',password:'wrong'},'rate-test')).status,401);assert.equal((await signIn({email:'rate@example.invalid',password:'wrong'},'rate-test')).status,429);});
 await test('Security audit events omit passwords and raw session tokens',async()=>{const events=await db.auditLog.findMany();for(const action of ['auth.login_succeeded','auth.login_failed','auth.logout','authorization.denied','staff.created','staff.access_changed','auth.rate_limited','owner.bootstrapped'])assert.ok(events.some(event=>event.action===action),action);const text=JSON.stringify(events);assert.equal(text.includes(accounts.owner.password),false);assert.equal(text.includes(ownerToken),false);});
 await test('Sensitive API routes are no-store and noindex',async()=>{const result=await call('auth/me',{token:ownerToken});assert.equal(result.headers.get('cache-control'),'no-store');assert.match(result.headers.get('x-robots-tag'),/noindex/);});
 // Restore one original role per test principal for browser permission checks.
 for(const code of ['STORE_MANAGER','CATALOG_MANAGER','ORDER_MANAGER','MARKETING_MANAGER','VIEWER'])await call('staff/'+accounts[code].id,{method:'PATCH',token:ownerToken,body:{roles:[code],active:true}});
 await db.loginThrottle.deleteMany();
 for(const value of Object.values(accounts))delete value.token;
 await fs.mkdir('.local',{recursive:true});await fs.writeFile('.local/security-test-accounts.json',JSON.stringify(accounts));
 await fs.mkdir('docs',{recursive:true});await fs.writeFile('docs/security-verification.json',JSON.stringify({passed:true,checks,database:'isolated PostgreSQL test database',defaultRoles:6,permissions:27,storedPasswordHash:'Argon2id 64 MiB / 3 passes / 1 lane',sessions:'Opaque 256-bit tokens, SHA-256 at rest',apiPort:port},null,2)+'\n');
 console.log(`Security integration suite passed: ${checks} checks. No credentials printed.`);
 if(process.argv.includes('--keep-server')){console.log('Isolated test API remains running for browser verification.');await db.$disconnect();setInterval(()=>{},60000);}else server.kill();
}catch(error){server?.kill();throw error;}finally{await db.$disconnect();}
