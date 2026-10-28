const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const base='http://localhost:3001';
(async()=>{
 const accounts=JSON.parse(await fs.readFile(path.resolve('../backend/.local/security-test-accounts.json'),'utf8'));
 const env=Object.fromEntries((await fs.readFile('../backend/.env.local','utf8')).split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
 assert.ok(new URL(env.TEST_DATABASE_URL).pathname.endsWith('_test'));
 process.env.DATABASE_URL=env.TEST_DATABASE_URL;
 const {createDatabase}=await import(pathToFileURL(path.resolve('../backend/dist/security/database.js')).href);const db=createDatabase(env.TEST_DATABASE_URL);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[],checks=[],responsive=[],evidence=path.join(os.tmpdir(),'vog-admin');await fs.mkdir(evidence,{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const signIn=async(page,account)=>{await page.goto(base+'/login');await page.getByLabel('Email address',{exact:true}).fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:new RegExp('^Welcome,')}).waitFor();};
 try{
  await page.goto(base);assert.equal(new URL(page.url()).pathname,'/login');await page.goto(base+'/staff');assert.equal(new URL(page.url()).pathname,'/login');assert.equal(new URL(page.url()).searchParams.get('returnTo'),'/staff');
  assert.equal((await context.request.get(base+'/api/admin/staff')).status(),401);
  assert.equal((await context.request.post(base+'/api/admin/auth/login',{data:{email:accounts.owner.email,password:accounts.owner.password}})).status(),403,'Missing Origin/CSRF rejected');
  assert.equal((await context.request.get(base+'/api/auth/csrf',{headers:{Origin:'https://hostile.invalid'}})).status(),403);
  await page.getByLabel('Email address',{exact:true}).fill(accounts.owner.email);await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.locator('.form-error').waitFor();assert.match(await page.locator('.form-error').textContent(),/Invalid email or password/);
  await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');await page.getByRole('button',{name:'Hide password',exact:true}).click();
  checks.push({authenticationRedirects:true,genericWrongPassword:true,csrfRequired:true,passwordVisibility:true});
  const loginContext=await browser.newContext({reducedMotion:'reduce'}),loginPage=await loginContext.newPage();
  for(const width of [1920,1440,1024,768,390,320]){await loginPage.setViewportSize({width,height:900});await loginPage.goto(base+'/login');assert.equal(await loginPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await loginPage.screenshot({path:path.join(evidence,`login-${width}.png`),fullPage:true});responsive.push({page:'login',width,noOverflow:true});}
  await loginContext.close();
  await signIn(page,accounts.owner);await page.goto(base);assert.equal(new URL(page.url()).pathname,'/dashboard');await page.goto(base+'/login');assert.equal(new URL(page.url()).pathname,'/dashboard');
  const cookies=await context.cookies(),session=cookies.find(cookie=>cookie.name==='vog_admin_session_dev');assert.ok(session?.httpOnly);assert.equal(session.sameSite,'Strict');assert.equal(session.path,'/');assert.equal(session.domain,'localhost');
  assert.equal(await page.evaluate(()=>document.cookie.includes('vog_admin_session')),false);assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal((await page.content()).includes(session.value),false);
  const safeMe=await context.request.get(base+'/api/admin/auth/me');const me=await safeMe.json();assert.equal(me.passwordHash,undefined);assert.equal(me.tokenHash,undefined);assert.match(safeMe.headers()['x-robots-tag'],/noindex/);assert.equal(safeMe.headers()['cache-control'],'no-store');
  assert.equal((await context.request.post(base+'/api/admin/staff',{headers:{Origin:'https://hostile.invalid','x-csrf-token':'0'.repeat(64)},data:{}})).status(),403);
  checks.push({realCookieSession:true,hostOnly:true,httpOnly:true,sameSiteStrict:true,noLocalStorage:true,noTokenInMarkup:true,noindexAndNoStore:true});
  for(const route of ['dashboard','products','categories','variants','media','homepage','coupons','orders','settings','staff','audit-logs']){await page.goto(base+'/'+route);assert.equal(await page.getByRole('heading',{name:'Access Denied',exact:true}).count(),0);if(!['dashboard','staff','audit-logs'].includes(route))assert.ok(await page.getByText('Foundation ready',{exact:true}).isVisible());}
  await page.goto(base+'/dashboard');await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();assert.equal(await page.locator('.admin-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width)),80);await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();assert.equal(await page.locator('.admin-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width)),250);
  for(const width of [1920,1440,1024,768,390,320]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/dashboard');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(width<1024){const trigger=page.getByRole('button',{name:'Open sidebar',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'VOGPK Admin',exact:true});assert.ok(await dialog.isVisible());assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Shift+Tab');assert.equal(await dialog.getByRole('link').last().evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Close sidebar',exact:true}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);await trigger.click();await dialog.getByRole('link',{name:'Products',exact:true}).click();await page.waitForURL('**/products');assert.equal(await dialog.isVisible(),false);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');await page.goto(base+'/dashboard');}
   await page.screenshot({path:path.join(evidence,`dashboard-${width}.png`),fullPage:true});responsive.push({page:'dashboard',width,noOverflow:true,sidebar:true});
  }
  await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/staff');
  const self=page.locator('.staff-account').filter({hasText:accounts.owner.email});assert.equal(await self.getByRole('button',{name:'Save access',exact:true}).count(),0);
  const creation=page.locator('.staff-create'),newEmail='browser-created@example.invalid',newPassword='UiTest!9'+require('node:crypto').randomBytes(18).toString('hex');
  await creation.getByLabel('Name',{exact:true}).fill('Browser Test Staff');await creation.getByLabel('Email address',{exact:true}).fill(newEmail);await creation.getByLabel('Initial password',{exact:true}).fill(newPassword);await creation.getByRole('button',{name:'Create staff account',exact:true}).click();
  const created=page.locator('.staff-account').filter({hasText:newEmail});await created.waitFor();await created.getByLabel('Account enabled',{exact:true}).uncheck();await created.getByRole('button',{name:'Save access',exact:true}).click();await created.getByText('Disabled',{exact:true}).waitFor();
  checks.push({ownerPages:11,sidebarCollapse:true,mobileModal:true,staffCreationAndDisable:true,selfChangesUnavailable:true});
  for(const code of ['STORE_MANAGER','CATALOG_MANAGER','ORDER_MANAGER','MARKETING_MANAGER','VIEWER']){
   const roleContext=await browser.newContext({viewport:{width:1440,height:1000}}),rolePage=await roleContext.newPage();rolePage.on('pageerror',error=>errors.push(error.message));
   await signIn(rolePage,accounts[code]);assert.equal(await rolePage.locator('.admin-sidebar').getByRole('link',{name:'Staff & Roles',exact:true}).count(),0);
   await rolePage.goto(base+'/staff');assert.ok(await rolePage.getByRole('heading',{name:'Access Denied',exact:true}).isVisible());assert.equal((await roleContext.request.get(base+'/api/admin/staff')).status(),403);
   if(code==='ORDER_MANAGER'){await rolePage.goto(base+'/products');assert.ok(await rolePage.getByRole('heading',{name:'Access Denied',exact:true}).isVisible());}
   if(code==='VIEWER'){const record=await db.adminUser.findUniqueOrThrow({where:{email:accounts[code].email}});await db.adminUser.update({where:{id:record.id},data:{active:false}});await rolePage.goto(base+'/dashboard');assert.equal(new URL(rolePage.url()).pathname,'/login');await db.adminUser.update({where:{id:record.id},data:{active:true}});}
   checks.push({role:code,permissionNavigation:true,directRestrictedPageDenied:true,directApi403:true});await roleContext.close();
  }
  // Revoke/expiry checks use the isolated test DB and current browser credential.
  await db.adminSession.update({where:{tokenHash:createHash('sha256').update(session.value).digest('hex')},data:{expiresAt:new Date(Date.now()-1000)}});
  await page.goto(base+'/dashboard');assert.equal(new URL(page.url()).pathname,'/login');
  await signIn(page,accounts.owner);const finalSession=(await context.cookies()).find(cookie=>cookie.name==='vog_admin_session_dev');
  await page.locator('.profile-menu summary').click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');assert.equal((await context.cookies()).some(cookie=>cookie.name==='vog_admin_session_dev'),false);
  assert.ok((await db.adminSession.findUniqueOrThrow({where:{tokenHash:createHash('sha256').update(finalSession.value).digest('hex')}})).revokedAt);
  await page.goto(base+'/dashboard');assert.equal(new URL(page.url()).pathname,'/login');assert.equal(errors.length,0,errors.join('\n'));
  // Preserve a permitted protected destination through the real login form.
  await page.goto(base+'/staff');assert.equal(new URL(page.url()).searchParams.get('returnTo'),'/staff');
  await page.getByLabel('Email address',{exact:true}).fill(accounts.owner.email);await page.getByLabel('Password',{exact:true}).fill(accounts.owner.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/staff');
  await page.locator('.profile-menu summary').click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');
  // Reject an external destination through the real login form as well.
  await page.goto(base+'/login?returnTo=https%3A%2F%2Fevil.invalid');await page.getByLabel('Email address',{exact:true}).fill(accounts.owner.email);await page.getByLabel('Password',{exact:true}).fill(accounts.owner.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');assert.equal(new URL(page.url()).origin,base);
  const chunks=await fs.readdir('.next/static/chunks');for(const file of chunks.filter(file=>file.endsWith('.js'))){const text=await fs.readFile(path.join('.next/static/chunks',file),'utf8');assert.equal(text.includes(env.BFF_SHARED_SECRET),false);assert.equal(text.includes(env.LOCAL_POSTGRES_PASSWORD),false);}
  const report={passed:true,authentication:true,csrf:true,permissionChecks:checks,responsiveChecks:responsive.length,responsive,expirationRedirect:true,serverLogoutRevocation:true,noPublicSecrets:true,pageErrors:errors,evidenceDirectory:evidence};await fs.mkdir('docs',{recursive:true});await fs.writeFile('docs/browser-verification.json',JSON.stringify(report,null,2)+'\n');console.log({...report,permissionChecks:checks.length,responsive:responsive.length});
 }finally{await db.$disconnect();await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
