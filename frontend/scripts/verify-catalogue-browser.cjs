const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const widths=[1440,1280,1024,768,430,390,375,320];
const evidence=path.join(os.tmpdir(),'vog-catalogue-browser');fs.mkdirSync(evidence,{recursive:true});
const base=process.env.VOG_BASE_URL||'http://localhost:3000';
(async()=>{
 const {products}=await import(pathToFileURL(path.resolve(__dirname,'../src/data/products.js')).href);
 const validPaths=new Map(products.map(product=>['/products/'+product.slug,product.category]));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[],errors=[],imageFailures=[];
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:1100},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push({width,message:e.message}));
   page.on('response',r=>{if(r.url().includes('/_next/image')&&r.status()!==200)imageFailures.push({width,url:r.url(),status:r.status()});});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('tab').first().waitFor();
   async function inspect(id,count,category){
    const track=page.locator('#'+id+'-track'),section=page.locator(`[aria-labelledby="${id}-title"]`);
    assert.equal(await track.locator('.product-card').count(),count);
    assert.equal(await track.locator('.product-see-all').count(),1);
    if(id!=='category'){
     const rowCount=await track.locator(':scope > *').evaluateAll(items=>new Set(items.map(item=>Math.round(item.getBoundingClientRect().top))).size);
     assert.equal(rowCount,1,'Featured and New Arrivals must each have one independent horizontal row');
     assert.equal(await track.locator(':scope > :last-child').getAttribute('class'),'product-see-all');
    }
    const href=await track.locator('.product-see-all').getAttribute('href');
    assert.equal(href,category?'/products/'+category:'/products/'+id);
    for(const card of await track.locator('.product-card').all()){
     await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(img=>img.decode());
     const detail=await card.evaluate(c=>{
      const img=c.querySelector('img'),wrap=c.querySelector('.product-image-wrap'),r=wrap.getBoundingClientRect(),style=getComputedStyle(img);
      return {naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,fit:style.objectFit,width:r.width,height:r.height,href:c.querySelector('a.product-card-link').getAttribute('href'),disabled:c.querySelector('.product-add').disabled,price:c.querySelector('.product-price').textContent};
     });
     assert.ok(detail.naturalWidth>0&&detail.naturalHeight>0);assert.equal(detail.fit,'contain');
     assert.ok(Math.abs(detail.width-detail.height)<1);assert.ok(detail.disabled);assert.match(detail.price,/Rs\. [\d,]+/);
     assert.ok(validPaths.has(detail.href),'Product card must use a real canonical detail route');
     if(category)assert.equal(validPaths.get(detail.href),category);
    }
    const layout=await track.locator('.product-card').evaluateAll(cards=>cards.map(c=>{
     const rect=s=>c.querySelector(s).getBoundingClientRect();return {row:Math.round(rect('.product-image-wrap').top),imageHeight:rect('.product-image-wrap').height,brandTop:rect('.product-brand').top,titleTop:rect('.product-name').top,descriptionTop:rect('.product-description').top,priceTop:rect('.product-price').top,buttonTop:rect('.product-add').top};
    }));
    for(const row of new Set(layout.map(c=>c.row))){const cards=layout.filter(c=>c.row===row);for(const key of ['imageHeight','brandTop','titleTop','descriptionTop','priceTop','buttonTop'])assert.ok(Math.max(...cards.map(c=>c[key]))-Math.min(...cards.map(c=>c[key]))<1,`${width} ${id} ${key} alignment`);}
    await track.evaluate(t=>t.scrollTo({left:0,behavior:'instant'}));
    const next=section.locator('.product-carousel-arrows button').nth(1),previous=section.locator('.product-carousel-arrows button').first();
    await page.waitForTimeout(50);
    if(await next.isEnabled()){
     await next.click();await page.waitForTimeout(80);assert.ok(await track.evaluate(t=>t.scrollLeft>0),'Next arrow must advance');
     await previous.click();await page.waitForTimeout(80);assert.ok(await track.evaluate(t=>t.scrollLeft<=2),'Previous arrow must return');
    }
    await track.focus();await track.press('End');await page.waitForTimeout(50);
    assert.ok(await track.evaluate(t=>Math.abs(t.scrollWidth-t.clientWidth-t.scrollLeft)<3));
    await track.press('Home');await page.waitForTimeout(50);
    await section.screenshot({path:path.join(evidence,`${width}-${id}-${category||'collection'}.png`)});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);assert.equal(overflow,false,`${width} page overflow`);
    checks.push({width,section:id,category:category||null,cards:count,imagesDecoded:true,alignment:true,seeAllHref:href,arrows:true,keyboardNavigation:true,noPageOverflow:true});
   }
   await inspect('featured',7);await inspect('new-arrivals',7);
   const tabs=page.getByRole('tab');assert.equal(await tabs.count(),12);
   for(let i=0;i<12;i++){
    await tabs.nth(i).click();const category=(await tabs.nth(i).getAttribute('id')).replace('category-tab-','');await inspect('category',7,category);
   }
   await page.goto(base+'/images/products/credits.html',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('article').count(),84);
   await page.close();console.log(`Verified ${width}px: Featured, New Arrivals, all 12 categories.`);
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(imageFailures.length,0,JSON.stringify(imageFailures));
  const page=await browser.newPage();const detail=await page.goto(base+'/products/graphics-cards/rog-strix-rtx5070ti-o16g');const category=await page.goto(base+'/products/graphics-cards');
  const report={checkedAt:'2026-10-27',widths,checks,checkCount:checks.length,pageErrors:errors,imageFailures,evidenceDirectory:evidence,existingRouteLimitations:{productDetailStatus:detail.status(),categoryListingStatus:category.status(),note:'Product details now resolve through canonical routes and legacy redirects. Category-listing destination pages remain outside the product-detail scope.'}};
  fs.writeFileSync(path.resolve(__dirname,'../docs/catalogue-browser-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,widths,pageErrors:0,imageFailures:0,evidence,existingRouteLimitations:report.existingRouteLimitations}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
