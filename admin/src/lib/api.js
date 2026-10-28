import 'server-only';
import {adminConfig} from './config';
export async function backendRequest(path,{method='GET',token,body,clientIp}={}){
 const cfg=adminConfig();
 const headers={'x-admin-bff-key':cfg.secret,'Content-Type':'application/json'};
 if(token)headers.Authorization=`Bearer ${token}`;
 if(clientIp)headers['x-admin-client-ip']=clientIp;
 const response=await fetch(`${cfg.api}/api/admin/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
 let data;try{data=await response.json();}catch{data={message:'The service is temporarily unavailable.'};}
 return {status:response.status,data};
}
