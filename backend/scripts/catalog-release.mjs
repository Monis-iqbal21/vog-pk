// Operator-only CLI. No startup hooks, implicit writes, authentication reseeding or credential output.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { createDatabase } from '../dist/security/database.js';
import { assertReleaseTarget } from './release-target.mjs';
import { buildPreflightManifest } from './catalog-preflight-manifest.mjs';
import { digest } from './legacy-catalog-manifest.mjs';
import { importLegacyCatalog } from './import-legacy-catalog.mjs';
import {
  migrationInventory,
  schemaFingerprint,
  authFingerprint,
  initializeReleaseFoundation,
  verifyImportedRelease,
} from './catalog-release-core.mjs';
const [command, ...args] = process.argv.slice(2),
  flags = new Map(
    args.map((a) => {
      const i = a.indexOf('=');
      return i < 0 ? [a, true] : [a.slice(0, i), a.slice(i + 1)];
    }),
  );
let db,
  lock,
  phase = 'configuration',
  journal;
const record = async (status, details = {}) => {
  if (journal)
    await fs.appendFile(
      journal,
      JSON.stringify({
        at: new Date().toISOString(),
        command,
        status,
        ...details,
      }) + '\n',
      { mode: 0o600 },
    );
};
try {
  if (
    !['inspect', 'migrate', 'foundation', 'import', 'verify'].includes(
      command,
    ) ||
    [...flags.keys()].some(
      (k) => !['--plan', '--journal', '--apply', '--confirm'].includes(k),
    ) ||
    !flags.get('--plan') ||
    !flags.get('--journal')
  )
    throw Error('Invalid command');
  const plan = JSON.parse(
      await fs.readFile(String(flags.get('--plan')), 'utf8'),
    ),
    url = process.env.DATABASE_URL;
  const planHash = digest(plan),
    apply = flags.get('--apply') === true;
  if (apply && flags.get('--confirm') !== planHash)
    throw Error('Exact reviewed plan confirmation required');
  const git = (...a) =>
    execFileSync('git', a, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const archiveMarker = await fs
    .readFile('RELEASE_COMMIT', 'utf8')
    .catch(() => null);
  if (archiveMarker) {
    if (archiveMarker.trim() !== plan.releaseSha)
      throw Error('Archive release differs');
    const releaseRoot = path.resolve('..');
    const sources = (await fs.readFile('../RELEASE_SOURCE.sha256', 'utf8'))
      .trim()
      .split('\n');
    for (const line of sources) {
      const match = line.match(
        /^([a-f0-9]{64})  ((?:backend|frontend)\/[^\r\n]+)$/,
      );
      if (!match || match[2].split('/').includes('..'))
        throw Error('Invalid source receipt');
      const file = path.resolve(releaseRoot, match[2]);
      if (
        !file.startsWith(releaseRoot + path.sep) ||
        createHash('sha256')
          .update(await fs.readFile(file))
          .digest('hex') !== match[1]
      )
        throw Error('Prepared source changed');
    }
  } else if (
    git('rev-parse', 'HEAD') !== plan.releaseSha ||
    git(
      'diff',
      'HEAD',
      '--name-only',
      '--',
      'backend',
      'frontend/src/data',
      'frontend/docs',
      'frontend/src/config',
      'frontend/src/lib',
    )
  )
    throw Error('Reviewed release source differs');
  journal = path.resolve(String(flags.get('--journal')));
  if (!journal.startsWith(path.resolve('.local') + path.sep))
    throw Error('Journal must be a private .local artifact');
  await fs.mkdir(path.dirname(journal), { recursive: true, mode: 0o700 });
  const localRoot = await fs.realpath('.local'),
    journalParent = await fs.realpath(path.dirname(journal));
  if (
    journalParent !== localRoot &&
    !journalParent.startsWith(localRoot + path.sep)
  )
    throw Error('Journal parent escapes private directory');
  if ((await fs.lstat(journal).catch(() => null))?.isSymbolicLink())
    throw Error('Journal must not be a symlink');
  const handle = await fs.open(
    journal,
    constants.O_APPEND |
      constants.O_CREAT |
      constants.O_WRONLY |
      (constants.O_NOFOLLOW ?? 0),
    0o600,
  );
  await handle.close();
  if ((await fs.lstat(journal)).isSymbolicLink())
    throw Error('Journal must not be a symlink');
  if (process.platform !== 'win32' && (await fs.stat(journal)).mode & 0o077)
    throw Error('Journal must be private');
  db = createDatabase(url);
  phase = 'target';
  await assertReleaseTarget(db, url, plan);
  await record('START', {
    planHash,
    releaseSha: plan.releaseSha,
    dryRun: !apply,
  });
  lock = new Client({ connectionString: url });
  await lock.connect();
  if (
    !(await lock.query('SELECT pg_try_advisory_lock(78201908) AS locked'))
      .rows[0].locked
  )
    throw Error('Another release operation is active');
  phase = 'manifest';
  const manifest = await buildPreflightManifest();
  if (manifest.checksum !== plan.manifestHash) throw Error('Manifest changed');
  phase = 'migration-history';
  const history = await migrationInventory(db);
  phase = command;
  let result;
  if (command === 'inspect') {
    if (apply) throw Error('Inspect cannot apply changes');
    result = {
      schemaFingerprint: await schemaFingerprint(db),
      ...history,
      planHash,
      manifestHash: manifest.checksum,
    };
  } else if (command === 'migrate') {
    if (
      JSON.stringify(history.applied) !==
        JSON.stringify(plan.baselineMigrations) ||
      (await schemaFingerprint(db)) !== plan.schemaFingerprint
    )
      throw Error('Approved baseline schema/history differs');
    if (
      process.env.CATALOG_ADMIN_WRITES_ENABLED === '1' ||
      process.env.PUBLIC_CATALOG_READS_ENABLED === '1'
    )
      throw Error('Keep catalog gates off for DDL');
    result = { dryRun: !apply, pending: history.pending };
    if (apply) {
      const before = await authFingerprint(db);
      const run = spawnSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        { env: process.env, stdio: 'pipe', timeout: 120000 },
      );
      if (run.status !== 0)
        throw Error(
          'Prisma migration failed; inspect private migration history, never reset',
        );
      if (
        (await migrationInventory(db)).pending.length ||
        before !== (await authFingerprint(db))
      )
        throw Error('Post-migration validation failed');
      result = { ...result, verified: true };
    }
  } else {
    if (history.pending.length)
      throw Error('Apply and verify reviewed schema first');
    if (command === 'foundation') {
      const before = await authFingerprint(db);
      result = await initializeReleaseFoundation(db, plan, { apply });
      if (before !== (await authFingerprint(db)))
        throw Error('Authentication identity changed unexpectedly');
    } else if (command === 'import') {
      // Dry-run validates scope and evidence without calling the mutating importer.
      await initializeReleaseFoundation(db, plan);
      const bridge = await db.legacyStoreBridge.findUnique({
        where: { key: 'default' },
      });
      if (
        !bridge ||
        bridge.tenantId !== plan.tenantId ||
        bridge.storeId !== plan.storeId
      )
        throw Error('Foundation must be applied first');
      result = {
        dryRun: !apply,
        products: 84,
        categories: 12,
        media: 95,
        rightsApproved: 0,
      };
      if (apply) {
        const before = await authFingerprint(db);
        result = await importLegacyCatalog({
          db,
          url,
          base: process.env.CATALOG_OPERATOR_API_ORIGIN,
          token: process.env.CATALOG_OPERATOR_SESSION,
          bffKey: process.env.BFF_SHARED_SECRET,
          actorId: plan.actorId,
          tenantId: plan.tenantId,
          storeId: plan.storeId,
          manifest,
          releasePlan: plan,
          confirm: 'APPROVED_CATALOG_IMPORT',
        });
        if (before !== (await authFingerprint(db)))
          throw Error('Authentication identity changed unexpectedly');
        result.verification = await verifyImportedRelease(db, plan, manifest);
      }
    } else {
      if (apply) throw Error('Verify cannot apply changes');
      result = await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`;
          return verifyImportedRelease(tx, plan, manifest);
        },
        { isolationLevel: 'RepeatableRead', timeout: 30000 },
      );
    }
  }
  await record('PASS', { result });
  console.log(JSON.stringify({ passed: true, command, result }));
} catch (error) {
  await record('FAIL', {
    phase,
    retryPolicy:
      'STOP; inspect sanitized checkpoints; never reset or discard edits',
  }).catch(() => {});
  const safeCode = /^(?:ENOENT|EACCES|EPERM|EINVAL|P\d{4})$/.test(
    error?.code ?? '',
  )
    ? error.code
    : 'GUARD_OR_VALIDATION';
  console.error(
    `Release operation failed closed at ${phase} (${safeCode}). No sensitive diagnostics printed. Inspect the private journal and reviewed runbook.`,
  );
  process.exitCode = 1;
} finally {
  if (lock) {
    await lock.end().catch(() => {});
  }
  await db?.$disconnect();
}
