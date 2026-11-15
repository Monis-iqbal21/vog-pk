import { decimal } from '../product-types/registry.js';
import { fail } from '../product-types/validation.js';
import type { PriceInput } from './validation.js';
import { ISO_MINOR_UNITS } from './iso-currencies.js';
export function currencyPrecision(currency: string) {
  if (!Object.hasOwn(ISO_MINOR_UNITS, currency))
    fail('Choose a supported ISO currency code.');
  return ISO_MINOR_UNITS[currency];
}
export function amount(value: string, currency: string) {
  const n = decimal(value);
  if (n.lt(0) || n.decimalPlaces() > currencyPrecision(currency))
    fail('Money must be nonnegative and use the currency precision.');
  return n.toString();
}
export function validatePrice(input: PriceInput) {
  const regular = amount(input.regularAmount, input.currency),
    from = input.validFrom ? new Date(input.validFrom) : null,
    until = input.validUntil ? new Date(input.validUntil) : null;
  if (from && until && from >= until) fail('Offer end must be after start.');
  const promotions = input.promotions
    .map((p) => ({
      ...p,
      amount: amount(p.amount, input.currency),
      startsAt: new Date(p.startsAt),
      endsAt: new Date(p.endsAt),
    }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (const [i, p] of promotions.entries())
    if (
      decimal(p.amount).gte(decimal(regular)) ||
      p.startsAt >= p.endsAt ||
      (from && p.startsAt < from) ||
      (until && p.endsAt > until) ||
      (i && promotions[i - 1].endsAt > p.startsAt)
    )
      fail(
        'Promotions must discount the regular price and have nonoverlapping half-open windows inside the offer.',
      );
  return {
    currency: input.currency,
    regularAmount: regular,
    validFrom: from,
    validUntil: until,
    promotions,
  };
}
export function currentOffer(
  revision: {
    id: string;
    status: string;
    currency: string;
    regularAmount: { toString(): string } | string;
    validFrom: Date | null;
    validUntil: Date | null;
    approvedAt: Date | null;
    publishedAt: Date | null;
    promotions: {
      amount: { toString(): string } | string;
      startsAt: Date;
      endsAt: Date;
      label: string;
    }[];
  } | null,
  now: Date = new Date(),
) {
  if (
    !revision ||
    revision.status !== 'PUBLISHED' ||
    !revision.approvedAt ||
    !revision.publishedAt ||
    (revision.validFrom && now < revision.validFrom) ||
    (revision.validUntil && now >= revision.validUntil)
  )
    return null;
  const sale = revision.promotions.find(
    (p) => p.startsAt <= now && now < p.endsAt,
  );
  return {
    priceRevisionId: revision.id,
    currency: revision.currency,
    regularAmount: revision.regularAmount.toString(),
    sellingAmount: (sale?.amount ?? revision.regularAmount).toString(),
    promotion: sale?.label ?? null,
    source: 'APPROVED_STORE_OFFER' as const,
    evaluatedAt: now.toISOString(),
  };
}
