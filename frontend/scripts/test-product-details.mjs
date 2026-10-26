import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {products,productCategories} from '../src/data/products.js';
import {getProductDetailBySlug,getProductBySlug,getProductPath,getRelatedProducts} from '../src/lib/products.js';
import {getSpecificationGroups} from '../src/lib/product-specifications.js';
import {getPurchaseState} from '../src/lib/product-options.js';
import './test-product-variants.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let galleries=0;
for(const original of products){
 const detail=getProductDetailBySlug(original.slug);assert.ok(detail);
 for(const key of ['id','slug','category','brand','name','referencePricePKR','price','stock','featured','newArrival','image','shortDescription','specifications'])assert.deepEqual(detail[key],original[key],`${original.id} changed ${key}`);
 const rows=getSpecificationGroups(detail.category,detail.specifications).flatMap(group=>group.rows);
 assert.equal(rows.length,Object.keys(original.specifications).length,'Every existing specification must render exactly once');
 for(const row of rows)assert.equal(row.value,String(original.specifications[row.key]));
 assert.equal(detail.options.length,0);assert.equal(detail.variants.length,0);assert.equal(detail.contentBlocks.length,0);
 assert.equal(getPurchaseState(detail,true).canPurchase,false,'Reference prices must never enable checkout');
 assert.equal(getPurchaseState(detail).isReference,true);
 for(const image of detail.gallery){
  const local=path.resolve(root,'public','.'+image.src);assert.ok(local.startsWith(path.join(root,'public')+path.sep));
  const meta=await sharp(local).metadata();assert.equal(meta.width,image.width);assert.equal(meta.height,image.height);
 }
 if(detail.gallery.length>1)galleries++;
 const related=getRelatedProducts(detail);assert.ok(related.length>0);assert.ok(related.every(p=>p.id!==detail.id&&p.category===detail.category));
 assert.equal(getProductPath(detail),`/products/${detail.slug}`);
}
assert.equal(getProductBySlug('no-such-product'),null);assert.equal(getProductDetailBySlug('no-such-product'),null);
assert.equal(getProductBySlug('toString'),null);
assert.equal(getSpecificationGroups('processors',{Cores:0,Unknown:null}).flatMap(g=>g.rows)[0].value,'0');
const result={products:products.length,categories:productCategories.length,productsWithSpecifications:products.filter(p=>Object.keys(p.specifications??{}).length).length,multipleImageGalleries:galleries,actualVariantProducts:0,actualRichMediaProducts:0,variantLogicVerified:true,passed:true};
await fs.writeFile(path.join(root,'docs/product-detail-data-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
