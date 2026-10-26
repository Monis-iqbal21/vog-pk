import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const candidates=JSON.parse(await fs.readFile(new URL('docs/catalogue-candidate-research.json',root))).candidates;
const retained=JSON.parse(await fs.readFile(new URL('docs/catalogue-retained-research.json',root)));
// Additional hardware-only angles already visually reviewed against each exact SKU.
const choices={
 'rog-strix-rtx5070ti-o16g':3,'kingston-fury-beast-ddr5-16gb-6000':1,
 'asus-rog-harpe-ace-aim-lab':0,'asus-rog-scope-ii-96-wireless-nx-snow':0,
 'asus-rog-crosshair-x870e-dark-hero':0,'kingston-fury-renegade-2tb':2,
 'asus-rog-strix-xg27acdng':2,'asus-rog-thor-1000p2':3,
 'asus-rog-hyperion-gr701-black':3,'asus-rog-strix-lc-iii-360-argb':1,
 'asus-rog-scabbard-ii':0,
};
const output=fileURLToPath(new URL('public/images/products/gallery/',root));await fs.mkdir(output,{recursive:true});
const cache=path.join(os.tmpdir(),'vog-detail-gallery-sources');await fs.mkdir(cache,{recursive:true});
const records=[];
for(const [id,index] of Object.entries(choices)){
 const x=[...candidates,...retained].find(x=>x.id===id),g=x?.gallery[index];if(!g)throw Error(`Missing reviewed angle for ${id}`);
 const source=path.join(cache,`${id}.source`);
 try{await fs.access(source);}catch{
  const r=await fetch(g.url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`Stopped on HTTP ${r.status}: ${id}`);
  await fs.writeFile(source,Buffer.from(await r.arrayBuffer()));await new Promise(resolve=>setTimeout(resolve,250));
 }
 const file=path.join(output,`${id}-view-2.webp`);
 await sharp(source).rotate().trim({threshold:8}).resize(1280,1280,{fit:'inside',withoutEnlargement:true}).webp({quality:90}).toFile(file);
 const meta=await sharp(file).metadata();
 records.push({productId:id,id:`${id}-view-2`,src:`/images/products/gallery/${id}-view-2.webp`,alt:`${x.brand??''} ${x.model??x.title} — additional product view`.trim(),width:meta.width,height:meta.height,sourceUrl:x.apiUrl,downloadUrl:g.url,galleryIndex:index,license:'Open Icecat public demonstration — development evaluation only',licenseUrl:'https://iceclog.com/open-content-license/',developmentOnly:true,modifications:'2026-10-27: uniform-border trim, proportional reduction without enlargement, WebP conversion. Source aspect ratio preserved.'});
 console.log(id,meta.width,meta.height);
}
await fs.writeFile(new URL('docs/product-detail-gallery-sources.json',root),JSON.stringify(records,null,2)+'\n');
await fs.writeFile(new URL('src/data/product-detail-gallery.js',root),`// Reviewed additional angles. No variants or marketing media inferred.\nexport const productDetailGallery = ${JSON.stringify(Object.fromEntries(records.map(r=>[r.productId,[{id:r.id,src:r.src,alt:r.alt,width:r.width,height:r.height,creditUrl:`/images/products/credits.html#${r.productId}`}]])),null,2)};\n`);
let credits=await fs.readFile(new URL('public/images/products/credits.html',root),'utf8');
for(const r of records){
 const marker=`<article id="${r.productId}">`,start=credits.indexOf(marker),end=credits.indexOf('</article>',start);
 if(start<0||end<0)throw Error(`Missing credit anchor ${r.productId}`);
 if(!credits.slice(start,end).includes(r.src))credits=credits.slice(0,end)+`<p>Additional angle: <a href="${r.downloadUrl}">${r.src}</a>. ${r.modifications} Same brand / Icecat rights and development restrictions apply.</p>`+credits.slice(end);
}
await fs.writeFile(new URL('public/images/products/credits.html',root),credits);
