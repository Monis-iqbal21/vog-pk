import {fixtureMedia} from '@/dev/productDetailFixtures';

export async function GET(request,{params}){
 if(process.env.NODE_ENV!=='development'||process.env.VOG_ENABLE_DETAIL_FIXTURES!=='1')return new Response('Not found',{status:404});
 const {name}=await params,key=name.replace(/\.svg$/,''),media=Object.hasOwn(fixtureMedia,key)?fixtureMedia[key]:null;
 if(!media||name!==`${key}.svg`)return new Response('Not found',{status:404});
 // Original geometric layout fixtures; these are not hardware photographs.
 const background=key==='black'?'#111827':key==='white'?'#ffffff':key==='gray'?'#94a3b8':'#eff6ff';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${media.width}" height="${media.height}" viewBox="0 0 ${media.width} ${media.height}"><rect width="100%" height="100%" fill="${background}"/><rect x="12" y="12" width="${media.width-24}" height="${media.height-24}" fill="none" stroke="#2563eb" stroke-width="6"/><text x="50%" y="50%" text-anchor="middle" fill="${key==='black'?'#ffffff':'#0f172a'}" font-family="sans-serif" font-size="28">DEVELOPMENT ${key.toUpperCase()} FIXTURE</text></svg>`;
 return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
