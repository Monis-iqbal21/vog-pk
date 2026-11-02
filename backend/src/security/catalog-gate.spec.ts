import { describe, it, expect } from 'vitest';
import { assertCatalogMutationEnabled } from './catalog-gate.js';
describe('production staging catalog write gate', () => {
  it('defaults all catalog mutations closed while auth/RBAC and reads remain available', () => {
    for (const p of [
      'products.publish',
      'media.approve',
      'media.upload',
      'inventory.adjust',
      'product-types.activate',
      'categories.create',
      'listing-media.manage',
      'pricing.publish',
    ])
      expect(() =>
        assertCatalogMutationEnabled([p], { NODE_ENV: 'production' }),
      ).toThrow();
    for (const p of [
      'products.view',
      'media.view',
      'roles.manage',
      'staff.manage',
      'dashboard.view',
    ])
      expect(() =>
        assertCatalogMutationEnabled([p], { NODE_ENV: 'production' }),
      ).not.toThrow();
  });
  it('requires an exact server switch and preserves isolated development behavior', () => {
    for (const value of ['', 'true', '0'])
      expect(() =>
        assertCatalogMutationEnabled(['products.create'], {
          NODE_ENV: 'production',
          CATALOG_ADMIN_WRITES_ENABLED: value,
        }),
      ).toThrow();
    expect(() =>
      assertCatalogMutationEnabled(['products.create'], {
        NODE_ENV: 'production',
        CATALOG_ADMIN_WRITES_ENABLED: '1',
      }),
    ).not.toThrow();
    expect(() =>
      assertCatalogMutationEnabled(['media.approve'], { NODE_ENV: 'test' }),
    ).not.toThrow();
  });
});
