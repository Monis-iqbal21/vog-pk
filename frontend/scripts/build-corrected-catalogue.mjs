import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(`docs/${name}`,root),'utf8'));
const baseline=await read('catalogue-before-correction.json');
const candidates=(await read('catalogue-candidate-research.json')).candidates;
const retained=await read('catalogue-retained-research.json');
const masters=await read('catalogue-master-images.json');
const cpus=await read('catalogue-processor-images.json');
const references=new Map((await read('catalogue-approved-references.json')).references.map(([id,price,url])=>[id,{price,url}]));
const specificationCorrections=await read('catalogue-specification-corrections.json');
for(const x of [...candidates,...retained])if(specificationCorrections[x.id])x.specs={...x.specs,...specificationCorrections[x.id].specs};
if(masters.length!==77)throw Error(`Expected 77 reviewed non-CPU masters, found ${masters.length}`);
const oldCpu=baseline.find(x=>x.id==='intel-core-i9-14900k');
const oldInput=fileURLToPath(new URL(`public${oldCpu.image}`,root));
const oldPhoto=await sharp(oldInput).trim({threshold:8}).png().toBuffer({resolveWithObject:true});
const canvas=Math.max(700,Math.round(Math.max(oldPhoto.info.width,oldPhoto.info.height)/.8));
const oldOutput=fileURLToPath(new URL('public/images/products/intel-core-i9-14900k.png',root));
await sharp({create:{width:canvas,height:canvas,channels:4,background:'white'}}).composite([{input:oldPhoto.data,left:Math.floor((canvas-oldPhoto.info.width)/2),top:Math.floor((canvas-oldPhoto.info.height)/2)}]).png({compressionLevel:9}).toFile(oldOutput);
const images=[...masters,...cpus,{id:oldCpu.id,oldId:oldCpu.id,path:'/images/products/intel-core-i9-14900k.png',format:'png',width:canvas,height:canvas,productWidth:oldPhoto.info.width,productHeight:oldPhoto.info.height,sourceWidth:600,sourceHeight:575,sourceUrl:'https://commons.wikimedia.org/wiki/File:Intel_i9-14900K.webp',author:'ArtyomK2707',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',developmentOnly:true,modifications:'2026-10-27: preserved existing exact-model photograph, removed uniform border and centered on white canvas without enlargement.',visualReview:'Complete CPU and i9-14900K lid marking visually checked.',qualityException:'Original is only 600×575px. Sharp at card size, but below the preferred source resolution; higher-resolution approved replacement still required.',sha256:crypto.createHash('sha256').update(await fs.readFile(oldOutput)).digest('hex')}];
const specKeys={
 'graphics-cards':['Graphics processor','Discrete graphics card memory','Graphics card memory type','Memory bus','Interface type','Cooling type','Number of fans','HDMI ports quantity','DisplayPorts quantity'],
 ram:['Internal memory','Memory layout (modules x size)','Internal memory type','Memory data transfer rate','Memory clock speed','CAS latency','Memory form factor','Product colour'],
 'gaming-mice':['Movement detection technology','Movement resolution','Device interface','Buttons quantity','Form factor','Weight','Product colour'],
 keyboards:['Keyboard layout','Keyboard language','Keyboard form factor','Keyboard key switch','Keyboard key switch technology','Device interface','Product colour'],
 motherboards:['Processor socket','Motherboard chipset','Motherboard form factor','Supported memory types','Memory slots type','Number of memory slots','Top Wi-Fi standard','Ethernet interface type'],
 storage:['SSD capacity','SSD form factor','Interface','NVMe','Read speed','Write speed','Memory type'],
 monitors:['Display diagonal','Display resolution','Panel type','Display technology','Maximum refresh rate','Response time','Display surface','Screen shape','Product colour'],
 'power-supplies':['Total power','80 PLUS certification','Cabling type','Power supply unit (PSU) form factor','Fan diameter','Product colour'],
 'pc-cases':['Form factor','Type','Supported motherboard form factors','Number of front fans supported (max)','Maximum CPU cooler height','Maximum graphics card length','Width','Height','Depth','Product colour'],
 cooling:['Type','Radiator width','Radiator depth','Number of fans','Fan diameter','Supported processor sockets','Product colour'],
 accessories:['Product type','Width','Depth','Thickness','Material','Surface coloration','Product colour'],
};
const clean=value=>String(value).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim();
function facts(x,category){return Object.fromEntries((specKeys[category]??[]).filter(k=>x.specs?.[k]!=null).map(k=>[k,clean(x.specs[k])]));}
function description(x,category){
 const s=k=>x.specs?.[k]?clean(x.specs[k]):null;
 switch(category){
  case 'graphics-cards':return `${s('Discrete graphics card memory')} ${s('Graphics card memory type')} on ${s('Graphics processor')}; ${s('Interface type')} connectivity.`;
  case 'ram':return `${s('Internal memory')} ${s('Internal memory type')} memory (${s('Memory layout (modules x size)')}); ${s('Memory data transfer rate')??s('Memory clock speed')} rated speed.`;
  case 'gaming-mice':return `${s('Movement resolution')} optical gaming mouse with ${s('Device interface')} connectivity.`;
  case 'keyboards':return `${s('Keyboard form factor')} gaming keyboard with ${(s('Keyboard key switch technology')??s('Keyboard key switch')).replace(/ key switch/i,'').toLowerCase()} switches and ${s('Device interface')} connectivity.`;
  case 'motherboards':return `${s('Motherboard chipset')} motherboard for ${s('Processor socket')}; ${s('Motherboard form factor')} format with ${s('Supported memory types')} support.`;
  case 'storage':return `${s('SSD capacity')} ${s('SSD form factor')} NVMe storage; ${s('Interface')} interface and up to ${s('Read speed')} reads.`;
  case 'monitors':return `${s('Display diagonal')} gaming display with ${s('Display resolution')} resolution and a ${s('Maximum refresh rate')} maximum refresh rate.`;
  case 'power-supplies':return `${s('Total power')} power supply with ${s('80 PLUS certification')} efficiency certification and ${s('Cabling type')?.toLowerCase()} cabling.`;
  case 'pc-cases':return `${x.model} chassis with ${s('Supported motherboard form factors')} motherboard support${s('Maximum graphics card length')?`; ${s('Maximum graphics card length')} graphics-card clearance`:'. Compact tower design'}.`;
  case 'cooling':return `${x.model} liquid CPU cooler with ${parseInt(s('Number of fans')??(x.model.includes('240')?'2':'3'),10)} fans, each ${s('Fan diameter')} in diameter.`;
  case 'accessories':return x.id==='asus-rog-herculx'?'Adjustable graphics-card support with integrated RGB lighting for supported desktop cases.':`${x.model} gaming surface, ${s('Width')} × ${s('Depth')}${s('Thickness')?` × ${s('Thickness')}`:''}, with a non-slip base.`;
  default:throw Error(`Missing description for ${x.id}`);
 }
}
const intelPages={
 'intel-core-i7-13700k-tray':['230500','intel-core-i713700k-processor-30m-cache-up-to-5-40-ghz'],
 'intel-core-i5-13600k':['230493','intel-core-i513600k-processor-24m-cache-up-to-5-10-ghz'],
 'intel-core-i7-12700k-tray':['134594','intel-core-i712700k-processor-25m-cache-up-to-5-00-ghz'],
 'intel-core-i7-12700kf-tray':['134595','intel-core-i712700kf-processor-25m-cache-up-to-5-00-ghz'],
 'intel-core-i5-11400':['212270','intel-core-i511400-processor-12m-cache-up-to-4-40-ghz'],
};
const products=baseline.map(old=>{
 const cpu=cpus.find(x=>x.oldId===old.id);
 const candidate=candidates.find(x=>x.oldId===old.id);
 const x=cpu??candidate??retained.find(x=>x.id===old.id);
 const id=x?.id??old.id;
 const asset=images.find(x=>x.id===id);if(!asset)throw Error(`No approved photo for ${id}`);
 const price=cpu?{price:cpu.referencePricePKR,url:cpu.priceSourceUrl}:references.get(id);
 if(id!==old.id&&!price)throw Error(`Replacement missing independent reference price: ${id}`);
 const spec=cpu?cpu.specs:x?facts(x,old.category):{'Cores':24,'Threads':32,'Socket':'LGA 1700','Maximum boost':'6 GHz'};
 const model=x?.model??old.modelIdentifier;
 const brand=x?.brand??old.brand;
 const manufacturerUrl=cpu?(intelPages[id]?`https://www.intel.com/content/www/us/en/products/sku/${intelPages[id][0]}/${intelPages[id][1]}/specifications.html`:'https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-9-9950x.html'):(x?x.manufacturerUrl??null:old.manufacturerUrl??'https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i914900k-processor-36m-cache-up-to-6-00-ghz/specifications.html');
 const result={...old,id,slug:id,brand,name:`${brand} ${model}`,modelIdentifier:model,
  shortDescription:cpu?cpu.shortDescription:x?.model?description(x,old.category):old.shortDescription,
  specifications:spec,specificationSourceUrl:cpu?manufacturerUrl:x?.apiUrl??manufacturerUrl,
  specificationVerification:cpu?'primary-manufacturer-cores-socket-boost-confirmed':'Open-Icecat-exact-SKU-facts-and-visual-variant-compared',
  specificationCorrectionSourceUrl:specificationCorrections[id]?.sourceUrl??null,
  manufacturerUrl,manufacturerSku:x?.returnedCode??x?.productCode??(id===old.id?old.manufacturerSku:null),
  image:asset.path,imageAlt:`${brand} ${model} — complete product on a neutral background`,imageIsPlaceholder:false,
  imageCreditUrl:`/images/products/credits.html#${id}`,imageDevelopmentOnly:true,
  imageSourceUrl:asset.downloadUrl??asset.sourceUrl,imageUsageStatus:`development-only; ${asset.license}; attribution-and-launch-review-required`,
  imageQualityStatus:asset.qualityException?'documented-development-exception':'reviewed-product-only',
  referencePricePKR:price?.price??old.referencePricePKR,sourceUrl:price?.url??old.sourceUrl,detailSourceUrl:price?.url??old.detailSourceUrl,
  sourceCheckedAt:price?'2026-10-27':old.sourceCheckedAt,
  sourceVerification:'observed-public-retailer-reference; reconfirm-before-launch',
  referencePriceVerification:'observed-PKR-reference; not-a-selling-price',
  price:null,regularPrice:null,salePrice:null,pricingApproved:false,inventoryVerified:false,stock:null,status:'demo',
 };
 if(!Object.keys(spec).length||/\bnull\b|undefined/.test(result.shortDescription))throw Error(`Incomplete facts for ${id}: ${result.shortDescription}`);
 return result;
});
await fs.writeFile(new URL('src/data/catalogue-products.js',root),`// Generated by scripts/build-corrected-catalogue.mjs from reviewed source records.\nexport const catalogueProducts = ${JSON.stringify(products,null,2)};\n`);
await fs.writeFile(new URL('src/data/catalogue-images.js',root),`// Development-only image credits and exact source records.\nexport const catalogueImages = ${JSON.stringify(Object.fromEntries(images.map(x=>[x.id,{...x,alt:products.find(p=>p.id===x.id).imageAlt}])),null,2)};\n`);
await fs.writeFile(new URL('docs/catalogue-image-manifest.json',root),JSON.stringify(images,null,2)+'\n');
const changes=products.map((p,i)=>({oldId:baseline[i].id,oldName:baseline[i].name,newId:p.id,newName:p.name,category:p.category,productReplaced:p.id!==baseline[i].id,image:p.image,referencePricePKR:p.referencePricePKR,sourceUrl:p.sourceUrl,sourceCheckedAt:p.sourceCheckedAt,imageSourceUrl:p.imageSourceUrl,qualityException:images.find(x=>x.id===p.id).qualityException??null}));
await fs.writeFile(new URL('docs/catalogue-corrections.json',root),JSON.stringify({checkedAt:'2026-10-27',changes},null,2)+'\n');
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const entries=images.map(x=>`<article id="${x.id}"><h2>${esc(products.find(p=>p.id===x.id).name)}</h2><p>© ${esc(x.author)}. <a href="${esc(x.sourceUrl)}">Source record</a> · <a href="${esc(x.licenseUrl)}">${esc(x.license)}</a>.</p><p>${esc(x.modifications)}</p>${x.qualityException?`<p>Pending: ${esc(x.qualityException)}</p>`:''}</article>`).join('\n');
await fs.writeFile(new URL('public/images/products/credits.html',root),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VOGPK development image credits</title><style>body{max-width:900px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui;color:#172033}article{border-top:1px solid #ddd;margin-top:24px;padding-top:12px}a{color:#245bff}h2{font-size:20px}</style><h1>Development catalogue image credits</h1><p>Development/demo use only. All assets require launch review. No retailer photography has been copied. Product and brand owners do not endorse VOGPK.</p><p>Open Icecat copyright and database rights remain with Icecat and the respective brands. These demo API assets are used only for local evaluation under the documented <a href="https://iceclog.com/manual-for-icecat-json-product-requests/">public demonstration workflow</a>. Regular/production use requires an appropriate Icecat account and authorization. Please consider supporting participating brands.</p><p>Icecat content and adapted images are supplied AS IS, without warranties, including accuracy, fitness or non-infringement. See the <a href="OPEN-ICECAT-LICENSE.txt">local Open Content License 1.4 copy</a> and <a href="https://iceclog.com/open-content-license/">current license</a>. Adapted Icecat assets remain subject to that license; Creative Commons derivatives retain the linked source license, including ShareAlike where applicable.</p><p>Changes: conventional border trimming, whole-product crops where documented, proportional reduction and white square canvases on 27 October 2026. No generated hardware or reconstructed details.</p>${entries}</html>`);
console.log(JSON.stringify({products:products.length,replaced:changes.filter(x=>x.productReplaced).length,realImages:images.length,exceptions:images.filter(x=>x.qualityException).map(x=>x.id)},null,2));
