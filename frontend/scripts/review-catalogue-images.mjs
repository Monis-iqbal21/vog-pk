import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
const root = new URL('../', import.meta.url);
const candidates = JSON.parse(await fs.readFile(new URL('docs/catalogue-candidate-research.json',root))).candidates;
const retained = JSON.parse(await fs.readFile(new URL('docs/catalogue-retained-research.json',root)));
const baseline = JSON.parse(await fs.readFile(new URL('docs/catalogue-before-correction.json',root)));
const dir=path.join(os.tmpdir(),'vog-catalogue-review'); await fs.mkdir(dir,{recursive:true});
const all=[...candidates,...retained.filter(r=>!candidates.some(c=>c.oldId===r.id))].filter(x=>x.status===200).map(x=>({...x,category:x.category??baseline.find(p=>p.id===x.id)?.category}));
await fs.writeFile(path.join(dir,'index.json'),JSON.stringify(all,null,2));
for(const category of [...new Set(all.map(x=>x.category))]){
 const rows=all.filter(x=>x.category===category);const layers=[];
 for(let row=0;row<rows.length;row++){
  const x=rows[row]; const label=Buffer.from(`<svg width="840" height="26"><rect width="840" height="26" fill="white"/><text x="5" y="18" font-size="14">${x.id}</text></svg>`);layers.push({input:label,top:row*220,left:0});
  for(let col=0;col<Math.min(4,x.gallery.length);col++){
   const g=x.gallery[col];const dest=path.join(dir,`${x.id}-${col}.png`);
   try {await fs.access(dest);}catch{
    const r=await fetch(g.preview||g.url,{signal:AbortSignal.timeout(25000)});if(!r.ok){console.log(x.id,r.status);if(r.status===429)process.exit(2);continue;}
    await sharp(Buffer.from(await r.arrayBuffer())).resize(200,180,{fit:'contain',background:'#fff',withoutEnlargement:true}).png().toFile(dest);
   }
   layers.push({input:dest,top:row*220+30,left:col*210});
  }
 }
 await sharp({create:{width:840,height:rows.length*220,channels:3,background:'#eee'}}).composite(layers).png().toFile(path.join(dir,`${category}.png`));console.log(category,rows.length);
}
