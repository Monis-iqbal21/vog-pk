import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
// Whole-PCB crops checked against the original photographs. Nothing is reconstructed or enlarged.
const rows=[
 ['amd-ryzen7-9800x3d','amd-ryzen9-9950x','AMD','Ryzen 9 9950X (Tray)','AMD_Ryzen_9_9950X.jpg',[340,310,2660,2650],149999,'https://www.zahcomputers.pk/product/amd-ryzen-9-9950x-4-3-ghz-16-core-am5-gaming-processor-tray/',16,32,'AM5','5.7 GHz',170],
 ['intel-core-ultra9-285k','intel-core-i7-13700k-tray','Intel','Core i7-13700K (Tray)','Intel_Core_i7_13700K.jpg',[250,100,2830,3380],99999,'https://www.shophive.com/intel-core-i7-13700k-5-4ghz-16-core-tray-processor/',16,24,'LGA 1700','5.4 GHz',125],
 ['amd-ryzen9-9950x3d','intel-core-i5-13600k','Intel','Core i5-13600K','Intel_Core_i5_13600K.jpg',[365,170,2530,3000],81999,'https://www.shophive.com/intel-core-i5-13600k-5-10ghz-14-core-processor/',14,20,'LGA 1700','5.1 GHz',125],
 ['intel-core-ultra7-265k','intel-core-i7-12700k-tray','Intel','Core i7-12700K (Tray)','Intel_Core_i7_12700K.jpg',[160,290,2400,2860],75000,'https://zahcomputers.pk/product/intel-core-i7-12700k-core-i7-12th-gen-alder-lake-12-core-8p4e-3-6-ghz-lga-1700-125w-intel-uhd-graphics-770-desktop-processor-tray/',12,20,'LGA 1700','5 GHz',125],
 ['intel-core-i7-14700k','intel-core-i7-12700kf-tray','Intel','Core i7-12700KF (Tray)','2023_Intel_Core_i7_12700KF_(3).jpg',[255,250,2250,2660],70000,'https://zahcomputers.pk/page/3/?filter_category=projector%2Cmac-studio%2Cdesktop-computers%2Cprocessors%2Cpre-builds&post_type=product&shop_view=list',12,20,'LGA 1700','5 GHz',125],
 ['amd-ryzen9-9900x-tray','intel-core-i5-11400','Intel','Core i5-11400','Intel_Core_i5_11400.jpg',[90,80,2270,2270],44999,'https://www.shophive.com/intel-core-i5-11400-processor',6,12,'LGA 1200','4.4 GHz',65],
];
const records=[];
for(const [oldId,id,brand,model,filename,crop,price,url,cores,threads,socket,boost,power] of rows){
 const input=path.join(os.tmpdir(),filename);
 const sourceHash=crypto.createHash('md5').update(filename).digest('hex');
 const downloadUrl=`https://upload.wikimedia.org/wikipedia/commons/${sourceHash[0]}/${sourceHash.slice(0,2)}/${encodeURIComponent(filename)}`;
 try{await fs.access(input);}catch{
  const response=await fetch(downloadUrl,{headers:{'User-Agent':'VOGPK-development-image-review/1.0'},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`Source download stopped: ${filename}, HTTP ${response.status}; respect any Retry-After header.`);
  await fs.writeFile(input,Buffer.from(await response.arrayBuffer()));
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const meta=await sharp(input).metadata();
 const [left,top,width,height]=crop;
 const hardware=await sharp(input).extract({left,top,width,height}).resize(800,800,{fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
 const output=fileURLToPath(new URL(`public/images/products/${id}.png`,root));
 await sharp({create:{width:1000,height:1000,channels:4,background:'white'}}).composite([{input:hardware.data,left:Math.floor((1000-hardware.info.width)/2),top:Math.floor((1000-hardware.info.height)/2)}]).png({compressionLevel:9}).toFile(output);
 const bysa=filename.startsWith('2023_');
 records.push({id,oldId,brand,model,category:'processors',referencePricePKR:price,priceSourceUrl:url,sourceCheckedAt:'2026-10-27',specs:{'Cores':cores,'Threads':threads,'Socket':socket,'Maximum boost':boost,'Base power':`${power} W`},shortDescription:`${cores} cores and ${threads} threads for ${socket} systems; up to ${boost} boost.`,sourceUrl:`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename)}`,downloadUrl:`https://upload.wikimedia.org/wikipedia/commons/${crypto.createHash('md5').update(filename).digest('hex').slice(0,1)}/${crypto.createHash('md5').update(filename).digest('hex').slice(0,2)}/${encodeURIComponent(filename)}`,author:bysa?'Jacek Halicki':'4300streetcar',license:bysa?'CC BY-SA 4.0':'CC BY 4.0',licenseUrl:bysa?'https://creativecommons.org/licenses/by-sa/4.0/':'https://creativecommons.org/licenses/by/4.0/',sourceWidth:meta.width,sourceHeight:meta.height,width:1000,height:1000,productWidth:hardware.info.width,productHeight:hardware.info.height,path:`/images/products/${id}.png`,format:'png',sha256:crypto.createHash('sha256').update(await fs.readFile(output)).digest('hex'),developmentOnly:true,modifications:'2026-10-27: conservative whole-PCB crop with safety margin, proportional reduction, white square canvas; no background synthesis, no upscaling.',visualReview:'Printed model marking and entire processor PCB checked. Original white-paper background preserved in the crop.',qualityException:id==='intel-core-i5-11400'?'Development specimen has visible lid wear; replace with a pristine authorized packshot before launch.':null});
}
await fs.writeFile(new URL('docs/catalogue-processor-images.json',root),JSON.stringify(records,null,2)+'\n');
console.log(`${records.length} exact-model processor masters prepared.`);
