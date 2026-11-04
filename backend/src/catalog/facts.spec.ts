import { describe, expect, it } from 'vitest';
import { typedValue, validateValues, combination } from './facts.js';
import type { Binding } from './facts.js';
import { resolveVariants } from './resolver.js';
const binding = (
  attributeId: string,
  dataType: string,
  extra: Record<string, unknown> = {},
): Binding => ({
  attributeId,
  level: 'SKU',
  required: true,
  axis: false,
  sortOrder: 0,
  snapshot: {
    dataType,
    canonicalUnit: dataType === 'NUMBER' ? 'W' : null,
    label: attributeId,
    rules: {},
    options: [],
    ...extra,
  },
});
describe('typed catalog facts', () => {
  it('separates missing, false and zero without coercion', () => {
    const b = binding('flag', 'BOOLEAN'),
      n = binding('power', 'NUMBER');
    expect(
      typedValue(b, { attributeId: 'flag', boolean: false }).booleanValue,
    ).toBe(false);
    expect(
      typedValue(n, { attributeId: 'power', number: '0' }).numberValue,
    ).toBe('0');
    expect(() => validateValues([b], [], 'SKU', true)).toThrow();
    expect(() =>
      typedValue(b, { attributeId: 'flag', text: 'false' }),
    ).toThrow();
    expect(() =>
      typedValue(n, { attributeId: 'power', number: '0', boolean: false }),
    ).toThrow();
  });
  it('enforces canonical units, exact decimals, steps and allowed vocabulary', () => {
    const n = binding('power', 'NUMBER', {
      rules: { min: '0', max: '100', step: '5' },
    });
    expect(() =>
      typedValue(n, { attributeId: 'power', number: '5.000001' }),
    ).toThrow();
    expect(() =>
      typedValue(n, { attributeId: 'power', number: 'NaN' }),
    ).toThrow();
    expect(() =>
      typedValue(n, { attributeId: 'power', number: '1000' }),
    ).toThrow();
    expect(typedValue(n, { attributeId: 'power', number: '0' }).unit).toBe('W');
    const e = binding('color', 'SINGLE_SELECT', { options: [{ id: 'black' }] });
    expect(() =>
      typedValue(e, { attributeId: 'color', options: ['white'] }),
    ).toThrow();
    expect(() =>
      typedValue(e, { attributeId: 'color', options: ['black', 'black'] }),
    ).toThrow();
  });
  it('rejects product/SKU scope confusion, duplicate values and executable content', () => {
    const b = binding('note', 'TEXT');
    expect(() =>
      validateValues([b], [{ attributeId: 'note', text: 'text' }], 'PRODUCT'),
    ).toThrow();
    expect(() =>
      validateValues(
        [b],
        [
          { attributeId: 'note', text: 'a' },
          { attributeId: 'note', text: 'b' },
        ],
        'SKU',
      ),
    ).toThrow();
    expect(() =>
      typedValue(b, { attributeId: 'note', text: '<script>' }),
    ).toThrow();
  });
  it('canonicalizes combinations by stable IDs; empty axes has one default identity', () => {
    const a = {
        ...binding('a', 'SINGLE_SELECT', { options: [{ id: 'x' }] }),
        axis: true,
      },
      b = {
        ...binding('b', 'SINGLE_SELECT', { options: [{ id: 'y' }] }),
        axis: true,
      },
      values = [
        { attributeId: 'a', options: ['x'] },
        { attributeId: 'b', options: ['y'] },
      ];
    expect(combination([a, b], values)).toEqual(
      combination([b, a], [...values].reverse()),
    );
    expect(() => combination([a, b], [values[0]])).toThrow();
    expect(combination([], []).facts).toEqual([]);
  });
});
const axes = [
  {
    attributeId: 'color',
    options: [
      { id: 'black', label: 'Black', code: 'black' },
      { id: 'white', label: 'White', code: 'white' },
    ],
  },
  {
    attributeId: 'switch',
    options: [
      { id: 'storm', label: 'Storm', code: 'storm' },
      { id: 'ling', label: 'Ling', code: 'ling' },
    ],
  },
];
const skus = [
  {
    id: 'one',
    skuId: 'one',
    code: 'one',
    archived: false,
    selections: { color: 'black', switch: 'storm' },
    specifications: [],
  },
  {
    id: 'two',
    skuId: 'two',
    code: 'two',
    archived: false,
    selections: { color: 'white', switch: 'ling' },
    specifications: [],
  },
];
describe('explicit dependent resolver', () => {
  it('distinguishes recorded, missing and archived combinations', () => {
    expect(
      resolveVariants(axes, skus, [
        { attributeId: 'color', optionId: 'black' },
        { attributeId: 'switch', optionId: 'storm' },
      ]).status,
    ).toBe('RESOLVED');
    expect(
      resolveVariants(axes, skus, [
        { attributeId: 'color', optionId: 'black' },
        { attributeId: 'switch', optionId: 'ling' },
      ]).status,
    ).toBe('NONEXISTENT');
    expect(
      resolveVariants(
        axes,
        [{ ...skus[0], archived: true }],
        [
          { attributeId: 'color', optionId: 'black' },
          { attributeId: 'switch', optionId: 'storm' },
        ],
      ).status,
    ).toBe('ARCHIVED');
  });
  it('clears only incompatible downstream choices and derives valid next values', () => {
    const r = resolveVariants(
      axes,
      skus,
      [
        { attributeId: 'color', optionId: 'white' },
        { attributeId: 'switch', optionId: 'storm' },
      ],
      'color',
    );
    expect(r.selection).toEqual({ color: 'white' });
    expect(r.clearedAttributeIds).toEqual(['switch']);
    expect(r.nextOptions[0].options).toHaveLength(2);
    expect(r.nextOptions[1].options.map((o) => o.id)).toEqual(['ling']);
    const kept = resolveVariants(
      axes,
      skus,
      [
        { attributeId: 'color', optionId: 'black' },
        { attributeId: 'switch', optionId: 'storm' },
      ],
      'color',
    );
    expect(kept.clearedAttributeIds).toEqual([]);
    expect(kept.pricing).toBeNull();
    expect(kept.inventory).toBeNull();
  });
  it('rejects unknown, duplicate and nonselected changed axes', () => {
    expect(() =>
      resolveVariants(axes, skus, [{ attributeId: 'sensor', optionId: 'a' }]),
    ).toThrow();
    expect(() =>
      resolveVariants(axes, skus, [
        { attributeId: 'color', optionId: 'black' },
        { attributeId: 'color', optionId: 'white' },
      ]),
    ).toThrow();
    expect(() => resolveVariants(axes, skus, [], 'color')).toThrow();
  });
});
