const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const base=process.env.VOG_BASE_URL||'http://localhost:3000';
(async()=>{
 const data=await import(pathToFileURL(path.resolve(__dirname,'../src/data/products.js')).href);
 const lib=await import(pathToFileURL(path.resolve(__dirname,'../src/lib/product-listings.js')).href);
 const routes=[lib.getListingScope(),...data.productCategories.map(category=>lib.getListingScope('category',category.slug)),lib.getListingScope('collection','featured'),lib.getListingScope('collection','new-arrivals')];
 const evidence=path.join(os.tmpdir(),'vog-product-listings');await fs.mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[],responses=[],responsive=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.url().includes('/_next/image')&&response.status()!==200)responses.push({url:response.url(),status:response.status()});});
  const ready=()=>page.locator('[data-listing-ready="true"]').waitFor();
  const count=()=>page.locator('[data-result-count]').getAttribute('data-result-count').then(Number);
  const cardSlugs=()=>page.locator('.pl-grid .product-card-link').evaluateAll(links=>links.map(link=>link.getAttribute('href').split('/').pop()));
  const brandCheckbox=value=>page.locator(`.pl-sidebar [data-filter-code="brand"]`).getByRole('checkbox',{name:new RegExp('^'+value+' ')});
  for(const scope of routes){
   const response=await context.request.get(base+scope.path);assert.equal(response.status(),200,scope.path);
   const html=await response.text();const meta=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return {title:doc.title,canonical:doc.querySelector('link[rel="canonical"]')?.href,description:doc.querySelector('meta[name="description"]')?.content,heading:doc.querySelector('.pl-heading h1')?.textContent,count:Number(doc.querySelector('[data-result-count]')?.getAttribute('data-result-count')),cards:doc.querySelectorAll('.pl-grid .product-card').length};},html);
   assert.equal(meta.heading,scope.title);assert.equal(meta.description,scope.description);assert.equal(meta.canonical,'https://vogpk.vercel.app'+scope.path);assert.ok(meta.title.includes(scope.title));assert.equal(meta.count,lib.queryListing(scope).total);assert.equal(meta.cards,Math.min(meta.count,12));
  }
  for(const url of ['/products/not-a-category-or-product','/collections/not-a-collection'])assert.equal((await context.request.get(base+url)).status(),404,url);
  const filteredResponse=await context.request.get(base+'/products/graphics-cards?brand=ASUS&vram=16+GB');const filteredHtml=await filteredResponse.text();
  const filteredMeta=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return {robots:doc.querySelector('meta[name="robots"]')?.content,count:Number(doc.querySelector('[data-result-count]').getAttribute('data-result-count')),canonical:doc.querySelector('link[rel="canonical"]')?.href};},filteredHtml);
  assert.match(filteredMeta.robots,/noindex/);assert.equal(filteredMeta.canonical,'https://vogpk.vercel.app/products/graphics-cards');assert.equal(filteredMeta.count,lib.queryListing(lib.getListingScope('category','graphics-cards'),'brand=ASUS&vram=16+GB').total);

  await page.goto(base+'/products?page=2');await ready();assert.equal(await page.locator('.pl-pagination [aria-current]').textContent(),'2');
  await brandCheckbox('ASUS').check();assert.equal(new URL(page.url()).searchParams.has('page'),false);assert.equal(new URL(page.url()).searchParams.get('brand'),'ASUS');
  assert.equal(await count(),data.products.filter(product=>product.brand==='ASUS').length);
  await brandCheckbox('GIGABYTE').check();assert.equal(new URL(page.url()).searchParams.getAll('brand').length,2);
  assert.equal(await count(),data.products.filter(product=>['ASUS','GIGABYTE'].includes(product.brand)).length);
  await page.getByRole('combobox',{name:'Sort products'}).selectOption('price-asc');
  assert.deepEqual(await cardSlugs(),lib.queryListing(lib.getListingScope(),'brand=ASUS&brand=GIGABYTE&sort=price-asc').items.map(product=>product.slug));
  await page.getByRole('link',{name:'Next page',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('page'),'2');
  assert.deepEqual(await cardSlugs(),lib.queryListing(lib.getListingScope(),'brand=ASUS&brand=GIGABYTE&sort=price-asc&page=2').items.map(product=>product.slug));
  await page.reload();await ready();assert.equal(await page.locator('.pl-pagination [aria-current]').textContent(),'2');
  await page.goBack();await ready();assert.equal(await page.locator('.pl-pagination [aria-current]').textContent(),'1');
  await page.goForward();await ready();assert.equal(await page.locator('.pl-pagination [aria-current]').textContent(),'2');
  await page.getByRole('button',{name:'Remove Brand: GIGABYTE',exact:true}).click();assert.equal(new URL(page.url()).searchParams.has('page'),false);assert.deepEqual(new URL(page.url()).searchParams.getAll('brand'),['ASUS']);
  await page.locator('.pl-active-filters').getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await count(),84);assert.equal(new URL(page.url()).searchParams.get('sort'),'price-asc');
  for(const [sort] of lib.listingSorts){await page.getByRole('combobox',{name:'Sort products'}).selectOption(sort);assert.deepEqual(await cardSlugs(),lib.queryListing(lib.getListingScope(),'sort='+sort).items.map(product=>product.slug));}

  const sidebar=page.locator('.pl-sidebar');
  await sidebar.getByLabel('Minimum',{exact:true}).fill('600000');await sidebar.getByLabel('Maximum',{exact:true}).fill('100');
  await sidebar.getByRole('button',{name:'Apply price',exact:true}).click();assert.match(await sidebar.getByRole('alert').textContent(),/Minimum.*exceed/);assert.equal(new URL(page.url()).searchParams.has('min'),false);
  await sidebar.getByLabel('Minimum',{exact:true}).fill('-1');await sidebar.getByRole('button',{name:'Apply price',exact:true}).click();assert.match(await sidebar.getByRole('alert').textContent(),/non-negative/);
  await sidebar.getByRole('button',{name:'Clear all',exact:true}).click();assert.equal(await sidebar.getByLabel('Minimum',{exact:true}).inputValue(),'');assert.equal(await sidebar.getByRole('alert').count(),0);
  await sidebar.getByLabel('Minimum',{exact:true}).fill('100000');await sidebar.getByLabel('Maximum',{exact:true}).fill('450000');await sidebar.getByRole('button',{name:'Apply price',exact:true}).click();
  assert.equal(await count(),lib.queryListing(lib.getListingScope(),'min=100000&max=450000').total);assert.equal(new URL(page.url()).searchParams.get('min'),'100000');
  await page.goto(base+'/products?min=1&max=2');await ready();assert.ok(await page.getByRole('heading',{name:'No products match your selected filters.',exact:true}).isVisible());assert.equal(await page.locator('.pl-pagination').count(),0);
  await page.locator('.pl-empty').getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await count(),84);
  await page.goto(base+'/products?brand=NoSuchBrand&sort=newest&page=-1&min=-10');await ready();assert.equal(await count(),84);assert.ok(await page.locator('.pl-query-note').isVisible());assert.equal(await page.getByRole('combobox',{name:'Sort products'}).inputValue(),'default');
  await page.goto(base+'/products?page=999');await ready();assert.equal(await page.locator('.pl-pagination [aria-current]').textContent(),'7');assert.ok(await page.getByRole('button',{name:'Next page',exact:true}).isDisabled());
  await page.goto(base+'/products');await ready();assert.ok(await page.getByRole('button',{name:'Previous page',exact:true}).isDisabled());
  const brandSearch=sidebar.getByRole('searchbox',{name:'Search Brand options'});await brandSearch.fill('gigabyte');assert.equal(await sidebar.locator('[data-filter-code="brand"] input[type="checkbox"]').count(),1);await brandSearch.fill('');
  await sidebar.locator('[data-filter-code="brand"] summary').click();assert.equal(await sidebar.locator('[data-filter-code="brand"]').getAttribute('open'),null);await sidebar.locator('[data-filter-code="brand"] summary').click();
  await page.goto(base+'/products/graphics-cards?brand=ASUS');await ready();
  const vram=page.locator('.pl-sidebar [data-filter-code="vram"]');await vram.getByRole('checkbox',{name:/^16 GB /}).check();
  assert.equal(await count(),lib.queryListing(lib.getListingScope('category','graphics-cards'),'brand=ASUS&vram=16+GB').total);
  const brand=page.locator('.pl-sidebar [data-filter-code="brand"]');assert.equal(await brand.getByRole('searchbox').count(),0);
  await page.goto(base+'/products/graphics-cards?vram=12+GB');await ready();assert.ok(await brand.getByRole('checkbox',{name:/^GIGABYTE /}).isDisabled());
  await page.locator('.desktop-nav summary').filter({hasText:'PC Components'}).click();await page.locator('.desktop-nav').getByRole('link',{name:'Processors',exact:true}).click();await page.waitForURL('**/products/processors');await ready();assert.equal(new URL(page.url()).pathname,'/products/processors');assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('[data-filter-code="vram"]').count(),0);

  // Every category can apply at least one actual technical filter, with exact data matches.
  for(const category of data.productCategories){
   await page.goto(base+'/products/'+category.slug);await ready();const result=lib.queryListing(lib.getListingScope('category',category.slug));const facet=result.facets.find(facet=>facet.code!=='brand');assert.ok(facet,category.slug);
   const option=facet.values[0];await page.locator(`.pl-sidebar [data-filter-code="${facet.code}"]`).getByRole('checkbox').first().check();
   assert.equal(await count(),lib.queryListing(lib.getListingScope('category',category.slug),`${facet.code}=${encodeURIComponent(option.value)}`).total);
   assert.equal(new URL(page.url()).searchParams.get(facet.code),option.value);
  }

  // Responsive grid and card alignment on every required listing route.
  for(const width of [1920,1440,1280,1024,768,430,390,375,320]){
   await page.setViewportSize({width,height:1050});
   for(const scope of routes){
    await page.goto(base+scope.path);await ready();
    const grid=page.locator('.pl-grid');const columns=await grid.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length);
    assert.equal(columns,width>=1280?4:width>=1024?3:2,`${scope.path} ${width} columns`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${scope.path} ${width} overflow`);
    const geometry=await page.locator('.pl-grid .product-card').evaluateAll(cards=>cards.map(card=>{const r=selector=>card.querySelector(selector).getBoundingClientRect();const price=r('.product-price'),button=r('.product-add');return {top:Math.round(card.getBoundingClientRect().top),priceBottom:Math.round(price.bottom),nameTop:Math.round(r('.product-name').top),bottom:Math.round(card.getBoundingClientRect().bottom),overlap:price.right>button.left+1&&price.bottom>button.top+1&&button.bottom>price.top+1,fit:getComputedStyle(card.querySelector('img')).objectFit,disabled:card.querySelector('.product-add').disabled};}));
    assert.ok(geometry.every(card=>!card.overlap&&card.fit==='contain'&&card.disabled),`${scope.path} ${width} card control geometry`);
    const rows=Map.groupBy(geometry,card=>card.top);for(const cards of rows.values()){assert.ok(Math.max(...cards.map(card=>card.bottom))-Math.min(...cards.map(card=>card.bottom))<=1);assert.ok(Math.max(...cards.map(card=>card.priceBottom))-Math.min(...cards.map(card=>card.priceBottom))<=1,'Price baselines');}
    if([1440,390,320].includes(width)&&['/products','/products/graphics-cards'].includes(scope.path)){
     for(const img of await page.locator('.pl-grid img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
     await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(evidence,`${scope.path.replaceAll('/','-')}-${width}.png`),fullPage:true});
    }
    responsive.push({path:scope.path,width,columns,noOverflow:true,alignedPrices:true,disabledPurchasing:true});
   }
   console.log(`Listings verified at ${width}px: 15 routes.`);
  }

  // Accessible live filter drawer: keyboard trap, URL state, live counts, scroll lock and focus return.
  for(const width of [1024,768,430,390,375,320]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/products/graphics-cards');await ready();
   const trigger=page.getByRole('button',{name:/^Filters/});await trigger.click();
   const dialog=page.getByRole('dialog',{name:'Filter products'});assert.ok(await dialog.isVisible());assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
   assert.equal(await page.getByRole('button',{name:'Close filters',exact:true}).evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Shift+Tab');assert.equal(await dialog.getByRole('button',{name:/^View \d+ results$/}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:'Close filters',exact:true}).evaluate(e=>e===document.activeElement),true);
   await dialog.locator('[data-filter-code="brand"]').getByRole('checkbox',{name:/^ASUS /}).check();assert.equal(new URL(page.url()).searchParams.get('brand'),'ASUS');
   await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   await trigger.click();assert.ok(await dialog.locator('[data-filter-code="brand"]').getByRole('checkbox',{name:/^ASUS /}).isChecked());
   await dialog.getByRole('button',{name:'Clear all',exact:true}).click();assert.equal(await count(),7);
   await dialog.getByRole('button',{name:'View 7 results',exact:true}).click();assert.equal(await dialog.isVisible(),false);
  }
  await page.setViewportSize({width:1440,height:1050});await page.goto(base);await page.locator('#featured-track').waitFor();
  assert.equal(await page.locator('#featured-track .product-see-all').getAttribute('href'),'/collections/featured');assert.equal(await page.locator('#new-arrivals-track .product-see-all').getAttribute('href'),'/collections/new-arrivals');
  await page.locator('#featured-track .product-see-all').click();await ready();assert.equal(await count(),8);
  await page.goto(base);await page.locator('#new-arrivals-track .product-see-all').click();await ready();assert.equal(await count(),8);
  await page.goto(base);await page.getByRole('tab',{name:'Keyboards',exact:true}).click();assert.equal(await page.locator('#category-track .product-see-all').getAttribute('href'),'/products/keyboards');await page.locator('#category-track .product-see-all').click();await ready();assert.equal(await count(),7);
  await page.locator('.desktop-nav').getByRole('link',{name:'All Products',exact:true}).click();await page.waitForURL('**/products');await ready();assert.equal(await count(),84);
  const firstSlug=await page.locator('.pl-grid .product-card-link').first().getAttribute('href');await page.locator('.pl-grid .product-card-link').first().click();await page.locator('[data-product-interactive="true"]').waitFor();assert.equal(new URL(page.url()).pathname,firstSlug);assert.equal(await page.locator('.pd-breadcrumbs a').nth(1).getAttribute('href'),'/products/graphics-cards');assert.equal(await page.locator('#related-track .product-see-all').getAttribute('href'),'/products/graphics-cards');await page.locator('.pd-breadcrumbs a').nth(1).click();await ready();assert.equal(await count(),7);
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(responses.length,0,JSON.stringify(responses));
  // Deliberate missing-image request: use existing fallback without substituting another product.
  const image=data.products[0].image;
  await page.route('**/_next/image?*',route=>{const url=new URL(route.request().url());return url.searchParams.get('url')===image?route.fulfill({status:404,body:'Intentional missing-image test'}):route.continue();});
  await page.goto(base+'/products');await ready();await page.waitForFunction(()=>document.querySelector('.pl-grid .product-image')?.getAttribute('src')?.includes('product-placeholder.svg'));await page.locator('.pl-grid .product-image').first().evaluate(i=>i.decode());await page.unroute('**/_next/image?*');
  const report={passed:true,listingRoutes:15,categories:12,filterSortPaginationUrl:true,serverRenderedFilteredStateAndCanonical:true,invalidRoutes404:true,technicalCategoriesTested:12,drawerWidths:[1024,768,430,390,375,320],navigationAndBreadcrumbs:true,missingImageFallback:true,responsiveChecks:responsive.length,responsive,pageErrors:errors,evidenceDirectory:evidence};
  await fs.writeFile(path.resolve(__dirname,'../docs/product-listing-browser-verification.json'),JSON.stringify(report,null,2)+'\n');console.log({...report,responsive:responsive.length});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
