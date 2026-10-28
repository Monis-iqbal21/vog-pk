// One-time helper: creates random local-only secrets without printing them.
import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
const backend=path.resolve('.env.local'),admin=path.resolve('../admin/.env.local');
for(const file of [backend,admin]){try{await fs.access(file);throw new Error('An environment file already exists; configure it manually without overwriting');}catch(error){if(error.code!=='ENOENT')throw error;}}
const secret=randomBytes(32).toString('hex'),password=randomBytes(32).toString('hex');
await fs.writeFile(backend,`DATABASE_URL=postgresql://vog_local:${password}@127.0.0.1:5433/vog_admin_dev\nTEST_DATABASE_URL=postgresql://vog_local:${password}@127.0.0.1:5433/vog_admin_test\nLOCAL_POSTGRES_PASSWORD=${password}\nBFF_SHARED_SECRET=${secret}\nADMIN_ORIGIN=http://localhost:3001\nSTOREFRONT_ORIGIN=http://localhost:3000\nPORT=4000\n`,{flag:'wx'});
await fs.writeFile(admin,`ADMIN_ENVIRONMENT=local\nADMIN_ORIGIN=http://localhost:3001\nSTOREFRONT_ORIGIN=http://localhost:3000\nAPI_URL=http://127.0.0.1:4000\nBFF_SHARED_SECRET=${secret}\nCOOKIE_SECURE=false\n`,{flag:'wx'});
console.log('Local environment files created with generated secrets. No owner account or default password was created.');
