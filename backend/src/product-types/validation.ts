import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { decimal, UNITS, WIDGETS } from './registry.js';

export const code = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
function plainText(value: string, lines = false) {
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (
      c === '<' ||
      c === '>' ||
      (value.charCodeAt(i) < 32 && (!lines || !['\n', '\r', '\t'].includes(c)))
    )
      return false;
  }
  return true;
}
export const label = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((v) => plainText(v), 'Plain text only.');
export const description = z
  .string()
  .max(500)
  .refine((v) => plainText(v, true))
  .default('');
const revision = z.number().int().min(1).max(2147483646);
export const status = z.enum(['ACTIVE', 'ARCHIVED']);
const levels = z
  .array(z.enum(['PRODUCT', 'SKU']))
  .min(1)
  .max(2)
  .refine((v) => new Set(v).size === v.length);
export const visibility = z
  .object({ admin: z.boolean(), storefront: z.boolean() })
  .strict();
export const attributeInput = z
  .object({
    code,
    label,
    description,
    dataType: z.enum([
      'TEXT',
      'NUMBER',
      'BOOLEAN',
      'SINGLE_SELECT',
      'MULTI_SELECT',
    ]),
    canonicalUnit: z.string().max(24).nullable().default(null),
    optionSetId: z.uuid().nullable().default(null),
    rules: z.record(z.string(), z.unknown()).default({}),
    widget: z.string().max(24),
    allowedScopes: levels,
    axisEligible: z.boolean().default(false),
    visibility: visibility.default({ admin: true, storefront: true }),
  })
  .strict();
export const attributeUpdate = attributeInput
  .omit({ code: true, dataType: true })
  .extend({ revision, status });
export const optionValueInput = z
  .object({
    id: z.uuid().optional(),
    code,
    label,
    sortOrder: z.number().int().min(0).max(10000).default(0),
    swatch: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
    status: status.default('ACTIVE'),
  })
  .strict();
export const optionInput = z
  .object({
    code,
    label,
    description,
    values: z.array(optionValueInput).min(1).max(50),
  })
  .strict();
export const optionUpdate = optionInput
  .omit({ code: true })
  .extend({ revision, status });
export const typeInput = z.object({ code, label, description }).strict();
export const groupInput = z
  .object({ code, label, sortOrder: z.number().int().min(0).max(10000) })
  .strict();
export const fieldInput = z
  .object({
    attributeId: z.uuid(),
    groupCode: code,
    level: z.enum(['PRODUCT', 'SKU']),
    required: z.boolean(),
    variantAxis: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000),
    widget: z.string().max(24),
    rules: z.record(z.string(), z.unknown()).default({}),
    visibility,
  })
  .strict();
export const draftInput = z
  .object({
    revision,
    label,
    description,
    groups: z.array(groupInput).min(1).max(12),
    fields: z.array(fieldInput).max(40),
  })
  .strict();
export const transitionInput = z
  .object({ revision, typeRevision: revision.optional() })
  .strict();
export const listInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(25).default(20),
    search: z.string().trim().max(80).default(''),
    sort: z.enum(['code', 'label', 'createdAt']).default('code'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    status: status.optional(),
  })
  .strict();
export const paginationInput = listInput.pick({ page: true, pageSize: true });

const textRules = z
  .object({
    minLength: z.number().int().min(0).max(10000).optional(),
    maxLength: z.number().int().min(1).max(10000).optional(),
    allowedValues: z.array(label).min(1).max(50).optional(),
  })
  .strict();
const numberRules = z
  .object({
    min: z.string().optional(),
    max: z.string().optional(),
    step: z.string().optional(),
    allowedValues: z.array(z.string()).min(1).max(50).optional(),
  })
  .strict();
const multiRules = z
  .object({
    minItems: z.number().int().min(0).max(50).optional(),
    maxItems: z.number().int().min(1).max(50).optional(),
  })
  .strict();
