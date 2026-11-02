import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
for(const file of ['ops/deploy-backend.sh','ops/prepare-catalog-release.sh'])if(spawnSync(bash,['-n',file],{encoding:'utf8'}).status!==0)throw Error('Shell syntax failed');
const script=await fs.readFile('ops/deploy-backend.sh','utf8'),awk=script.match(/awk '(NF \{seen=1;[^']+)'/)?.[1];
if(!awk)throw Error('Reviewed binding predicate missing');
for(const [input,status] of [['LISTEN 0 128 127.0.0.1:4000 0.0.0.0:*\n',0],['',1],['LISTEN 0 128 0.0.0.0:4000 0.0.0.0:*\n',1],['LISTEN 0 128 127.0.0.1:4000 0.0.0.0:*\nLISTEN 0 128 [::]:4000 [::]:*\n',1]]){
 const result=spawnSync(bash,['-c',`awk '${awk}'`],{input,encoding:'utf8'});if(result.status!==status)throw Error('Binding predicate failed');
}
console.log('PASS Both deployment scripts parse; loopback-only listener accepted, empty/public/mixed IPv6 listener rejected. No SSH or systemd execution.');
