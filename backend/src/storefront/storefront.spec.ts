import { describe, it, expect, afterEach } from 'vitest';
import { facetQuery, query } from './query.js';
import { predicate } from './sql.js';
import { StorefrontService } from './storefront.service.js';
import type { DatabaseService } from '../security/database.js';
import type { CategoryFiltersService } from '../categories/filters.service.js';
import type { LocalMediaStorage } from '../operations/storage.js';
const saved = { ...process.env };
afterEach(() => {
  for (const key of [
    'PUBLIC_CATALOG_MODE',
    'PUBLIC_CATALOG_STORE_ID',
    'PUBLIC_CATALOG_TENANT_ID',
    'PUBLIC_CATALOG_READS_ENABLED',
    'NODE_ENV',
    'DATABASE_URL',
  ])
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
});
describe('public storefront boundary', () => {
  it('production reads require a separate exact cutover switch and fixed tenant/store', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      PUBLIC_CATALOG_MODE: 'production',
      PUBLIC_CATALOG_STORE_ID: '11111111-1111-4111-8111-111111111111',
      PUBLIC_CATALOG_TENANT_ID: '22222222-2222-4222-8222-222222222222',
    });
    delete process.env.PUBLIC_CATALOG_READS_ENABLED;
    let queried = false;
    const tx = {
      store: {
        findFirst: async ({
          where,
        }: {
          where: { id: string; tenantId: string };
        }) => {
          queried = true;
          expect(where.id).toBe(process.env.PUBLIC_CATALOG_STORE_ID);
          expect(where.tenantId).toBe(process.env.PUBLIC_CATALOG_TENANT_ID);
          return null;
        },
      },
    } as unknown as DatabaseService;
    const service = new StorefrontService(
      tx,
      {} as CategoryFiltersService,
      {} as LocalMediaStorage,
    );
    await expect(service.context(tx)).rejects.toThrow('not enabled');
    expect(queried).toBe(false);
    process.env.PUBLIC_CATALOG_READS_ENABLED = 'true';
    await expect(service.context(tx)).rejects.toThrow('not enabled');
    process.env.PUBLIC_CATALOG_READS_ENABLED = '1';
    await expect(service.context(tx)).rejects.toThrow('unavailable');
    expect(queried).toBe(true);
  });
  it('bounds pagination, sort, category and scope inputs', () => {
    for (const input of [
      { storeId: 'x' },
      { tenantId: 'x' },
      { pageSize: 25 },
      { page: 0 },
      { sort: 'sql' },
      { filters: 'a'.repeat(4097) },
    ])
      expect(() => query.parse(input)).toThrow();
    expect(query.parse({}).pageSize).toBe(12);
  });
  it('parses repeated OR values without prototype collisions and rejects excessive query input', () => {
    expect(facetQuery('color=black&color=white').color).toEqual([
      'black',
      'white',
    ]);
    expect(facetQuery('constructor=value').constructor).toEqual(['value']);
    for (const raw of [
      '../x=y',
      'x=' + 'a'.repeat(121),
      Array(42).fill('x=a').join('&'),
    ])
      expect(() => facetQuery(raw)).toThrow();
  });
  it('parameterizes values and requires price on the same retail SKU alias', () => {
    const sql = predicate({
      source: 'PRICE',
      attributeId: null,
      level: 'SKU',
      kind: 'range',
      min: '12.34',
      max: '99',
      currency: 'PKR',
      versionIds: [],
    });
    expect(sql.sql).toContain('o.amount');
    expect(sql.sql).toContain('lr."sellingMode"');
    expect(sql.values).toContain('12.34');
    expect(sql.sql).not.toContain('12.34');
  });
  it('fails closed without explicit development configuration and refuses production mode', async () => {
    const service = new StorefrontService(
      {} as DatabaseService,
      {} as CategoryFiltersService,
      {} as LocalMediaStorage,
    );
    delete process.env.PUBLIC_CATALOG_MODE;
    await expect(service.context({} as DatabaseService)).rejects.toThrow(
      'not enabled',
    );
    process.env.PUBLIC_CATALOG_MODE = 'development';
    process.env.PUBLIC_CATALOG_STORE_ID =
      '11111111-1111-4111-8111-111111111111';
    process.env.NODE_ENV = 'production';
    await expect(service.context({} as DatabaseService)).rejects.toThrow(
      'not enabled',
    );
  });
  it('refuses a remote database even when the development switch is enabled', async () => {
    process.env.PUBLIC_CATALOG_MODE = 'development';
    process.env.PUBLIC_CATALOG_STORE_ID =
      '11111111-1111-4111-8111-111111111111';
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://example.invalid/catalog_dev';
    const service = new StorefrontService(
      {} as DatabaseService,
      {} as CategoryFiltersService,
      {} as LocalMediaStorage,
    );
    await expect(service.context({} as DatabaseService)).rejects.toThrow(
      'loopback development',
    );
  });
});
