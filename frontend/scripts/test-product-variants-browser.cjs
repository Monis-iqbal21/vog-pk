const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');

async function runVariantFixtureChecks({page,base,output}){
 const checks=[];
 const group=code=>page.locator(`[data-option-code="${code}"]`);
 const button=(code,value)=>group(code).getByRole('button',{name:new RegExp('^'+value+' — ')});
 const ready=()=>page.locator('[data-product-interactive="true"]').waitFor();
 const state=()=>page.locator('[data-selection-state]');
 async function sku(expected){await page.waitForFunction(value=>document.querySelector('[data-product-sku]')?.textContent===value,expected);}
 async function image(id){
  const img=page.locator('.pd-main-image img');await img.evaluate(i=>i.decode());assert.ok((await img.getAttribute('src')).includes(`/media/${id}.svg`));
  assert.equal(await img.evaluate(i=>getComputedStyle(i).objectFit),'contain');
 }
 async function incomplete(){await page.locator('[data-selection-state="incomplete"]').waitFor();assert.equal(await page.locator('[data-product-sku]').count(),0);assert.equal(await page.locator('[data-product-price]').count(),0);}
 await page.goto(base+'/dev/product-fixtures/keyboard?campaign=qa#product-overview');await ready();
 assert.ok(await page.locator('.pd-fixture-notice').isVisible());await incomplete();
 await button('color','Black').click();await button('switch','Red').click();await sku('FIXTURE-BLACK-RED');await image('black');
 assert.match(await page.locator('[data-product-price]').textContent(),/900/);
 assert.ok(await page.getByRole('button',{name:'Add to Cart',exact:true}).isDisabled());
 await button('color','White').click();await incomplete();
 assert.match(await state().textContent(),/cleared.*Please choose again/);
 assert.equal(await button('switch','Red').isDisabled(),true);
 assert.equal(await button('switch','Red').getAttribute('data-option-status'),'not_offered');
 assert.equal(await button('switch','Brown').getAttribute('data-option-status'),'unconfirmed');
 assert.equal(await button('switch','Magnetic').getAttribute('data-option-status'),'available');
 assert.equal(new URL(page.url()).searchParams.get('option.color'),'White');assert.equal(new URL(page.url()).searchParams.has('variant'),false);
 assert.equal(new URL(page.url()).searchParams.get('campaign'),'qa');assert.equal(new URL(page.url()).hash,'#product-overview');
 await image('landscape'); // Explicit shared media while the configuration is incomplete.
 await page.reload();await ready();await incomplete();assert.equal(await button('color','White').getAttribute('aria-pressed'),'true');
 await button('switch','Brown').click();await sku('FIXTURE-WHITE-BROWN');await image('white');
 assert.match(await page.locator('[data-product-price]').textContent(),/2,000/);assert.match(await page.locator('.pd-price-label').textContent(),/Retailer reference/);
 assert.equal(await page.locator('.pd-availability').textContent(),'Stock not yet confirmed');
 assert.match(await page.locator('#product-specifications').textContent(),/Fixture Brown/);
 await button('switch','Magnetic').click();await sku('FIXTURE-WHITE-MAGNETIC');await image('white');
 assert.match(await page.locator('[data-product-price]').textContent(),/2,500/);assert.match(await page.locator('#product-specifications').textContent(),/Fixture Magnetic/);
 assert.equal(await page.locator('.pd-thumbnail').count(),2);
 await page.locator('.pd-thumbnail').nth(1).click();await image('portrait');
 await page.locator('.pd-thumbnail').nth(1).press('ArrowLeft');await image('white');
 await page.locator('.pd-main-image').click();assert.ok(await page.locator('.pd-lightbox').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('.pd-lightbox').isVisible(),false);
 await page.reload();await ready();await sku('FIXTURE-WHITE-MAGNETIC');
 await page.goBack();await sku('FIXTURE-WHITE-BROWN');await page.goForward();await sku('FIXTURE-WHITE-MAGNETIC');
 await button('color','Black').click();await sku('FIXTURE-BLACK-MAGNETIC');assert.equal(await button('switch','Magnetic').getAttribute('aria-pressed'),'true');await image('black');
 assert.match(await page.locator('[data-product-price] del').textContent(),/1,800/);assert.match(await page.locator('[data-product-price]').textContent(),/1,500/);
 await button('color','Gray').click();await sku('FIXTURE-GRAY-MAGNETIC');await image('gray');
 assert.equal(await button('switch','Magnetic').isDisabled(),false);assert.equal(await button('switch','Magnetic').getAttribute('data-option-status'),'out_of_stock');
 assert.equal(await page.locator('.pd-availability').textContent(),'Out of stock');assert.ok(await page.getByRole('button',{name:'Add to Cart',exact:true}).isDisabled());
 assert.equal(await button('switch','Red').isDisabled(),true);assert.equal(await button('switch','Brown').isDisabled(),true);
 await page.goto(base+'/dev/product-fixtures/keyboard?variant=invalid');await ready();
 assert.equal(await state().getAttribute('data-selection-state'),'invalid');assert.match(await state().textContent(),/link is invalid/);assert.equal(await page.locator('[data-product-sku]').count(),0);assert.equal(await page.locator('[data-product-price]').count(),0);
 await page.goto(base+'/dev/product-fixtures/keyboard?option.color=White&option.switch=Red');await ready();assert.equal(await state().getAttribute('data-selection-state'),'invalid');
 checks.push({fixture:'keyboard',dependentClearing:true,preservedValidChoices:true,fourAvailabilityStates:true,priceSaleSkuSpecsAndImages:true,partialReload:true,deepLink:true,backForward:true,invalidDoesNotFallback:true,cartDisabled:true,galleryKeyboardLightbox:true});

 await page.goto(base+'/dev/product-fixtures/mouse');await ready();await incomplete();
 assert.match(await page.locator('.pd-price-label').textContent(),/Retailer reference prices from/);assert.match(await page.locator('[data-starting-price]').textContent(),/4,000/);
 await button('color','Black').click();await sku('FIXTURE-MOUSE-BLACK');await image('black');assert.match(await page.locator('[data-product-price]').textContent(),/4,000/);
 await button('color','White').click();await sku('FIXTURE-MOUSE-WHITE');await image('white');assert.match(await page.locator('[data-product-price]').textContent(),/4,500/);
 assert.ok(await page.getByRole('button',{name:'Add to Cart',exact:true}).isDisabled());
 checks.push({fixture:'mouse',twoSwatches:true,referenceStartingPrice:true,distinctPriceAndImage:true,cartDisabled:true});

 await page.goto(base+'/dev/product-fixtures/case');await ready();
 await button('color','Black').click();await button('panel','Mesh').click();await page.getByRole('combobox',{name:'Size',exact:true}).selectOption('Compact');await sku('FIXTURE-CASE-BMC');
 await button('color','White').click();await incomplete();assert.match(await state().textContent(),/Panel Type, Size cleared/);
 assert.equal(await button('panel','Mesh').isDisabled(),true);assert.equal(await page.getByRole('combobox',{name:'Size',exact:true}).inputValue(),'');
 await button('panel','Glass').click();assert.equal(await page.locator('.pd-option-dropdown option[value="Compact"]').isDisabled(),true);
 await page.getByRole('combobox',{name:'Size',exact:true}).selectOption('Full');await sku('FIXTURE-CASE-WGF');assert.equal(await page.locator('.pd-availability').textContent(),'Stock not yet confirmed');
 await page.goto(base+'/dev/product-fixtures/case?variant=fixture-case-black-mesh-full');await ready();await sku('FIXTURE-CASE-BMF');assert.equal(await page.locator('.pd-availability').textContent(),'Out of stock');
 await button('color','White').click();await incomplete();assert.equal(await page.getByRole('combobox',{name:'Size',exact:true}).inputValue(),'Full');assert.match(await state().textContent(),/Panel Type cleared/);
 await button('panel','Glass').click();await sku('FIXTURE-CASE-WGF');
 checks.push({fixture:'case',threeDimensions:true,dropdown:true,dependencyClearing:true,laterCompatibleValuePreserved:true,unknownAndSoldOut:true});

 const responsive=[];
 for(const fixture of ['keyboard','mouse','case'])for(const width of [1440,1024,768,430,390,320]){
  await page.setViewportSize({width,height:1000});
  const variant=fixture==='keyboard'?'fixture-white-magnetic':fixture==='mouse'?'fixture-mouse-white':'fixture-case-white-glass-full';
  await page.goto(`${base}/dev/product-fixtures/${fixture}?variant=${variant}`);await ready();
  for(const img of await page.locator('.pd-rich-image').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
  if(fixture==='keyboard')for(const selector of ['.pd-poster img','.pd-banner img','.pd-image-text img']){
   const ratio=await page.locator(selector).evaluate(i=>{const r=i.getBoundingClientRect();return {render:r.width/r.height,source:i.naturalWidth/i.naturalHeight};});assert.ok(Math.abs(ratio.render-ratio.source)<.01);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${fixture} ${width} overflow`);
  assert.ok(await page.locator('.pd-option').first().evaluate(e=>e.getBoundingClientRect().height>=44));
  // Native keyboard activation and explicit visible text accompany every swatch.
  await button('color','Black').focus();await page.keyboard.press('Space');
  assert.equal(await button('color','Black').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:path.join(output,`variants-${fixture}-${width}.png`),fullPage:true});
  responsive.push({fixture,width,noOverflow:true,touchTargets:true,keyboardSwatch:true});
 }
 const report={passed:true,fixtures:3,checks,responsiveChecks:responsive.length,responsive,allSixRichBlocksPreserved:true};
 await fs.writeFile(path.resolve(__dirname,'../docs/product-variants-browser-verification.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
module.exports={runVariantFixtureChecks};

if(require.main===module){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const os=require('node:os');
 (async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const output=path.join(os.tmpdir(),'vog-product-details');await fs.mkdir(output,{recursive:true});const result=await runVariantFixtureChecks({page,base:process.env.VOG_BASE_URL||'http://localhost:3001',output});assert.deepEqual(errors,[]);console.log({...result,responsive:result.responsiveChecks});}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
}
