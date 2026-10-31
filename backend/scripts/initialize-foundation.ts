import {createDatabase} from '../src/security/database.js';
import {assertDevelopmentDatabase, initializeDevelopmentFoundation} from '../src/security/development-foundation.js';

const url = process.env.DATABASE_URL;
assertDevelopmentDatabase(url, process.env.NODE_ENV);
const db = createDatabase(url);
try {
  await initializeDevelopmentFoundation(db, url!, process.env.NODE_ENV!);
  console.log('Development VOGPK context initialized idempotently. Existing authentication records preserved.');
} catch {
  console.error('Development initialization failed; sensitive diagnostics suppressed.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
