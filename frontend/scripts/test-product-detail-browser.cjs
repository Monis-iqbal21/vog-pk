const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const base=process.env.VOG_BASE_URL||'http://localhost:3000';
const fixtures=process.argv.includes('--fixtures');
const output=path.join(os.tmpdir(),'vog-product-details');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const {products,productCategories}=await import(pathToFileURL(path.resolve(__dirname,'../src/data/products.js')).href);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[],checks=[];await fs.mkdir(output,{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(fixtures){
   const result=await require('./test-product-variants-browser.cjs').runVariantFixtureChecks({page,base,output});
   assert.equal(errors.length,0,errors.join('\n'));
   const report={...result,pageErrors:errors,evidenceDirectory:output};
   await fs.writeFile(path.resolve(__dirname,'../docs/product-detail-fixture-verification.json'),JSON.stringify(report,null,2)+'\n');
   console.log(report);return;
  }
  // Parse detached HTML from every route: verifies server rendering and metadata,
  // without hydrating 84 full pages or issuing unnecessary image downloads.
  let routes=0,redirects=0;
  for(const product of products){
   const response=await context.request.get(base+'/products/'+product.slug);assert.equal(response.status(),200,product.slug);
   const html=await response.text();
   const actual=await page.evaluate(html=>{
    const doc=new DOMParser().parseFromString(html,'text/html');
    return {id:doc.querySelector('[data-product-id]')?.getAttribute('data-product-id'),name:doc.querySelector('.pd-info h1')?.textContent,title:doc.title,description:doc.querySelector('meta[name="description"]')?.content,canonical:doc.querySelector('link[rel="canonical"]')?.href,og:doc.querySelector('meta[property="og:image"]')?.content,price:doc.querySelector('[data-product-price]')?.textContent,rows:[...doc.querySelectorAll('#product-specifications [data-spec-key]')].map(row=>[row.getAttribute('data-spec-key'),row.querySelector('dd').textContent]),json:JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)};
   },html);
   assert.equal(actual.id,product.id);assert.equal(actual.name,product.name);assert.match(actual.title,new RegExp(product.brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(actual.description,product.shortDescription);
   assert.equal(actual.canonical,'https://vogpk.vercel.app/products/'+product.slug);assert.ok(actual.og.startsWith('https://vogpk.vercel.app/images/products/'));
   assert.equal(actual.json.name,product.name);assert.equal(actual.json.offers,undefined);assert.equal(actual.json.aggregateRating,undefined);assert.equal(actual.json.review,undefined);
   assert.deepEqual(Object.fromEntries(actual.rows),Object.fromEntries(Object.entries(product.specifications).map(([k,v])=>[k,String(v)])),product.slug+' specifications');
   assert.ok(actual.price.includes(new Intl.NumberFormat('en-PK').format(product.referencePricePKR)));
   const legacy=await context.request.get(base+'/products/'+product.category+'/'+product.slug,{maxRedirects:0});assert.equal(legacy.status(),308);assert.equal(legacy.headers().location,'/products/'+product.slug);
   routes++;redirects++;
  }
  assert.equal((await context.request.get(base+'/products/no-such-hardware-product')).status(),404);
  assert.equal((await context.request.get(base+'/products/processors/rog-strix-rtx5070ti-o16g')).status(),404);
  assert.equal((await context.request.get(base+'/dev/product-fixtures/keyboard')).status(),404,'Development fixture is inaccessible in production');
  assert.equal((await context.request.get(base+'/dev/product-fixtures/media/poster.svg')).status(),404);
  const representatives=productCategories.map(c=>products.find(p=>p.category===c.slug));
  for(const width of [1440,1280,1024,768,430,390,375,320]){
   await page.setViewportSize({width,height:1000});
   for(const product of representatives){
    await page.goto(base+'/products/'+product.slug,{waitUntil:'domcontentloaded'});
    await page.locator('[data-product-interactive="true"]').waitFor();
    await page.locator('.pd-main-image img').evaluate(i=>i.decode());
    assert.equal(await page.locator('.pd-options').count(),0);
    assert.ok(await page.getByRole('button',{name:'Add to Cart',exact:true}).isDisabled());
    const related=page.locator('#related-track .product-card-link');assert.equal(await related.count(),6);
    for(const href of await related.evaluateAll(a=>a.map(x=>x.getAttribute('href'))))assert.notEqual(href,'/products/'+product.slug);
    if([1440,390].includes(width))for(const card of await related.all()){await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(image=>image.decode());}
    const thumbs=page.locator('.pd-thumbnail');
    if(await thumbs.count()>1){
     await thumbs.nth(1).click();await page.locator('.pd-main-image img').evaluate(i=>i.decode());assert.equal(await thumbs.nth(1).getAttribute('aria-pressed'),'true');
     await thumbs.nth(1).press('ArrowLeft');assert.equal(await thumbs.first().getAttribute('aria-pressed'),'true');
    }
    await page.locator('.pd-main-image').click();assert.ok(await page.locator('.pd-lightbox').isVisible());
    await page.keyboard.press('Escape');assert.equal(await page.locator('.pd-lightbox').isVisible(),false);
    assert.equal(await page.locator('.pd-main-image img').evaluate(i=>getComputedStyle(i).objectFit),'contain');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${product.category} ${width} overflow`);
    const layout=await page.locator('.pd-main-layout').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(layout,width>=1024?2:1);
    if([1440,390].includes(width)){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(output,`${product.category}-${width}.png`),fullPage:true});}
    checks.push({width,category:product.category,gallery:true,related:true,disabledPurchasing:true,noOverflow:true});
   }
   console.log(`Product pages verified at ${width}px across 12 categories.`);
  }
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#featured-track').waitFor();
  assert.equal(await page.locator('#featured-track .product-card').count(),7);assert.equal(await page.locator('#new-arrivals-track .product-card').count(),7);
  const first=products.find(p=>p.featured);await page.locator('#featured-track .product-card-link').first().click();await page.waitForURL('**/products/'+first.slug);
  await pause(100);assert.equal(await page.locator('[data-product-id]').getAttribute('data-product-id'),first.id);
  assert.equal(errors.length,0,errors.join('\n'));
  const result={canonicalProductRoutes:routes,legacyRedirects:redirects,categories:12,missingAndMismatchedProduct404:true,fixtureProduction404:true,serverRenderedSpecsAndMetadata:true,accurateStructuredDataWithoutOffers:true,homepageCardNavigation:true,responsiveChecks:checks.length,checks,pageErrors:errors,evidenceDirectory:output};
  await fs.writeFile(path.resolve(__dirname,'../docs/product-detail-browser-verification.json'),JSON.stringify(result,null,2)+'\n');console.log({...result,checks:checks.length});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
