import { describe, it, expect } from 'vitest';
import {
  amount,
  currencyPrecision,
  validatePrice,
  currentOffer,
} from './money.js';
import { price } from './validation.js';
const data = (extra = {}) =>
  price.parse({
    currency: 'PKR',
    regularAmount: '100.00',
    promotions: [],
    ...extra,
  });
describe('approved store offer semantics', () => {
  it('uses ISO precision and exact decimals without floats', () => {
    expect(currencyPrecision('PKR')).toBe(2);
    expect(currencyPrecision('JPY')).toBe(0);
    expect(currencyPrecision('KWD')).toBe(3);
    expect(amount('999999999999999999.99', 'PKR')).toBe(
      '999999999999999999.99',
    );
    expect(amount('1.125', 'KWD')).toBe('1.125');
    for (const [v, c] of [
      ['1.001', 'PKR'],
      ['1.1', 'JPY'],
      ['-1', 'PKR'],
      ['1e3', 'PKR'],
      ['NaN', 'PKR'],
      ['1', 'BAD'],
    ])
      expect(() => amount(v, c)).toThrow();
  });
  it('normalizes explicit offsets and rejects naive/submillisecond scheduling', () => {
    const p = validatePrice(
      data({
        promotions: [
          {
            label: 'Offset sale',
            amount: '80',
            startsAt: '2030-01-01T05:00:00+05:00',
            endsAt: '2030-01-01T06:00:00+05:00',
          },
        ],
      }),
    );
    expect(p.promotions[0].startsAt.toISOString()).toBe(
      '2030-01-01T00:00:00.000Z',
    );
    expect(() => data({ validFrom: '2030-01-01T00:00:00' })).toThrow();
    expect(() => data({ validFrom: '2030-01-01T00:00:00.0001Z' })).toThrow();
  });
  it('rejects invalid discounts/overlap while allowing adjacent half-open windows', () => {
    const one = {
        label: 'One',
        amount: '80',
        startsAt: '2030-01-01T00:00:00Z',
        endsAt: '2030-01-01T01:00:00Z',
      },
      two = {
        ...one,
        label: 'Two',
        startsAt: '2030-01-01T01:00:00Z',
        endsAt: '2030-01-01T02:00:00Z',
      };
    expect(
      validatePrice(data({ promotions: [two, one] })).promotions,
    ).toHaveLength(2);
    expect(() =>
      validatePrice(
        data({
          promotions: [one, { ...two, startsAt: '2030-01-01T00:59:59Z' }],
        }),
      ),
    ).toThrow();
    expect(() =>
      validatePrice(data({ promotions: [{ ...one, amount: '100' }] })),
    ).toThrow();
    expect(() =>
      validatePrice(
        data({ validUntil: '2029-01-01T00:00:00Z', promotions: [one] }),
      ),
    ).toThrow();
  });
  it('uses only approved published currently valid offers at exact boundaries', () => {
    const p = validatePrice(
        data({
          validFrom: '2030-01-01T00:00:00Z',
          validUntil: '2030-02-01T00:00:00Z',
          promotions: [
            {
              label: 'Sale',
              amount: '80',
              startsAt: '2030-01-02T00:00:00Z',
              endsAt: '2030-01-03T00:00:00Z',
            },
          ],
        }),
      ),
      r = {
        ...p,
        id: 'revision',
        status: 'PUBLISHED',
        approvedAt: new Date('2029-01-01Z'),
        publishedAt: new Date('2029-01-01Z'),
      };
    expect(currentOffer(r, new Date('2029-12-31T23:59:59.999Z'))).toBeNull();
    expect(
      currentOffer(r, new Date('2030-01-02T00:00:00Z'))?.sellingAmount,
    ).toBe('80');
    expect(
      currentOffer(r, new Date('2030-01-03T00:00:00Z'))?.sellingAmount,
    ).toBe('100');
    expect(currentOffer(r, new Date('2030-02-01T00:00:00Z'))).toBeNull();
    expect(
      currentOffer({ ...r, status: 'APPROVED' }, new Date('2030-01-02Z')),
    ).toBeNull();
    expect(
      currentOffer({ ...r, approvedAt: null }, new Date('2030-01-02Z')),
    ).toBeNull();
    expect(currentOffer(null)).toBeNull();
  });
});
