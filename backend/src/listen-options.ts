import {isIP} from 'node:net';

export function listenOptions(env:NodeJS.ProcessEnv=process.env){
 const host=env.HOST??(env.NODE_ENV==='production'?'127.0.0.1':'0.0.0.0');
 if(host!=='localhost'&&!isIP(host))throw new Error('HOST must be an IP address or localhost');
 const raw=env.PORT??'4000',port=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer between 1 and 65535');
 return {host,port};
}
