// Pure configuration parser, shared by runtime and deployment preflight tests.
const loopback=hostname=>['localhost','127.0.0.1','[::1]'].includes(hostname);
export function resolveAdminSettings(env){
 if(env.VERCEL==='1'&&env.VERCEL_ENV==='preview'){
  const hostname=env.VERCEL_URL??'';
  if(hostname.length>253||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+vercel\.app$/i.test(hostname))throw new Error('Preview requires a valid Vercel deployment hostname in VERCEL_URL');
  const origin=`https://${hostname.toLowerCase()}`;
  if(env.PREVIEW_AUTH_ENABLED!==undefined&&!['true','false'].includes(env.PREVIEW_AUTH_ENABLED))throw new Error('PREVIEW_AUTH_ENABLED must be true or false');
  const previewCookies={sessionCookie:'__Host-vog_admin_preview_session',csrfCookie:'__Host-vog_admin_preview_csrf'};
  if(env.PREVIEW_AUTH_ENABLED!=='true')return {origin,api:null,storefront:null,secret:'',secure:true,...previewCookies,preview:true,authEnabled:false};
  // Reuse the complete hosted validator with only explicitly isolated settings.
  const settings=resolveAdminSettings({NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'production',ADMIN_ENVIRONMENT:'hosted',ADMIN_ORIGIN:origin,API_URL:env.PREVIEW_API_URL,STOREFRONT_ORIGIN:env.PREVIEW_STOREFRONT_ORIGIN,BFF_SHARED_SECRET:env.PREVIEW_BFF_SHARED_SECRET,COOKIE_SECURE:'true'});
  if(settings.api===env.API_URL||settings.secret===env.BFF_SHARED_SECRET)throw new Error('Preview authentication requires a separate backend and bridge secret');
  return {...settings,...previewCookies,preview:true};
 }
 const platformHosted=env.NETLIFY==='true'||env.VERCEL==='1';
 const local=env.ADMIN_ENVIRONMENT==='local'&&!platformHosted||!env.ADMIN_ENVIRONMENT&&env.NODE_ENV!=='production'&&!platformHosted;
 if(platformHosted&&env.ADMIN_ENVIRONMENT==='local')throw new Error('Hosted deployments cannot use local environment mode');
 const exactOrigin=(key,fallback)=>{
  const value=env[key]||(local?fallback:undefined);if(!value)throw new Error(`${key} is required for hosted administration`);
  let url;try{url=new URL(value);}catch{throw new Error(`${key} must be an exact origin`);}
  if(url.origin!==value||!['http:','https:'].includes(url.protocol))throw new Error(`${key} must be an exact origin without path, credentials or query`);
  if(!local&&(url.protocol!=='https:'||loopback(url.hostname)))throw new Error(`${key} must use a non-loopback HTTPS origin for hosted administration`);
  if(local&&url.protocol!=='https:'&&!loopback(url.hostname))throw new Error(`${key} requires HTTPS outside loopback`);
  return value;
 };
 const origin=exactOrigin('ADMIN_ORIGIN','http://localhost:3001'),api=exactOrigin('API_URL','http://127.0.0.1:4000'),storefront=exactOrigin('STOREFRONT_ORIGIN','http://localhost:3000');
 if(local&&!loopback(new URL(origin).hostname))throw new Error('Local mode requires a loopback admin origin');
 if(origin===storefront||origin===api)throw new Error('Admin, storefront and backend origins must be separate');
 const secure=env.COOKIE_SECURE===undefined?!local:env.COOKIE_SECURE==='true';
 if(env.COOKIE_SECURE!==undefined&&!['true','false'].includes(env.COOKIE_SECURE))throw new Error('COOKIE_SECURE must be true or false');
 if(!secure&&(!local||!loopback(new URL(origin).hostname)))throw new Error('Secure cookies are required outside explicit local loopback mode');
 const secret=env.BFF_SHARED_SECRET??'';if(secret.length<64)throw new Error('Configure a random BFF_SHARED_SECRET matching NestJS');
 return {origin,api,storefront,secret,secure,sessionCookie:secure?'__Host-vog_admin_session':'vog_admin_session_dev',csrfCookie:secure?'__Host-vog_admin_csrf':'vog_admin_csrf_dev',authEnabled:true,preview:false};
}
