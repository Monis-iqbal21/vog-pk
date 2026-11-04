import { fail } from '../product-types/validation.js';
export type ResolverSku = {
  id: string;
  skuId: string;
  code: string;
  archived: boolean;
  selections: Record<string, string>;
  specifications: unknown;
};
export function resolveVariants(
  axes: {
    attributeId: string;
    options: { id: string; label: string; code: string }[];
  }[],
  skus: ResolverSku[],
  selection: { attributeId: string; optionId: string }[],
  changedAttributeId?: string,
) {
  if (
    new Set(selection.map((s) => s.attributeId)).size !== selection.length ||
    selection.some(
      (s) =>
        !axes.some(
          (a) =>
            a.attributeId === s.attributeId &&
            a.options.some((o) => o.id === s.optionId),
        ),
    )
  )
    fail('Unknown or repeated variant axis/option.');
  if (
    changedAttributeId &&
    !selection.some((s) => s.attributeId === changedAttributeId)
  )
    fail('Changed axis must be selected.');
  const requested = Object.fromEntries(
    selection.map((s) => [s.attributeId, s.optionId]),
  );
  const matches = (s: ResolverSku, selected: Record<string, string>) =>
    Object.entries(selected).every(([a, o]) => s.selections[a] === o);
  const exact = skus.filter((s) => matches(s, requested)),
    complete = selection.length === axes.length;
  const active = skus.filter((s) => !s.archived);
  const kept: Record<string, string> = {},
    cleared: string[] = [];
  // Preserve upstream selections. A changed choice only clears incompatible
  // selections after that axis, never a compatible dependent choice.
  const changedIndex = changedAttributeId
    ? axes.findIndex((a) => a.attributeId === changedAttributeId)
    : -1;
  for (const [i, a] of axes.entries())
    if (requested[a.attributeId]) {
      const candidate = { ...kept, [a.attributeId]: requested[a.attributeId] };
      if (
        changedIndex < 0 ||
        i <= changedIndex ||
        active.some((s) => matches(s, candidate))
      )
        kept[a.attributeId] = requested[a.attributeId];
      else cleared.push(a.attributeId);
    }
  const candidates = active.filter((s) => matches(s, kept));
  return {
    status:
      complete && !exact.length
        ? 'NONEXISTENT'
        : complete && exact.every((s) => s.archived)
          ? 'ARCHIVED'
          : complete && exact.some((s) => !s.archived)
            ? 'RESOLVED'
            : candidates.length
              ? 'PARTIAL'
              : 'NONEXISTENT',
    selection: kept,
    clearedAttributeIds: cleared,
    matchingSku: (complete && exact.find((s) => !s.archived)) || null,
    nextOptions: axes.map((a) => ({
      attributeId: a.attributeId,
      options: a.options.filter((o) =>
        active.some(
          (s) =>
            s.selections[a.attributeId] === o.id &&
            axes
              .slice(
                0,
                axes.findIndex((axis) => axis.attributeId === a.attributeId),
              )
              .every(
                (upstream) =>
                  !kept[upstream.attributeId] ||
                  s.selections[upstream.attributeId] ===
                    kept[upstream.attributeId],
              ),
        ),
      ),
    })),
    purchaseEligibility: 'NOT_IMPLEMENTED',
    pricing: null,
    inventory: null,
  };
}
