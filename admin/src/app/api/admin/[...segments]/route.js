import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {timingSafeEqual} from 'node:crypto';
import {adminConfig,cookieOptions} from '@/lib/config';
import {backendRequest} from '@/lib/api';
const routes={GET:new Set(['auth/me','roles','permissions','staff','audit-logs']),POST:new Set(['auth/login','auth/logout','staff'])};
async function handler(request,{params}){
 const {segments}=await params,path=segments.join('/'),method=request.method,cfg=adminConfig();
 const allowed=routes[method]?.has(path)||method==='PATCH'&&/^staff\/[a-f0-9-]{36}$/.test(path);
 if(!allowed)return NextResponse.json({message:'Not found.'},{status:404});
 const jar=await cookies(),token=jar.get(cfg.sessionCookie)?.value;
 if(method!=='GET'){
  const origin=request.headers.get('origin'),csrf=request.headers.get('x-csrf-token')??'',expected=jar.get(cfg.csrfCookie)?.value??'';
  if(origin!==cfg.origin||request.headers.get('sec-fetch-site')==='cross-site'||!/^[a-f0-9]{64}$/.test(csrf)||Buffer.byteLength(expected)!==64||!timingSafeEqual(Buffer.from(csrf),Buffer.from(expected)))return NextResponse.json({message:'Request verification failed. Reload and try again.'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({message:'JSON is required.'},{status:415});
 }
 if(path!=='auth/login'&&!token)return NextResponse.json({message:'Authentication required.'},{status:401});
 let body;
 if(method!=='GET'){
  try{
   const reader=request.body?.getReader();let size=0,text='';const decoder=new TextDecoder();
   if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return NextResponse.json({message:'Request too large.'},{status:413});}text+=decoder.decode(value,{stream:true});}
   body=JSON.parse(text+decoder.decode());
  }catch{return NextResponse.json({message:'Invalid JSON.'},{status:400});}
 }
 try{
  const clientIp=process.env.TRUST_PROXY_HEADERS==='1'?(request.headers.get('x-vercel-forwarded-for')??request.headers.get('x-forwarded-for')??'unknown').split(',')[0].trim().slice(0,128):'local';
  const result=await backendRequest(path,{method,token,body,clientIp});
  if(path==='auth/login'&&result.status===201){
   const response=NextResponse.json({user:result.data.user},{headers:{'Cache-Control':'no-store'}});
   response.cookies.set(cfg.sessionCookie,result.data.token,{...cookieOptions(cfg.secure),expires:new Date(result.data.expiresAt)});return response;
  }
  const response=NextResponse.json(result.data,{status:result.status,headers:{'Cache-Control':'no-store',...(result.status===429?{'Retry-After':'900'}:{})}});
  if(path==='auth/logout'&&(result.status===201||result.status===401)||result.status===401&&path!=='auth/login'){
   for(const name of [cfg.sessionCookie,cfg.csrfCookie])response.cookies.set(name,'',{...cookieOptions(cfg.secure),maxAge:0});
  }
  return response;
 }catch{return NextResponse.json({message:'Administration service is unavailable. Try again shortly.'},{status:503});}
}
export {handler as GET,handler as POST,handler as PATCH};
