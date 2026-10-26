import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {products,productCategories,getFeaturedProducts,getNewArrivals,HOMEPAGE_PRODUCT_LIMIT} from '../src/data/products.js';
import {productImages} from '../src/data/product-images.js';
const root=fileURLToPath(new URL('../',import.meta.url)),publicRoot=path.join(root,'public');
const shared=JSON.parse(await fs.readFile(path.join(root,'docs/catalogue-shared-packshots.json'),'utf8'));
const result={totalProducts:products.length,errors:[],placeholders:[],qualityExceptions:[],documentedSharedPackshots:[],categories:{},collections:{},referencePrices:0,developmentOnly:0};
const seen={id:new Set(),slug:new Set(),model:new Set(),path:new Map(),hash:new Map()};
const fail=(id,message)=>result.errors.push({id,message});
if(products.length!==84)fail('catalogue','Expected 84 products');
for(const p of products){
 for(const [key,value] of [['id',p.id],['slug',p.slug],['model',`${p.brand}:${p.modelIdentifier}`.toLowerCase()]]){
  if(!value||seen[key].has(value))fail(p.id,`Missing/duplicate ${key}: ${value}`);seen[key].add(value);
 }
 if(!productCategories.some(c=>c.slug===p.category))fail(p.id,'Unknown category');
 result.categories[p.category]=(result.categories[p.category]??0)+1;
 if(!Number.isFinite(p.referencePricePKR)||p.referencePricePKR<=0)fail(p.id,'Missing numeric PKR reference');else result.referencePrices++;
 for(const key of ['brand','name','modelIdentifier','shortDescription','sourceUrl','sourceCheckedAt','imageSourceUrl','imageUsageStatus'])if(!p[key])fail(p.id,`Missing ${key}`);
 if(!/^https:\/\//.test(p.sourceUrl)||!/^2026-10-2[67]$/.test(p.sourceCheckedAt))fail(p.id,'Reference evidence/date missing');
 if(!p.specifications||Object.keys(p.specifications).length<3||!p.specificationSourceUrl)fail(p.id,'Incomplete technical specifications');
 if(p.price!==null||p.salePrice!==null||p.regularPrice!==null||p.pricingApproved||p.inventoryVerified||p.stock!==null)fail(p.id,'Demo purchasing guard changed');
 if(p.imageIsPlaceholder)result.placeholders.push(p.id);
 if(p.imageDevelopmentOnly)result.developmentOnly++;
 const credit=productImages[p.id];
 if(!credit?.sourceUrl||!credit?.licenseUrl||!credit?.author||!credit?.modifications||!credit?.visualReview||!p.imageCreditUrl)fail(p.id,'Incomplete source/license/visual review');
 if(credit?.qualityException)result.qualityExceptions.push({id:p.id,reason:credit.qualityException});
 if(seen.path.has(p.image))fail(p.id,`Unexpected shared local path with ${seen.path.get(p.image)}`);seen.path.set(p.image,p.id);
 const file=path.resolve(publicRoot,'.'+p.image);
 if(!file.startsWith(publicRoot+path.sep)){fail(p.id,'Image outside public directory');continue;}
 try{
  const bytes=await fs.readFile(file),meta=await sharp(bytes).metadata();await sharp(bytes).raw().toBuffer();
  if(!['png','webp','avif'].includes(meta.format)||meta.width!==meta.height||meta.width<700||meta.width>1000)fail(p.id,`Invalid image: ${meta.format} ${meta.width}×${meta.height}`);
  if(meta.width!==credit.width||meta.height!==credit.height)fail(p.id,'Image manifest dimensions differ');
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==credit.sha256)fail(p.id,'Image changed after review');
  if(seen.hash.has(hash)){
   const other=seen.hash.get(hash),explanation=shared.find(x=>x.ids.includes(other)&&x.ids.includes(p.id));
   if(!explanation)fail(p.id,`Unexplained duplicated photograph with ${other}`);else result.documentedSharedPackshots.push(explanation);
  }else seen.hash.set(hash,p.id);
 }catch(e){fail(p.id,`Image missing/corrupt: ${e.message}`);}
}
for(const c of productCategories)if(result.categories[c.slug]!==7)fail(c.slug,'Expected exactly 7 unique products');
for(const [name,items] of [['featured',getFeaturedProducts()],['newArrivals',getNewArrivals()]]){
 const counts={};for(const p of items)counts[p.category]=(counts[p.category]??0)+1;
 result.collections[name]={count:items.length,categories:counts};
 if(items.length!==HOMEPAGE_PRODUCT_LIMIT)fail(name,`Expected ${HOMEPAGE_PRODUCT_LIMIT} homepage products`);
 if(items.some(p=>p.imageIsPlaceholder))fail(name,'Homepage photograph missing');
}
if(getFeaturedProducts().some(p=>getNewArrivals().some(a=>a.id===p.id)))fail('collections','Featured/New Arrivals overlap');
result.uniquePhotographs=seen.hash.size;
result.filesAndDataValid=result.errors.length===0;
result.retailReady=result.filesAndDataValid&&!result.placeholders.length&&!result.qualityExceptions.length&&!result.developmentOnly;
await fs.writeFile(path.join(root,'docs/product-image-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,errors:result.errors,qualityExceptions:result.qualityExceptions,documentedSharedPackshots:result.documentedSharedPackshots.length},null,2));
if(!result.filesAndDataValid)process.exitCode=1;else if(process.argv.includes('--require-complete')&&!result.retailReady)process.exitCode=2;
