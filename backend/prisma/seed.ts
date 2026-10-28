import {createDatabase} from '../src/security/database.js';
import {seedSecurity} from '../src/security/provision.js';
const db=createDatabase();
try{await seedSecurity(db);console.log('Default roles and permissions seeded. No account credentials were created.');}finally{await db.$disconnect();}
