// Builds a clean Preview without runtime secrets, then probes the real Next server.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url);
const nextCli=require.resolve('next/dist/bin/next');
const scope=path.resolve(root,'../.local');await fs.mkdir(scope,{recursive:true});
const fixture=await fs.mkdtemp(path.join(scope,'admin-preview-'));
const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','COMSPEC','ComSpec','HOME','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
Object.assign(env,{NODE_ENV:'production',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'vog-admin-security-fixture.vercel.app',NEXT_TELEMETRY_DISABLED:'1'});
let server,trap,trapRequests=0,checks=0,phase='fixture';
const log=[];
async function command(args,settings=env){
 const child=spawn(process.execPath,args,{cwd:fixture,env:settings,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>log.push(chunk.toString()));child.stderr.on('data',chunk=>log.push(chunk.toString()));
 const timeout=setTimeout(()=>child.kill(),120000);
 try{const [code]=await once(child,'exit');return code;}finally{clearTimeout(timeout);}
}
try{
 for(const name of ['src','public','scripts/check-config.mjs','package.json','package-lock.json','jsconfig.json','next.config.mjs']){
  const target=path.join(fixture,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.cp(path.join(root,name),target,{recursive:true});
 }
 await fs.symlink(path.join(root,'node_modules'),path.join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
 // A workspace-local test fixture must allow resolving the existing dependency link.
 const config=path.join(fixture,'next.config.mjs');
 await fs.writeFile(config,(await fs.readFile(config,'utf8')).replace('turbopack: {',`turbopack: { root: ${JSON.stringify(path.resolve(root,'..'))},`));
 phase='production preflight';
 assert.notEqual(await command(['scripts/check-config.mjs'],{...env,VERCEL_ENV:'production'}),0);checks++;
 phase='secret-free preview preflight/build';
 assert.equal(await command(['scripts/check-config.mjs']),0);checks++;
 assert.equal(await command([nextCli,'build']),0);checks++;
 trap=http.createServer((_request,response)=>{trapRequests++;response.writeHead(401,{'Content-Type':'application/json'});response.end('{"message":"fixture"}');});
 trap.listen(0,'127.0.0.1');await once(trap,'listening');
 const listener=http.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const runtime={...env,ADMIN_ENVIRONMENT:'local',ADMIN_ORIGIN:'https://production-admin.example.com',API_URL:`http://127.0.0.1:${trap.address().port}`,STOREFRONT_ORIGIN:'https://production-store.example.com',BFF_SHARED_SECRET:'test-only-ignored-runtime-config-'.repeat(4),COOKIE_SECURE:'false'};
 phase='preview runtime';
 server=spawn(process.execPath,[nextCli,'start','--hostname','127.0.0.1','--port',String(port)],{cwd:fixture,env:runtime,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>log.push(chunk.toString()));server.stderr.on('data',chunk=>log.push(chunk.toString()));
 let exited=false;server.once('exit',()=>{exited=true;});const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<100;i++){if(exited)throw new Error('Preview server exited');try{if((await fetch(base+'/login')).status===200)break;}catch{}if(i===99)throw new Error('Startup timeout');await new Promise(resolve=>setTimeout(resolve,100));}
 const page=await fetch(base+'/login'),html=await page.text();assert.equal(page.status,200);assert.match(html,/Sign-in is disabled/);assert.doesNotMatch(html,/name="password"/);checks++;
 const headers={Cookie:'__Host-vog_admin_session='+'0'.repeat(64)+'; __Host-vog_admin_preview_session='+'0'.repeat(64)};
 for(const section of ['','dashboard','products','categories','variants','media','homepage','coupons','orders','settings','staff','audit-logs']){
  const result=await fetch(base+'/'+section,{headers,redirect:'manual'});assert.equal(result.status,307);assert.equal(new URL(result.headers.get('location'),base).pathname,'/login');checks++;
 }
 for(const [method,route] of [['GET','auth/me'],['GET','roles'],['GET','permissions'],['GET','staff'],['GET','audit-logs'],['POST','auth/login'],['POST','auth/logout'],['POST','staff'],['PATCH','staff/00000000-0000-4000-8000-000000000000']]){
  const result=await fetch(base+'/api/admin/'+route,{method,headers:{...headers,Origin:'https://'+env.VERCEL_URL,'Content-Type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
  assert.equal(result.status,503);assert.equal(result.headers.get('set-cookie'),null);assert.match(result.headers.get('cache-control'),/no-store/);assert.match((await result.json()).message,/disabled for this preview/);checks++;
 }
 const csrf=await fetch(base+'/api/auth/csrf');assert.equal(csrf.status,503);assert.equal(csrf.headers.get('set-cookie'),null);checks++;
 assert.equal(trapRequests,0);checks++;
 const chunks=path.join(fixture,'.next/static');
 async function scan(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await scan(file);else if(entry.name.endsWith('.js'))assert.equal((await fs.readFile(file,'utf8')).includes(runtime.BFF_SHARED_SECRET),false);}}
 await scan(chunks);checks++;
 console.log({passed:true,checks,secretFreePreviewBuild:true,productionMissingConfigRejected:true,protectedRoutesDenied:true,authAndPrivilegedApiDenied:true,noAuthCookiesIssued:true,backendRequests:trapRequests,productionValuesIgnored:true});
}catch{
 await fs.writeFile(path.join(scope,'admin-preview-validation.log'),log.join(''));
 console.error('Preview security verification failed at '+phase+'. Private fixture diagnostics retained locally.');process.exitCode=1;
}finally{
 if(server&&server.exitCode===null&&server.signalCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
 if(trap)await new Promise(resolve=>trap.close(resolve));
 // Validate the absolute cleanup scope; remove the dependency link before recursion.
 if(path.dirname(path.resolve(fixture))!==scope||!path.basename(fixture).startsWith('admin-preview-'))throw new Error('Unsafe fixture cleanup path');
 await fs.unlink(path.join(fixture,'node_modules')).catch(error=>{if(error.code!=='ENOENT')throw error;});
 await fs.rm(fixture,{recursive:true,force:true});
}
