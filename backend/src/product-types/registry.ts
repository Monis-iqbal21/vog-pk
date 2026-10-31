import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
const ExactDecimal = Prisma.Decimal.clone({ precision: 80 });

// Factors are exact decimal strings. No user-supplied expressions or functions.
export const UNITS = [
  ['one', 'DIMENSIONLESS', '1'],
  ['mm', 'LENGTH', '0.001'],
  ['cm', 'LENGTH', '0.01'],
  ['m', 'LENGTH', '1'],
  ['km', 'LENGTH', '1000'],
  ['g', 'MASS', '0.001'],
  ['kg', 'MASS', '1'],
  ['Hz', 'FREQUENCY', '1'],
  ['kHz', 'FREQUENCY', '1000'],
  ['MHz', 'FREQUENCY', '1000000'],
  ['GHz', 'FREQUENCY', '1000000000'],
  ['bit/s', 'DATA_RATE', '1'],
  ['Mbit/s', 'DATA_RATE', '1000000'],
  ['Gbit/s', 'DATA_RATE', '1000000000'],
  ['MT/s', 'TRANSFER_RATE', '1000000'],
  ['B', 'STORAGE', '1'],
  ['MB', 'STORAGE', '1000000'],
  ['GB', 'STORAGE', '1000000000'],
  ['TB', 'STORAGE', '1000000000000'],
  ['MiB', 'STORAGE', '1048576'],
  ['GiB', 'STORAGE', '1073741824'],
  ['TiB', 'STORAGE', '1099511627776'],
  ['W', 'POWER', '1'],
  ['kW', 'POWER', '1000'],
  ['s', 'TIME', '1'],
  ['ms', 'TIME', '0.001'],
  ['us', 'TIME', '0.000001'],
].map(([code, dimension, factor]) => ({ code, dimension, factor }));
export const WIDGETS: Record<string, readonly string[]> = {
  TEXT: ['text', 'textarea'],
  NUMBER: ['number'],
  BOOLEAN: ['checkbox'],
  SINGLE_SELECT: ['select', 'radio', 'swatch'],
  MULTI_SELECT: ['multiselect', 'checkboxes'],
};
export function decimal(value: string) {
  if (!/^-?\d{1,18}(?:\.\d{1,6})?$/.test(value))
    throw new BadRequestException(
      'Use an exact decimal string with at most 18 integer and 6 fractional digits.',
    );
  return new ExactDecimal(value);
}
export function convertNumber(value: string, from: string, to: string) {
  const source = UNITS.find((u) => u.code === from),
    target = UNITS.find((u) => u.code === to);
  if (!source || !target || source.dimension !== target.dimension)
    throw new BadRequestException('Incompatible measurement units.');
  const result = decimal(value).mul(source.factor).div(target.factor);
  const exact = decimal(result.toFixed(6));
  if (!result.eq(exact))
    throw new BadRequestException('Conversion would lose precision.');
  return result.toString();
}
