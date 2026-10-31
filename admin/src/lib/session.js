import 'server-only';
import {cache} from 'react';
import {cookies,headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {adminConfig} from './config';
import {backendRequest} from './api';
import {loginPath} from './return-path';
export const currentAdmin=cache(async()=>{
 const cfg=adminConfig();if(!cfg.authEnabled)return null;
 const token=(await cookies()).get(cfg.sessionCookie)?.value;if(!token)return null;
 const result=await backendRequest('auth/me',{token});
 if(result.status===401)return null;
 if(result.status!==200)throw new Error('Administration service is unavailable. Please retry shortly.');
 const contexts=await backendRequest('contexts/schema',{token});
 if(![200,404].includes(contexts.status))throw new Error('Unable to load authorized configuration contexts.');
 return {...result.data,schemaContexts:contexts.status===200?contexts.data:[]};
});
export async function requireAdmin(){const user=await currentAdmin();if(!user)redirect(loginPath((await headers()).get('x-vog-admin-return-to')));return user;}
