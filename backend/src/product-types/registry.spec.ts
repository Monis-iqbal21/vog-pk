import { bindingRules, validateRules } from './validation.js';
import { convertNumber } from './registry.js';

describe('exact schema units and validation', () => {
  it('converts exact decimal values without losing 24-digit precision', () => {
    expect(convertNumber('123456789012345678.123456', 'one', 'one')).toBe(
      '123456789012345678.123456',
    );
    expect(convertNumber('1', 'GiB', 'B')).toBe('1073741824');
    expect(convertNumber('1', 'GB', 'B')).toBe('1000000000');
    expect(convertNumber('0.125', 'GHz', 'MHz')).toBe('125');
  });
  it('rejects incompatible dimensions, executable units and lossy conversion', () => {
    for (const [value, from, to] of [
      ['1', 'kg', 'Hz'],
      ['1', 'MT/s', 'Mbit/s'],
      ['1', 'eval()', 'm'],
      ['0.000001', 'mm', 'm'],
    ])
      expect(() => convertNumber(value, from, to)).toThrow();
  });
  it('rejects widened bounds, incompatible increments and out-of-range allowed numbers', () => {
    expect(() =>
      bindingRules('NUMBER', { min: '0', max: '10', step: '2' }, { min: '-2' }),
    ).toThrow();
    expect(() =>
      bindingRules('NUMBER', { step: '2' }, { step: '3' }),
    ).toThrow();
    expect(() =>
      validateRules('NUMBER', { min: '0', max: '10', allowedValues: ['11'] }),
    ).toThrow();
    expect(() => validateRules('TEXT', { pattern: '(a+)+' })).toThrow();
    expect(
      bindingRules(
        'NUMBER',
        { min: '0', max: '10', step: '2' },
        { min: '2', max: '8', step: '4' },
      ),
    ).toEqual({ min: '2', max: '8', step: '4' });
  });
});
