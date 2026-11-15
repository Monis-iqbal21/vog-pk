import assert from 'node:assert/strict';
import { assertReleaseTarget } from './release-target.mjs';
import { migrationInventory } from './catalog-release-core.mjs';
const saved = process.env.NODE_ENV;
const plan = {
  version: 1,
  environment: 'production',
  releaseSha: 'a'.repeat(40),
  host: 'ep-fixture.ap-south-1.aws.neon.tech',
  database: 'fixture',
  port: 5432,
  actorId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  storeId: '33333333-3333-4333-8333-333333333333',
  memberIds: ['11111111-1111-4111-8111-111111111111'],
  baselineMigrations: ['202610290001_admin_security'],
  schemaFingerprint: '0'.repeat(64),
  manifestHash:
    '264136158ad771573cd526bfa0b2ad8f26eff5306257da2e7886ba3fa1047c04',
  recovery: {
    verifiedAt: new Date().toISOString(),
    encryptedSha256: '0'.repeat(64),
    isolatedRestorePassed: true,
  },
  presentation: 'PENDING',
};
const url = `postgresql://fixture@${plan.host}/fixture?sslmode=require`;
const db = {
  $queryRaw: async () => [{ name: 'fixture', address: '203.0.113.1' }],
};
try {
  process.env.NODE_ENV = 'production';
  assert.equal(
    (await assertReleaseTarget(db, url, plan)).storeId,
    plan.storeId,
  );
  for (const bad of [
    url.replace(plan.host, 'other.neon.tech'),
    url.replace('/fixture?', '/other?'),
    url.replace('sslmode=require', 'sslmode=disable'),
    url.replace('/fixture?', ':5433/fixture?'),
  ])
    await assert.rejects(() => assertReleaseTarget(db, bad, plan));
  for (const delta of [
    {
      recovery: {
        ...plan.recovery,
        verifiedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
      },
    },
    {
      recovery: {
        ...plan.recovery,
        verifiedAt: new Date(Date.now() + 3600000).toISOString(),
      },
    },
    { environment: 'isolated' },
    { platformAccess: true },
  ])
    await assert.rejects(() =>
      assertReleaseTarget(db, url, { ...plan, ...delta }),
    );
  const pooler = {
    ...plan,
    host: 'ep-fixture-pooler.ap-south-1.aws.neon.tech',
  };
  await assert.rejects(() =>
    assertReleaseTarget(db, url.replace(plan.host, pooler.host), pooler),
  );
  await assert.rejects(() =>
    assertReleaseTarget(
      { $queryRaw: async () => [{ name: 'wrong', address: '203.0.113.1' }] },
      url,
      plan,
    ),
  );
  for (const history of [
    [{ name: 'unexpected', checksum: '0', finished: true, rolled_back: false }],
    [
      {
        name: '202610290001_admin_security',
        checksum: '0',
        finished: false,
        rolled_back: false,
      },
    ],
  ])
    await assert.rejects(() =>
      migrationInventory({ $queryRaw: async () => history }),
    );
  console.log(
    'PASS Release guard tests: exact direct TLS target, actual DB identity, fresh recovery attestation, strict plan, no pooler and migration drift/failed history (14 checks; mock metadata only, no network).',
  );
} finally {
  if (saved === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved;
}
