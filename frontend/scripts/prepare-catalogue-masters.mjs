import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const candidates=JSON.parse(await fs.readFile(new URL('docs/catalogue-candidate-research.json',root))).candidates;
const retained=JSON.parse(await fs.readFile(new URL('docs/catalogue-retained-research.json',root)));
const {selections}=JSON.parse(await fs.readFile(new URL('docs/catalogue-image-selections.json',root)));
const cache=path.join(os.tmpdir(),'vog-catalogue-masters-source');await fs.mkdir(cache,{recursive:true});
const records=[];
for(const x of [...candidates,...retained.filter(r=>!candidates.some(c=>c.oldId===r.id))]){
 const index=selections[x.id];if(index==null)continue;
 const g=x.gallery[index];if(!g)throw Error(`Missing reviewed gallery entry: ${x.id}/${index}`);
 const input=path.join(cache,`${x.id}-${crypto.createHash('sha256').update(g.url).digest('hex').slice(0,10)}.source`);
 try{await fs.access(input);}catch{
  const response=await fetch(g.url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`${x.id}: HTTP ${response.status}; stopped without bypass or retry.`);
  await fs.writeFile(input,Buffer.from(await response.arrayBuffer()));
 }
 const original=await sharp(input).metadata();
 // Trim only a uniform outer border. Keep a small safety border; never segment hardware edges.
 const trimmed=await sharp(input).rotate().trim({threshold:8}).toBuffer({resolveWithObject:true});
 const target=800;
 const hardware=await sharp(trimmed.data).resize(target,target,{fit:'inside',withoutEnlargement:true}).toBuffer({resolveWithObject:true});
 const canvas=Math.max(700,Math.min(1000,Math.round(Math.max(hardware.info.width,hardware.info.height)/0.8)));
 const output=fileURLToPath(new URL(`public/images/products/${x.id}.png`,root));
 await sharp({create:{width:canvas,height:canvas,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).composite([{input:hardware.data,left:Math.floor((canvas-hardware.info.width)/2),top:Math.floor((canvas-hardware.info.height)/2)}]).png({compressionLevel:9}).toFile(output);
 records.push({id:x.id,oldId:x.oldId,sourceUrl:x.apiUrl,downloadUrl:g.url,icecatId:x.icecatId,manufacturerSku:x.returnedCode,galleryIndex:index,sourceWidth:original.width,sourceHeight:original.height,productWidth:hardware.info.width,productHeight:hardware.info.height,width:canvas,height:canvas,format:'png',path:`/images/products/${x.id}.png`,sha256:crypto.createHash('sha256').update(await fs.readFile(output)).digest('hex'),license:'Open Icecat public demo — development evaluation only',licenseUrl:'https://iceclog.com/open-content-license/',permissionUrl:'https://iceclog.com/manual-for-icecat-json-product-requests/',author:'Respective brand / Icecat',developmentOnly:true,modifications:'2026-10-27: uniform outer-border trim, proportional downscale without enlargement, white square canvas; product appearance unchanged.',visualReview:'hardware-only gallery view; SKU/model/colour compared; keyboard layout and RAM kit count checked',qualityException:Math.max(original.width,original.height)<700?'Source hardware extent below preferred 700px; no upscaling. See catalogue correction report.':null});
 await fs.writeFile(new URL('docs/catalogue-master-images.json',root),JSON.stringify(records,null,2)+'\n');
 console.log(x.id,`${hardware.info.width}x${hardware.info.height}`);
 await new Promise(resolve=>setTimeout(resolve,200));
}
