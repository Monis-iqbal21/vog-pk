import {config} from 'dotenv';
config({path:'.env.local',quiet:true});
export function securityConfig(){
 const adminOrigin=process.env.ADMIN_ORIGIN??'http://localhost:3001';
 const storefrontOrigin=process.env.STOREFRONT_ORIGIN??'http://localhost:3000';
 const secret=process.env.BFF_SHARED_SECRET??'';
 const production=process.env.NODE_ENV==='production';
 for(const origin of [adminOrigin,storefrontOrigin]){
  const url=new URL(origin);if(url.origin!==origin||production&&url.protocol!=='https:')throw new Error('Configure exact HTTPS origins in production');
 }
 if(secret.length<64)throw new Error('BFF_SHARED_SECRET must contain at least 64 random characters');
 const number=(key:string,fallback:number,max:number)=>{const value=Number(process.env[key]??fallback);if(!Number.isInteger(value)||value<1||value>max)throw new Error(`Invalid ${key}`);return value;};
 return {adminOrigin,storefrontOrigin,secret,production,idleMs:number('SESSION_IDLE_MINUTES',30,120)*60000,absoluteMs:number('SESSION_ABSOLUTE_HOURS',8,24)*3600000};
}