export type Rules = {
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  min?: string;
  max?: string;
  step?: string;
  minItems?: number;
  maxItems?: number;
};
export function fail(message: string): never {
  throw new BadRequestException(message);
}
export function validateRules(type: string, input: unknown): Rules {
  const schema =
    type === 'TEXT'
      ? textRules
      : type === 'NUMBER'
        ? numberRules
        : type === 'MULTI_SELECT'
          ? multiRules
          : z.object({}).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail('Unsupported validation rules.');
  const r: Rules = parsed.data;
  if (type === 'TEXT' && (r.minLength ?? 0) > (r.maxLength ?? 10000))
    fail('Minimum length exceeds maximum.');
  if (type === 'MULTI_SELECT' && (r.minItems ?? 0) > (r.maxItems ?? 50))
    fail('Minimum selections exceed maximum.');
  if (type === 'NUMBER') {
    if (r.min !== undefined) decimal(r.min);
    if (r.max !== undefined) decimal(r.max);
    if (
      r.min !== undefined &&
      r.max !== undefined &&
      decimal(r.min).gt(decimal(r.max))
    )
      fail('Minimum exceeds maximum.');
    if (r.step !== undefined && decimal(r.step).lte(0))
      fail('Increment must be positive.');
    r.allowedValues?.forEach((v) => decimal(v));
  }
  if (
    r.allowedValues &&
    new Set(
      r.allowedValues.map((v) =>
        type === 'NUMBER' ? decimal(v).toString() : v,
      ),
    ).size !== r.allowedValues.length
  )
    fail('Duplicate allowed values.');
  for (const value of r.allowedValues ?? []) validateValue(type, r, value);
  return r;
}
export function validateValue(type: string, r: Rules, value: string) {
  if (
    type === 'TEXT' &&
    (value.length < (r.minLength ?? 0) || value.length > (r.maxLength ?? 10000))
  )
    fail('Allowed text value falls outside the configured length.');
  if (type === 'NUMBER') {
    const v = decimal(value);
    if (
      (r.min !== undefined && v.lt(decimal(r.min))) ||
      (r.max !== undefined && v.gt(decimal(r.max)))
    )
      fail('Allowed number falls outside the configured range.');
    if (
      r.step !== undefined &&
      !v
        .minus(r.min ?? '0')
        .mod(decimal(r.step))
        .eq(0)
    )
      fail('Allowed number does not match the increment.');
  }
}
// Binding constraints may narrow a reusable definition; they cannot widen it.
export function bindingRules(type: string, base: Rules, input: unknown) {
  const own = validateRules(type, input),
    r = validateRules(type, { ...base, ...own });
  for (const [min, max] of [
    ['minLength', 'maxLength'],
    ['minItems', 'maxItems'],
  ] as const) {
    if (
      (base[min] !== undefined && r[min]! < base[min]!) ||
      (base[max] !== undefined && r[max]! > base[max]!)
    )
      fail('A binding cannot weaken definition validation.');
  }
  if (
    (base.min !== undefined && decimal(r.min!).lt(decimal(base.min))) ||
    (base.max !== undefined && decimal(r.max!).gt(decimal(base.max)))
  )
    fail('A binding cannot widen the numeric range.');
  if (
    base.step !== undefined &&
    (!decimal(r.step!).mod(decimal(base.step)).eq(0) ||
      !decimal(r.min ?? '0')
        .minus(base.min ?? '0')
        .mod(decimal(base.step))
        .eq(0))
  )
    fail('Binding increments must preserve the definition grid.');
  if (
    base.allowedValues &&
    r.allowedValues?.some(
      (v) =>
        !base.allowedValues!.some((b) =>
          type === 'NUMBER' ? decimal(b).eq(decimal(v)) : b === v,
        ),
    )
  )
    fail('Binding allowed values must be a subset.');
  return r;
}
export function validateDefinition(input: z.infer<typeof attributeInput>) {
  if (!WIDGETS[input.dataType]?.includes(input.widget))
    fail('Widget is not supported for this data type.');
  const select = ['SINGLE_SELECT', 'MULTI_SELECT'].includes(input.dataType);
  if (select !== Boolean(input.optionSetId))
    fail(
      'Select attributes require an option set; other types cannot use one.',
    );
  if (
    input.dataType === 'NUMBER'
      ? !UNITS.some((u) => u.code === input.canonicalUnit)
      : input.canonicalUnit !== null
  )
    fail('Choose a registered unit for numbers only.');
  if (
    input.axisEligible &&
    (input.dataType !== 'SINGLE_SELECT' || !input.allowedScopes.includes('SKU'))
  )
    fail('Variant axes require controlled single-select SKU attributes.');
  return validateRules(input.dataType, input.rules);
}
