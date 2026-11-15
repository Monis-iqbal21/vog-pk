import { describe, expect, it } from 'vitest';
import {
  compileDefinition,
  queryContract,
  evaluateFixture,
} from './compiler.js';
import type {
  CompiledFilter,
  SyntheticProduct,
  TypeDependency,
} from './compiler.js';
import { filterInput } from './validation.js';

const dependencies: TypeDependency[] = [
  {
    id: 'v1',
    productTypeId: 't1',
    attributes: [
      {
        attributeId: 'color',
        level: 'SKU',
        snapshot: {
          dataType: 'SINGLE_SELECT',
          canonicalUnit: null,
          rules: {},
          visibility: { storefront: true },
          options: [
            { id: 'b', code: 'black', label: 'Black', swatch: null },
            { id: 'w', code: 'white', label: 'White', swatch: null },
          ],
        },
      },
      {
        attributeId: 'sensor',
        level: 'SKU',
        snapshot: {
          dataType: 'SINGLE_SELECT',
          canonicalUnit: null,
          rules: {},
          visibility: { storefront: true },
          options: [
            { id: 'a', code: 'a', label: 'A', swatch: null },
            { id: 's', code: 'b', label: 'B', swatch: null },
          ],
        },
      },
      {
        attributeId: 'wireless',
        level: 'PRODUCT',
        snapshot: {
          dataType: 'BOOLEAN',
          canonicalUnit: null,
          rules: {},
          visibility: { storefront: true },
          options: [],
        },
      },
      {
        attributeId: 'frequency',
        level: 'SKU',
        snapshot: {
          dataType: 'NUMBER',
          canonicalUnit: 'Hz',
          rules: { min: '0', max: '8000' },
          visibility: { storefront: true },
          options: [],
        },
      },
    ],
  },
];
function facet(
  code: string,
  source = 'ATTRIBUTE',
  extra: Record<string, unknown> = {},
) {
  // UUID validation is covered by DTO/integration tests; pure compiler fixtures
  // use readable identities to make the same-SKU trap explicit.
  const input = {
    ...filterInput.parse({
      code,
      label: code,
      description: '',
      source: source === 'ATTRIBUTE' ? 'BRAND' : source,
      level: source === 'BRAND' ? 'PRODUCT' : 'SKU',
      control: source === 'PRICE' ? 'number_range' : 'checkbox_group',
      operators: source === 'PRICE' ? ['gte', 'lte'] : ['in'],
      displayUnit: source === 'PRICE' ? 'PKR' : null,
    }),
    source,
    attributeId: source === 'ATTRIBUTE' ? code : null,
    ...extra,
  };
  const compiled = compileDefinition(
    input as Parameters<typeof compileDefinition>[0],
    dependencies,
    'PKR',
  );
  return {
    ...input,
    keyId: code,
    snapshot: compiled.snapshot,
  } as CompiledFilter;
}
const filters = [
  facet('color'),
  facet('sensor'),
  facet('price', 'PRICE'),
  facet('availability', 'AVAILABILITY'),
  facet('wireless', 'ATTRIBUTE', {
    level: 'PRODUCT',
    control: 'boolean_toggle',
    operators: ['eq'],
  }),
  facet('frequency', 'ATTRIBUTE', {
    control: 'number_range',
    operators: ['gte', 'lte'],
    displayUnit: 'kHz',
  }),
];
const plan = (query: Record<string, string[]>) =>
  queryContract(filters, query, { finish: 'color' }, ['parent', 'child'], {
    mode: 'ANY',
    productTypeIds: [],
  });
