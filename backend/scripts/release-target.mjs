import { z } from 'zod';
import { assertDevelopmentDatabase } from '../dist/security/development-foundation.js';
export const releasePlanSchema = z
  .object({
    version: z.literal(1),
    environment: z.enum(['production', 'isolated']),
    releaseSha: z.string().regex(/^[a-f0-9]{40}$/),
    host: z.string().min(1),
    database: z.string().regex(/^[a-zA-Z0-9_-]+$/),
    port: z.number().int().min(1).max(65535),
    actorId: z.uuid(),
    tenantId: z.uuid(),
    storeId: z.uuid(),
    memberIds: z.array(z.uuid()).min(1).max(1000),
    baselineMigrations: z.array(z.string().regex(/^\d{12}_[a-z_]+$/)).min(1),
    schemaFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    manifestHash: z.literal(
      '264136158ad771573cd526bfa0b2ad8f26eff5306257da2e7886ba3fa1047c04',
    ),
    recovery: z
      .object({
        verifiedAt: z.iso.datetime(),
        encryptedSha256: z.string().regex(/^[a-f0-9]{64}$/),
        isolatedRestorePassed: z.literal(true),
      })
      .strict(),
    presentation: z.enum(['PENDING', 'ACCEPT_GENERIC_PLACEHOLDERS']),
  })
  .strict();
export async function assertReleaseTarget(db, url, input) {
  const plan = releasePlanSchema.parse(input),
    target = new URL(url);
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    target.hostname !== plan.host ||
    decodeURIComponent(target.pathname.slice(1)) !== plan.database ||
    Number(target.port || 5432) !== plan.port ||
    target.hash
  )
    throw Error('Approved database destination mismatch');
  if (plan.environment === 'production') {
    if (
      process.env.NODE_ENV !== 'production' ||
      !/^[a-z0-9-]+\.([a-z0-9-]+\.)*neon\.tech$/.test(plan.host) ||
      plan.host.includes('-pooler.') ||
      !['require', 'verify-full'].includes(target.searchParams.get('sslmode'))
    )
      throw Error('Direct TLS Neon production destination required');
    if (
      Date.now() - Date.parse(plan.recovery.verifiedAt) > 24 * 3600000 ||
      Date.parse(plan.recovery.verifiedAt) > Date.now()
    )
      throw Error('Fresh verified recovery evidence required');
  } else assertDevelopmentDatabase(url, process.env.NODE_ENV);
  const actual = (
    await db.$queryRaw`SELECT current_database() AS name, host(inet_server_addr()) AS address`
  )[0];
  if (
    actual.name !== plan.database ||
    (plan.environment === 'isolated' &&
      !['127.0.0.1', '::1'].includes(actual.address))
  )
    throw Error('Actual database identity mismatch');
  return plan;
}
