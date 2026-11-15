import { createHash } from 'node:crypto';
import { decimal } from '../product-types/registry.js';
import { fail } from '../product-types/validation.js';
import type { Rules } from '../product-types/validation.js';
import type { ValueInput } from './validation.js';
export type Snapshot = {
  dataType: string;
  canonicalUnit: string | null;
  code: string;
  label: string;
  rules: Rules;
  visibility: { admin: boolean; storefront: boolean };
  options: {
    id: string;
    code: string;
    label: string;
    swatch?: string | null;
  }[];
};
export type Binding = {
  attributeId: string;
  level: string;
  required: boolean;
  axis: boolean;
  sortOrder: number;
  snapshot: unknown;
};
export function typedValue(binding: Binding, input: ValueInput) {
  const s = binding.snapshot as Snapshot,
    r = s.rules;
  const keys = ['text', 'number', 'boolean', 'options'].filter((k) =>
    Object.hasOwn(input, k),
  );
  const expected = {
    TEXT: 'text',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    SINGLE_SELECT: 'options',
    MULTI_SELECT: 'options',
  }[s.dataType];
  if (keys.length !== 1 || keys[0] !== expected)
    fail(`${s.label}: use its declared value type; omit missing values.`);
  let textValue: string | null = null,
    numberValue: string | null = null,
    booleanValue: boolean | null = null,
    options: string[] = [],
    unit: string | null = null;
  if (s.dataType === 'TEXT') {
    const v = input.text!;
    if (
      v
        .split('')
        .some(
          (c) =>
            c === '<' ||
            c === '>' ||
            (c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c)),
        ) ||
      v.length < (r.minLength ?? 0) ||
      v.length > (r.maxLength ?? 10000) ||
      (r.allowedValues && !r.allowedValues.includes(v))
    )
      fail(`${s.label}: invalid text or allowed value.`);
    textValue = v;
  } else if (s.dataType === 'NUMBER') {
    const n = decimal(input.number!);
    if (
      (r.min !== undefined && n.lt(decimal(r.min))) ||
      (r.max !== undefined && n.gt(decimal(r.max))) ||
      (r.step !== undefined &&
        !n
          .minus(r.min ?? '0')
          .mod(decimal(r.step))
          .eq(0)) ||
      (r.allowedValues && !r.allowedValues.some((v) => n.eq(decimal(v))))
    )
      fail(`${s.label}: invalid canonical numeric value.`);
    numberValue = n.toString();
    unit = s.canonicalUnit;
  } else if (s.dataType === 'BOOLEAN') booleanValue = input.boolean!;
  else {
    options = input.options!;
    if (
      new Set(options).size !== options.length ||
      options.some((id) => !s.options.some((o) => o.id === id)) ||
      (s.dataType === 'SINGLE_SELECT' && options.length !== 1) ||
      (s.dataType === 'MULTI_SELECT' &&
        (options.length < (r.minItems ?? 0) ||
          options.length > (r.maxItems ?? 50)))
    )
      fail(`${s.label}: invalid option selection.`);
  }
  return {
    dataType: s.dataType as
      'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT',
    textValue,
    numberValue,
    booleanValue,
    unit,
    options,
  };
}
export function validateValues(
  bindings: Binding[],
  values: ValueInput[],
  level: string,
  required = false,
) {
  if (new Set(values.map((v) => v.attributeId)).size !== values.length)
    fail('Duplicate attribute values.');
  for (const value of values) {
    const binding = bindings.find(
      (b) => b.attributeId === value.attributeId && b.level === level,
    );
    if (!binding) fail('Attribute scope or schema ownership mismatch.');
    typedValue(binding, value);
  }
  if (required)
    for (const binding of bindings.filter(
      (b) => b.level === level && (b.required || b.axis),
    )) {
      const v = values.find((v) => v.attributeId === binding.attributeId);
      if (
        !v ||
        (Object.hasOwn(v, 'text') && !v.text) ||
        (Object.hasOwn(v, 'options') && !v.options?.length)
      )
        fail(`${(binding.snapshot as Snapshot).label}: a value is required.`);
    }
}
export function combination(bindings: Binding[], values: ValueInput[]) {
  const axes = bindings
    .filter((b) => b.axis)
    .sort((a, b) => a.attributeId.localeCompare(b.attributeId));
  const facts = axes.map((b) => {
    const v = values.find((v) => v.attributeId === b.attributeId);
    if (!v || v.options?.length !== 1)
      fail('Every explicit SKU must select each variant axis.');
    typedValue(b, v);
    return [b.attributeId, v.options[0]];
  });
  return {
    key: createHash('sha256').update(JSON.stringify(facts)).digest('hex'),
    facts,
  };
}
export type StoredValue = {
  textValue: string | null;
  numberValue: { toString(): string } | string | null;
  booleanValue: boolean | null;
  choices: { optionId: string }[];
  binding: { attributeId: string };
};
export function inputValues(values: StoredValue[]): ValueInput[] {
  return values.map((v) => ({
    attributeId: v.binding.attributeId,
    ...(v.textValue !== null
      ? { text: v.textValue }
      : v.numberValue !== null
        ? { number: v.numberValue.toString() }
        : v.booleanValue !== null
          ? { boolean: v.booleanValue }
          : { options: v.choices.map((c) => c.optionId) }),
  }));
}