const sku = (id: string, color: string, sensor: string, price?: string) => ({
  id,
  active: true,
  valid: true,
  attributes: { color, sensor, frequency: '0' },
  stock: 1,
  stockVerified: true,
  ...(price
    ? { approvedPrice: { amount: price, currency: 'PKR', approved: true } }
    : { referencePrice: '1' }),
});
const product = (
  id: string,
  skus: SyntheticProduct['skus'],
  attributes: Record<string, unknown> = {},
): SyntheticProduct => ({
  id,
  categoryIds: ['child'],
  productTypeId: 't1',
  typeVersionId: 'v1',
  brand: 'brand',
  attributes,
  skus,
});
describe('category filter query contract', () => {
  it('combines every SKU condition in one exists, never across two dependent combinations', () => {
    const q = plan({
      color: ['black'],
      sensor: ['b'],
      price: ['0..200'],
      availability: ['in_stock'],
    });
    const trap = product('trap', [
      sku('one', 'black', 'a', '100'),
      sku('two', 'white', 'b', '100'),
    ]);
    const match = product('match', [sku('three', 'black', 'b', '100')]);
    expect(q.skuPredicate.items).toHaveLength(4);
    expect(q.skuPredicate.quantifier).toBe('EXISTS_SAME_SKU');
    expect(evaluateFixture(q, [trap, match])).toEqual(['match']);
  });
  it('never substitutes reference price, inactive, invalid or unavailable SKU', () => {
    const q = plan({ price: ['0..200'], availability: ['in_stock'] });
    const records = [
      product('reference', [sku('ref', 'black', 'b')]),
      product('inactive', [
        { ...sku('s', 'black', 'b', '100'), active: false },
      ]),
      product('invalid', [{ ...sku('s', 'black', 'b', '100'), valid: false }]),
      product('empty', [{ ...sku('s', 'black', 'b', '100'), stock: 0 }]),
      product('unknown', [
        { ...sku('s', 'black', 'b', '100'), stockVerified: false },
      ]),
    ];
    expect(evaluateFixture(q, records)).toEqual([]);
  });
  it('preserves false, numeric zero, missing and unknown stock distinctions', () => {
    const q = plan({ wireless: ['false'], frequency: ['0..0'] });
    expect(
      evaluateFixture(q, [
        product('false', [sku('s', 'black', 'b')], { wireless: false }),
        product('true', [sku('s', 'black', 'b')], { wireless: true }),
        product('missing', [sku('s', 'black', 'b')]),
      ]),
    ).toEqual(['false']);
    expect(
      evaluateFixture(plan({ availability: ['out_of_stock'] }), [
        product('zero', [{ ...sku('s', 'black', 'b'), stock: 0 }]),
        product('unknown', [{ ...sku('s', 'black', 'b'), stock: undefined }]),
      ]),
    ).toEqual(['zero']);
  });
  it('ORs ordinary facet selections, ANDs different facets and respects descendants/type policy', () => {
    const a = product('a', [sku('s', 'white', 'b')]),
      b = product('outside', [sku('s', 'black', 'b')]);
    b.categoryIds = ['outside'];
    expect(
      evaluateFixture(plan({ color: ['white', 'black'], sensor: ['b'] }), [
        a,
        b,
      ]),
    ).toEqual(['a']);
    const restricted = plan({ color: ['white'] });
    restricted.category.policy = {
      mode: 'ALLOW_LIST',
      productTypeIds: ['other'],
    };
    expect(evaluateFixture(restricted, [a])).toEqual([]);
    a.typeVersionId = 'other';
    expect(evaluateFixture(plan({ color: ['white'] }), [a])).toEqual([]);
  });
  it('canonicalizes aliases, sorted OR values and exact numeric units', () => {
    expect(
      plan({ finish: ['white', 'black'], frequency: ['1.000..2.000'] })
        .canonicalQuery,
    ).toBe('color=black&color=white&frequency=1..2');
    const p = plan({ frequency: ['1..2'] }).skuPredicate.items[0];
    expect(p.canonicalByVersion?.v1).toEqual({
      min: '1000',
      max: '2000',
      unit: 'Hz',
    });
    for (const query of [
      { finish: ['black'], color: ['black'] },
      { color: ['invalid'] },
      { frequency: ['0..9'] },
      { frequency: ['NaN..1'] },
      { wireless: ['false', 'true'] },
      { price: ['-1..2'] },
      { sql: ['x'] },
    ])
      expect(() => plan(query)).toThrow();
  });
  it('rejects incompatible attribute scope, private visibility, operator/unit injection and semantic reuse', () => {
    expect(() => facet('color', 'ATTRIBUTE', { level: 'PRODUCT' })).toThrow();
    expect(() =>
      facet('frequency', 'ATTRIBUTE', {
        control: 'number_range',
        operators: ['gte', 'lte'],
        displayUnit: 'kg',
      }),
    ).toThrow();
    expect(() => facet('price', 'PRICE', { operators: ['sql'] })).toThrow();
    const privateDeps = structuredClone(dependencies);
    (
      privateDeps[0].attributes[0].snapshot as {
        visibility: { storefront: boolean };
      }
    ).visibility.storefront = false;
    const original = filters[0];
    const input = {
      ...filterInput.parse({
        code: 'color',
        label: 'Color',
        description: '',
        source: 'BRAND',
        level: 'PRODUCT',
        control: 'checkbox_group',
        operators: ['in'],
        allowedValues: ['black'],
      }),
      source: 'ATTRIBUTE',
      attributeId: 'color',
      level: 'SKU',
    } as Parameters<typeof compileDefinition>[0];
    expect(() => compileDefinition(input, privateDeps, 'PKR')).toThrow();
    expect(original.snapshot.dataType).toBe('SINGLE_SELECT');
    const a = compileDefinition({ ...input }, dependencies, 'PKR'),
      b = compileDefinition(
        { ...input, control: 'single_select', operators: ['eq'] },
        dependencies,
        'PKR',
      );
    expect(a.semanticHash).not.toBe(b.semanticHash);
  });
});
