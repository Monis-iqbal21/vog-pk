import {modules} from '../config/modules.js';
const base='https://admin.invalid';
export function safeReturnPath(value,fallback='/dashboard'){
 if(typeof value!=='string'||value.length>1024||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value))return fallback;
 try{
  const url=new URL(value,base);
  if(url.origin!==base||!modules.some(module=>module.path===url.pathname))return fallback;
  // Reject normalization tricks rather than silently treating them as a valid path.
  if(value.split(/[?#]/)[0]!==url.pathname)return fallback;
  return url.pathname+url.search+url.hash;
 }catch{return fallback;}
}
export function loginPath(destination){
 const path=safeReturnPath(destination);
 return path==='/dashboard'?'/login':`/login?returnTo=${encodeURIComponent(path)}`;
}
export function authorizedReturnPath(value,permissions=[]){
 const path=safeReturnPath(value),destination=modules.find(module=>module.path===new URL(path,base).pathname);
 return destination&&permissions.includes(destination.permission)?path:'/dashboard';
}
