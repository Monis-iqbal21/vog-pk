// Pure configuration parser, shared by runtime and deployment preflight tests.
const loopback=hostname=>['localhost','127.0.0.1','[::1]'].includes(hostname);
export function resolveAdminSettings(env){
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
 return {origin,api,storefront,secret,secure,sessionCookie:secure?'__Host-vog_admin_session':'vog_admin_session_dev',csrfCookie:secure?'__Host-vog_admin_csrf':'vog_admin_csrf_dev'};
}
