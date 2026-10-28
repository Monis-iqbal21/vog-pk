const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base='http://localhost:3001';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const root=await context.request.get(base,{maxRedirects:0});assert.equal(root.status(),307);assert.equal(root.headers().location,'/login');
  await page.goto(base);assert.equal(new URL(page.url()).pathname,'/login');assert.ok(await page.getByRole('heading',{name:'Welcome to VOGPK Admin',exact:true}).isVisible());
  await page.goto(base+'/login');await page.reload();assert.equal(new URL(page.url()).pathname,'/login');
  const destinations=['/dashboard','/products','/categories','/variants','/media','/homepage','/coupons','/orders','/settings','/staff','/audit-logs'];
  for(const path of destinations){
   const response=await context.request.get(base+path,{maxRedirects:0,headers:{'x-vog-admin-return-to':'https://evil.invalid'}});assert.equal(response.status(),307,path);
   const target=new URL(response.headers().location,base);assert.equal(target.origin,base);assert.equal(target.pathname,'/login');assert.equal(target.searchParams.get('returnTo')??'/dashboard',path);
   const login=await context.request.get(target.href,{maxRedirects:0});assert.equal(login.status(),200,'No login redirect loop');assert.match(login.headers()['x-robots-tag'],/noindex/);assert.match(login.headers()['cache-control'],/no-store/);
  }
  await context.addCookies([{name:'vog_admin_session_dev',value:'0'.repeat(64),url:base,httpOnly:true,sameSite:'Strict'}]);
  await page.goto(base+'/orders?view=compact');assert.equal(new URL(page.url()).pathname,'/login');assert.equal(new URL(page.url()).searchParams.get('returnTo'),'/orders?view=compact');
  assert.equal((await context.request.get(base+'/api/admin/staff')).status(),401);
  const storefront=await context.request.get('http://localhost:3000/');assert.equal(storefront.status(),200);assert.ok((await storefront.text()).includes('featured-track'));assert.equal((await context.request.get('http://localhost:3000/admin/login')).status(),404);
  assert.equal(errors.length,0,errors.join('\n'));
  const report={passed:true,anonymousRoot:'/login',directLogin200:true,protectedRoutes:destinations.length,validatedReturnPaths:true,spoofedContextHeaderOverwritten:true,invalidCookieRejected:true,loginRefresh:true,noRedirectLoops:true,unauthenticatedApi401:true,noindexNoStore:true,storefrontUnaffected:true,pageErrors:errors,authenticatedBrowserRetest:'This suite tests anonymous routing. See live-auth-verification.json and commit-auth-verification.json for separate real authenticated browser evidence using the approved development API.'};
  await fs.mkdir('docs',{recursive:true});await fs.writeFile('docs/routing-http-verification.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
