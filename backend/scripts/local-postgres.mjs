// Optional local development helper; never run this wrapper as production DB hosting.
import 'dotenv/config';
import {config} from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs/promises';
import path from 'node:path';
config({path:'.env.local',quiet:true});
const password=process.env.LOCAL_POSTGRES_PASSWORD;
if(!password||password.length<32)throw new Error('Set a random LOCAL_POSTGRES_PASSWORD in .env.local first');
const databaseDir=path.resolve('.local/postgres');
const db=new EmbeddedPostgres({databaseDir,user:'vog_local',password,port:5433,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
try{await fs.access(path.join(databaseDir,'PG_VERSION'));}catch{await db.initialise();}
await db.start();
const client=db.getPgClient();await client.connect();
for(const name of ['vog_admin_dev','vog_admin_test']){
 const result=await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[name]);
 if(!result.rowCount)await client.query(`CREATE DATABASE ${name}`);
}
await client.end();
console.log('Project-local PostgreSQL ready on 127.0.0.1:5433 (dev and isolated test databases).');
let stopping=false;async function stop(){if(stopping)return;stopping=true;await db.stop();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
setInterval(()=>{},60000);
