import { createHash } from 'node:crypto';
import { UNITS, convertNumber, decimal } from '../product-types/registry.js';
import { fail } from '../product-types/validation.js';
import type { Rules } from '../product-types/validation.js';
import type { FilterInput } from './validation.js';
export const CONTROLS = {
  TEXT: ['checkbox_group', 'single_select', 'multi_select'],
  NUMBER: ['number_range'],
  BOOLEAN: ['boolean_toggle'],
  SINGLE_SELECT: ['checkbox_group', 'single_select', 'multi_select'],
  MULTI_SELECT: ['checkbox_group', 'multi_select'],
} as Record<string, string[]>;
export const operators = (control: string) =>
  control === 'number_range'
    ? ['gte', 'lte']
    : ['single_select', 'boolean_toggle'].includes(control)
      ? ['eq']
      : ['in'];
export type BindingSnapshot = {
  dataType: string;
  canonicalUnit: string | null;
  rules: Rules;
  visibility: { storefront: boolean };
  options: { id: string; code: string; label: string; swatch: string | null }[];
};
export type TypeDependency = {
  id: string;
  productTypeId: string;
  attributes: { attributeId: string; level: string; snapshot: unknown }[];
};
export type FilterSnapshot = {
  dataType: string;
  level: 'PRODUCT' | 'SKU';
  control: string;
  operators: string[];
  values: { code: string; label: string; swatch?: string | null }[];
  displayUnit: string | null;
  min?: string;
  max?: string;
  bindings: {
    versionId: string;
    productTypeId: string;
    canonicalUnit: string | null;
  }[];
  aliases: string[];
  ui: { collapsed: boolean };
};
export type CompiledFilter = {
  id?: string;
  keyId: string;
  code: string;
  label: string;
  description: string;
  group: string;
  sortOrder: number;
  visible: boolean;
  source: string;
  attributeId: string | null;
  snapshot: FilterSnapshot;
};
export function compileDefinition(
  input: FilterInput,
  dependencies: TypeDependency[],
  currency: string,
) {
  let dataType: string,
    dimension: string | null = null,
    level = input.level,
    values: FilterSnapshot['values'] = [],
    bindings: FilterSnapshot['bindings'] = [],
    min = input.min,
    max = input.max;
  const selected = input.typeVersionIds.length
    ? dependencies.filter((d) => input.typeVersionIds.includes(d.id))
    : dependencies;
  if (
    new Set(input.typeVersionIds).size !== input.typeVersionIds.length ||
    selected.length !== (input.typeVersionIds.length || dependencies.length)
  )
    fail('Filter Product Types must be selected dependencies.');
  if (input.source === 'ATTRIBUTE') {
    if (!input.attributeId || !selected.length)
      fail('Attribute filters require approved Product Type versions.');
    const fields = selected.map((d) => {
      const f = d.attributes.find(
        (f) => f.attributeId === input.attributeId && f.level === level,
      );
      if (!f)
        fail(
          'The attribute scope is not shared by every applicable Product Type.',
        );
      const snapshot = f.snapshot as BindingSnapshot;
      if (!snapshot.visibility.storefront)
        fail('Private schema attributes cannot become public filters.');
      return { dependency: d, snapshot };
    });
    const first = fields[0].snapshot;
    dataType = first.dataType;
    if (fields.some((f) => f.snapshot.dataType !== dataType))
      fail('Mixed Product Types have incompatible attribute meanings.');
    if (dataType === 'NUMBER') {
      const units = fields.map((f) =>
        UNITS.find((u) => u.code === f.snapshot.canonicalUnit),
      );
      dimension = units[0]?.dimension ?? null;
      const display = UNITS.find((u) => u.code === input.displayUnit);
      if (
        !dimension ||
        !display ||
        display.dimension !== dimension ||
        units.some((u) => u?.dimension !== dimension)
      )
        fail('Choose a compatible registered display unit.');
      const lowers = fields.map((f) =>
        f.snapshot.rules.min === undefined
          ? undefined
          : convertNumber(
              f.snapshot.rules.min,
              f.snapshot.canonicalUnit!,
              input.displayUnit!,
            ),
      );
      const uppers = fields.map((f) =>
        f.snapshot.rules.max === undefined
          ? undefined
          : convertNumber(
              f.snapshot.rules.max,
              f.snapshot.canonicalUnit!,
              input.displayUnit!,
            ),
      );
      const lower = lowers.every((v) => v !== undefined)
        ? lowers.reduce((a, b) => (decimal(a!).lt(decimal(b!)) ? a : b))
        : undefined;
      const upper = uppers.every((v) => v !== undefined)
        ? uppers.reduce((a, b) => (decimal(a!).gt(decimal(b!)) ? a : b))
        : undefined;
      if (
        (min !== undefined &&
          lower !== undefined &&
          decimal(min).lt(decimal(lower))) ||
        (max !== undefined &&
          upper !== undefined &&
          decimal(max).gt(decimal(upper)))
      )
        fail('Filter range exceeds the approved attribute domains.');
      min ??= lower;
      max ??= upper;
    } else if (input.displayUnit !== null)
      fail('Only numeric attributes have display units.');
    if (['SINGLE_SELECT', 'MULTI_SELECT'].includes(dataType)) {
      const options = fields.flatMap((f) => f.snapshot.options),
        map = new Map<string, (typeof options)[number]>();
      for (const option of options) {
        const old = map.get(option.code);
        if (
          old &&
          (old.id !== option.id ||
            old.label !== option.label ||
            old.swatch !== option.swatch)
        )
          fail('Pinned vocabularies disagree; review schema dependencies.');
        map.set(option.code, option);
      }
      values = [...map.values()].map(({ code, label, swatch }) => ({
        code,
        label,
        swatch,
      }));
    } else if (dataType === 'TEXT') {
      if (fields.some((f) => !f.snapshot.rules.allowedValues?.length))
        fail('Text facets need approved literal allowed values.');
      values = [
        ...new Set(fields.flatMap((f) => f.snapshot.rules.allowedValues!)),
      ].map((code) => ({ code, label: code }));
    } else if (dataType === 'BOOLEAN')
      values = [
        { code: 'true', label: 'Yes' },
        { code: 'false', label: 'No' },
      ];
    bindings = fields.map((f) => ({
      versionId: f.dependency.id,
      productTypeId: f.dependency.productTypeId,
      canonicalUnit: f.snapshot.canonicalUnit,
    }));
  } else {
    if (input.attributeId !== null || input.typeVersionIds.length)
      fail(
        'Built-in filters cannot carry attribute references or per-field type scopes.',
      );
    if (input.source === 'PRICE') {
      dataType = 'NUMBER';
      dimension = 'CURRENCY:' + currency;
      if (input.displayUnit !== currency || level !== 'SKU')
        fail(
          'Price uses the store currency and approved SKU selling prices only.',
        );
      min ??= '0';
    } else if (input.source === 'AVAILABILITY') {
      dataType = 'SINGLE_SELECT';
      values = [
        { code: 'in_stock', label: 'In stock' },
        { code: 'out_of_stock', label: 'Out of stock' },
        { code: 'unknown', label: 'Stock unverified' },
      ];
      if (level !== 'SKU' || input.displayUnit !== null)
        fail('Availability is a unitless SKU predicate.');
    } else {
      dataType = 'TEXT';
      if (
        level !== 'PRODUCT' ||
        input.displayUnit !== null ||
        !input.allowedValues.length
      )
        fail('Brand uses explicit controlled brand codes at product level.');
      values = input.allowedValues.map((code) => ({ code, label: code }));
    }
  }
  if (!CONTROLS[dataType]?.includes(input.control))
    fail('Control is incompatible with the source data type.');
  const expected = operators(input.control);
  if (
    new Set(input.operators).size !== input.operators.length ||
    JSON.stringify([...expected].sort()) !==
      JSON.stringify([...input.operators].sort())
  )
    fail('Operators are not supported by this control.');
  if (dataType === 'NUMBER') {
    if (input.allowedValues.length)
      fail('Numeric ranges cannot contain enum selections.');
    if (min !== undefined) decimal(min);
    if (max !== undefined) decimal(max);
    if (min !== undefined && max !== undefined && decimal(min).gt(decimal(max)))
      fail('Minimum exceeds maximum.');
    if (input.source === 'PRICE' && min !== undefined && decimal(min).lt(0))
      fail('Selling-price filters cannot be negative.');
    for (const binding of bindings) {
      if (min !== undefined)
        convertNumber(min, input.displayUnit!, binding.canonicalUnit!);
      if (max !== undefined)
        convertNumber(max, input.displayUnit!, binding.canonicalUnit!);
    }
  } else {
    if (min !== undefined || max !== undefined)
      fail('Only numeric filters accept ranges.');
    if (input.allowedValues.length) {
      if (
        input.allowedValues.some((code) => !values.some((v) => v.code === code))
      )
        fail('Allowed filter values must come from approved vocabulary.');
      values = values.filter((v) => input.allowedValues.includes(v.code));
    }
    if (
      !values.length ||
      new Set(input.allowedValues).size !== input.allowedValues.length
    )
      fail('Filter choices must be non-empty and unique.');
  }
  if (
    input.aliases.includes(input.code) ||
    new Set(input.aliases).size !== input.aliases.length
  )
    fail('Aliases must be unique alternatives to the canonical code.');
  const semanticHash = createHash('sha256')
    .update(
      JSON.stringify({
        source: input.source,
        attributeId: input.attributeId,
        dataType,
        level,
        dimension,
        displayUnit: input.displayUnit,
        operators: expected,
      }),
    )
    .digest('hex');
  const snapshot: FilterSnapshot = {
    dataType,
    level,
    control: input.control,
    operators: expected,
    values,
    displayUnit: input.displayUnit,
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    bindings,
    aliases: input.aliases,
    ui: input.ui,
  };
  return { semanticHash, snapshot };
}
export type Predicate = {
  source: string;
  attributeId: string | null;
  level: string;
  kind: 'range' | 'values';
  values?: string[];
  min?: string;
  max?: string;
  canonicalByVersion?: Record<
    string,
    { min?: string; max?: string; unit: string | null }
  >;
  versionIds: string[];
  currency?: string;
};
export function queryContract(
  filters: CompiledFilter[],
  query: Record<string, string[]>,
  aliases: Record<string, string>,
  categoryIds: string[],
  categoryPolicy: { mode: string; productTypeIds: string[] },
) {
  const selected = new Map<string, string[]>();
  for (const [incoming, values] of Object.entries(query)) {
    const code = aliases[incoming] ?? incoming,
      field = filters.find((f) => f.code === code && f.visible);
    if (!field || !values.length)
      fail('Unknown, hidden or removed filter query code.');
    if (selected.has(code))
      fail('Do not mix a canonical filter code with its alias.');
    selected.set(code, values);
  }
  const product: Predicate[] = [],
    sku: Predicate[] = [],
    canonical = new URLSearchParams();
  for (const [code, values] of [...selected].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const f = filters.find((f) => f.code === code)!,
      s = f.snapshot;
    let p: Predicate;
    if (s.control === 'number_range') {
      if (values.length !== 1) fail('Numeric ranges use one min..max value.');
      const parts = values[0].split('..');
      if (parts.length !== 2 || !parts.some(Boolean))
        fail('Use min..max, min.. or ..max.');
      const [min, max] = parts;
      if (min) decimal(min);
      if (max) decimal(max);
      if (
        (min && max && decimal(min).gt(decimal(max))) ||
        (min && s.min !== undefined && decimal(min).lt(decimal(s.min))) ||
        (max && s.max !== undefined && decimal(max).gt(decimal(s.max))) ||
        (min && s.max !== undefined && decimal(min).gt(decimal(s.max))) ||
        (max && s.min !== undefined && decimal(max).lt(decimal(s.min)))
      )
        fail('Query range falls outside configured bounds.');
      const normalizedMin = min ? decimal(min).toString() : undefined,
        normalizedMax = max ? decimal(max).toString() : undefined;
      const byVersion = Object.fromEntries(
        s.bindings.map((b) => [
          b.versionId,
          {
            ...(min
              ? { min: convertNumber(min, s.displayUnit!, b.canonicalUnit!) }
              : {}),
            ...(max
              ? { max: convertNumber(max, s.displayUnit!, b.canonicalUnit!) }
              : {}),
            unit: b.canonicalUnit,
          },
        ]),
      );
      p = {
        source: f.source,
        attributeId: f.attributeId,
        level: s.level,
        kind: 'range',
        ...(normalizedMin ? { min: normalizedMin } : {}),
        ...(normalizedMax ? { max: normalizedMax } : {}),
        canonicalByVersion: byVersion,
        versionIds: s.bindings.map((b) => b.versionId),
        ...(f.source === 'PRICE' ? { currency: s.displayUnit! } : {}),
      };
      canonical.append(code, `${normalizedMin ?? ''}..${normalizedMax ?? ''}`);
    } else {
      if (
        (['single_select', 'boolean_toggle'].includes(s.control) &&
          values.length !== 1) ||
        new Set(values).size !== values.length ||
        values.some((value) => !s.values.some((v) => v.code === value))
      )
        fail('Unsupported or repeated facet values.');
      p = {
        source: f.source,
        attributeId: f.attributeId,
        level: s.level,
        kind: 'values',
        values: [...values].sort(),
        versionIds: s.bindings.map((b) => b.versionId),
      };
      for (const value of p.values!) canonical.append(code, value);
    }
    (s.level === 'SKU' ? sku : product).push(p);
  }
  return {
    version: 1 as const,
    category: { ids: categoryIds, policy: categoryPolicy },
    productPredicates: { operator: 'AND' as const, items: product },
    skuPredicate: {
      quantifier: 'EXISTS_SAME_SKU' as const,
      eligibility: 'ACTIVE_VALID_SKU' as const,
      operator: 'AND' as const,
      items: sku,
    },
    facetValueOperator: 'OR' as const,
    missingValues: 'DO_NOT_MATCH' as const,
    priceSource: 'APPROVED_SELLING_PRICE_ONLY' as const,
    facetCounts: 'NOT_IMPLEMENTED' as const,
    canonicalQuery: canonical.toString(),
  };
}
export type SyntheticProduct = {
  id: string;
  categoryIds: string[];
  productTypeId: string;
  typeVersionId: string;
  brand: string;
  attributes: Record<string, unknown>;
  skus: {
    id: string;
    active: boolean;
    valid: boolean;
    attributes: Record<string, unknown>;
    stock?: number;
    stockVerified?: boolean;
    approvedPrice?: { amount: string; currency: string; approved: boolean };
    referencePrice?: string;
  }[];
};
export function evaluateFixture(
  plan: ReturnType<typeof queryContract>,
  products: SyntheticProduct[],
) {
  const matches = (
    p: SyntheticProduct,
    sku: SyntheticProduct['skus'][number] | undefined,
    predicate: Predicate,
  ) => {
    if (
      predicate.versionIds.length &&
      !predicate.versionIds.includes(p.typeVersionId)
    )
      return false;
    let value: unknown;
    if (predicate.source === 'BRAND') value = p.brand;
    else if (predicate.source === 'PRICE') {
      if (
        !sku?.approvedPrice?.approved ||
        sku.approvedPrice.currency !== predicate.currency
      )
        return false;
      value = sku.approvedPrice.amount;
    } else if (predicate.source === 'AVAILABILITY')
      value =
        sku?.stockVerified && sku.stock !== undefined
          ? sku.stock > 0
            ? 'in_stock'
            : 'out_of_stock'
          : 'unknown';
    else {
      const attrs = predicate.level === 'SKU' ? sku?.attributes : p.attributes;
      if (!attrs || !Object.hasOwn(attrs, predicate.attributeId!)) return false;
      value = attrs[predicate.attributeId!];
    }
    if (value === null || value === undefined) return false;
    if (predicate.kind === 'range') {
      if (typeof value !== 'string' && typeof value !== 'number') return false;
      const range =
        predicate.canonicalByVersion?.[p.typeVersionId] ?? predicate;
      const n = decimal(String(value));
      return !(
        (range.min !== undefined && n.lt(decimal(range.min))) ||
        (range.max !== undefined && n.gt(decimal(range.max)))
      );
    }
    const actual = Array.isArray(value) ? value : [value];
    return actual.some((v) => predicate.values!.includes(String(v)));
  };
  return products
    .filter(
      (p) =>
        p.categoryIds.some((id) => plan.category.ids.includes(id)) &&
        (plan.category.policy.mode === 'ANY' ||
          plan.category.policy.productTypeIds.includes(p.productTypeId)) &&
        plan.productPredicates.items.every((f) => matches(p, undefined, f)) &&
        p.skus.some(
          (s) =>
            s.active &&
            s.valid &&
            plan.skuPredicate.items.every((f) => matches(p, s, f)),
        ),
    )
    .map((p) => p.id);
}
