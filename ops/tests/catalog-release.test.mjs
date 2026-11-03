import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
for(const file of ['ops/deploy-backend.sh','ops/prepare-catalog-release.sh'])if(spawnSync(bash,['-n',file],{encoding:'utf8'}).status!==0)throw Error('Shell syntax failed');
const script=await fs.readFile('ops/deploy-backend.sh','utf8'),awk=script.match(/awk '(NF \{seen=1;[^']+)'/)?.[1];
if(!awk)throw Error('Reviewed binding predicate missing');
for(const [input,status] of [['LISTEN 0 128 127.0.0.1:4000 0.0.0.0:*\n',0],['',1],['LISTEN 0 128 0.0.0.0:4000 0.0.0.0:*\n',1],['LISTEN 0 128 127.0.0.1:4000 0.0.0.0:*\nLISTEN 0 128 [::]:4000 [::]:*\n',1]]){
 const result=spawnSync(bash,['-c',`awk '${awk}'`],{input,encoding:'utf8'});if(result.status!==status)throw Error('Binding predicate failed');
}
console.log('PASS Both deployment scripts parse; loopback-only listener accepted, empty/public/mixed IPv6 listener rejected. No SSH or systemd execution.');
// Execute the real preparation lint block under the same hidden directory shape.
// A deliberate error must be caught; invalid generated code must stay excluded.
const prepare=(await fs.readFile('ops/prepare-catalog-release.sh','utf8')).replaceAll('\r\n','\n');
const block=prepare.split('# BEGIN RELEASE_LINT\n')[1]?.split('# END RELEASE_LINT')[0];
assert.ok(block,'Preparation lint block missing');
const parent=path.resolve('.local');await fs.mkdir(parent,{recursive:true});
const owned=await fs.mkdtemp(path.join(parent,'catalog-lint-regression-'));
const fixture=path.join(owned,'.local','releases','reviewed','backend');
try{
 await fs.mkdir(path.join(fixture,'src/generated'),{recursive:true});await fs.mkdir(path.join(fixture,'test'));
 await fs.symlink(path.resolve('backend/node_modules'),path.join(fixture,'node_modules'),process.platform==='win32'?'junction':'dir');
 await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({private:true,type:'module'}));
 await fs.writeFile(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',strict:true,types:[]},include:['src/**/*.ts','test/**/*.ts'],exclude:['src/generated']}));
 await fs.copyFile('backend/.oxlintrc.json',path.join(fixture,'.oxlintrc.json'));
 await fs.writeFile(path.join(fixture,'src/main.ts'),'export const value: number = 1;\n');
 await fs.writeFile(path.join(fixture,'test/unit.ts'),'export const valid = true;\n');
 await fs.writeFile(path.join(fixture,'src/generated/client.ts'),'Deliberately invalid generated fixture.\n');
 const lint=()=>spawnSync(bash,['-c','set -euo pipefail\n'+block+'\ntrue'],{cwd:fixture,encoding:'utf8',timeout:60000});
 let result=lint();assert.equal(result.status,0,'Valid hidden release sources must be linted successfully: '+result.stderr);
 await fs.writeFile(path.join(fixture,'src/main.ts'),'Promise.resolve(1);\n');
 result=lint();assert.notEqual(result.status,0,'Lint violation must fail preparation');
 assert.match(result.stdout+result.stderr,/no-floating-promises/,'Type-aware lint must catch the deliberate violation');
 await fs.writeFile(path.join(fixture,'src/main.ts'),'export const value: number = 1;\n');
 await fs.writeFile(path.join(fixture,'test/unit.ts'),'Promise.resolve(1);\n');
 result=lint();assert.notEqual(result.status,0,'Test-source lint violation must also fail preparation');
 assert.match(result.stdout+result.stderr,/no-floating-promises/,'Test sources must receive type-aware lint');
 await fs.unlink(path.join(fixture,'src/main.ts'));await fs.unlink(path.join(fixture,'test/unit.ts'));
 result=lint();assert.notEqual(result.status,0,'Zero source files must fail preparation');
 console.log('PASS Hidden-release lint regression: app/test files scanned, real type-aware violation rejected, generated code excluded, and empty input fails closed.');
}finally{
 assert.equal(path.dirname(owned),parent);assert.equal(await fs.realpath(owned),owned);
 await fs.rm(owned,{recursive:true,force:false});
}
