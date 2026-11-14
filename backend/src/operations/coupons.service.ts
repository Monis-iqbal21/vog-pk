import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { currencyPrecision } from './money.js';
import { OperationsAccess } from './access.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { z } from 'zod';
import * as v from './validation.js';

const decimal = (value: string, currency: string, allowZero = false) => {
  let amount: Prisma.Decimal;
  try { amount = new Prisma.Decimal(value); } catch { throw new ConflictException('Enter a valid coupon amount.'); }
  const integerDigits = Math.max(0, amount.precision() - amount.decimalPlaces());
  if (!amount.isFinite() || integerDigits > 18 || amount.decimalPlaces() > currencyPrecision(currency) || amount.isNegative() || (!allowZero && amount.isZero())) throw new ConflictException('Coupon amount is outside the supported currency precision.');
  return amount;
};

@Injectable()
export class CouponsService {
  constructor(@Inject(OperationsAccess) readonly access: OperationsAccess) {}

  async list(actor: string, storeId: string, input: z.infer<typeof v.page>) {
    const ctx = await this.access.context(actor, storeId, 'coupons.view');
    const where = { storeId: ctx.storeId, tenantId: ctx.tenantId, ...(input.search ? { code: { contains: input.search.toUpperCase(), mode: 'insensitive' as const } } : {}) };
    const [rows, total] = await Promise.all([
      this.access.db.storeCoupon.findMany({ where, orderBy: [{ archived: 'asc' }, { updatedAt: 'desc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      this.access.db.storeCoupon.count({ where }),
    ]);
    const store = await this.access.db.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId }, select: { currency: true } });
    return { rows, total, page: input.page, pageSize: input.pageSize, currency: store?.currency ?? 'PKR' };
  }

  create(actor: string, storeId: string, input: z.infer<typeof v.couponCreate>) {
    return this.access.write(actor, storeId, 'coupons.manage', async (tx, ctx) => {
      const store = await tx.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId }, select: { currency: true } });
      if (!store) throw new NotFoundException('Store not found.');
      const data = this.values(input, store.currency);
      const row = await tx.storeCoupon.create({ data: { ...data, tenantId: ctx.tenantId, storeId: ctx.storeId, code: input.code.toUpperCase(), createdBy: actor, updatedBy: actor } });
      await this.access.audit(tx, actor, ctx, 'coupon_created', row.id);
      return row;
    });
  }

  save(actor: string, storeId: string, id: string, input: z.infer<typeof v.couponSave>) {
    return this.access.write(actor, storeId, 'coupons.manage', async (tx, ctx) => {
      const current = await tx.storeCoupon.findFirst({ where: { id, storeId: ctx.storeId, tenantId: ctx.tenantId } });
      if (!current) throw new NotFoundException('Coupon not found.');
      if (current.revision !== input.expectedRevision) throw new ConflictException('Coupon changed. Reload before saving.');
      if (current.archived && input.active) throw new ConflictException('Archived coupons cannot be activated.');
      const { expectedRevision: _, ...coupon } = input;
      const store = await tx.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId }, select: { currency: true } });
      if (!store) throw new NotFoundException('Store not found.');
      const row = await tx.storeCoupon.update({ where: { id }, data: { ...this.values(coupon, store.currency), code: coupon.code.toUpperCase(), updatedBy: actor, revision: { increment: 1 } } });
      await this.access.audit(tx, actor, ctx, 'coupon_updated', id);
      return row;
    });
  }

  archive(actor: string, storeId: string, id: string, expectedRevision: number) {
    return this.access.write(actor, storeId, 'coupons.manage', async (tx, ctx) => {
      const current = await tx.storeCoupon.findFirst({ where: { id, storeId: ctx.storeId, tenantId: ctx.tenantId } });
      if (!current) throw new NotFoundException('Coupon not found.');
      if (current.revision !== expectedRevision) throw new ConflictException('Coupon changed. Reload before archiving.');
      const row = await tx.storeCoupon.update({ where: { id }, data: { active: false, archived: true, updatedBy: actor, revision: { increment: 1 } } });
      await this.access.audit(tx, actor, ctx, 'coupon_archived', id);
      return row;
    });
  }

  private values(input: z.infer<typeof v.coupon>, currency: string) {
    if (input.currency !== currency) throw new ConflictException('Coupon currency must match the store currency.');
    if (new Date(input.endsAt) <= new Date(input.startsAt)) throw new ConflictException('Coupon expiry must be after its start time.');
    const value = decimal(input.discountValue, currency), minimumOrder = decimal(input.minimumOrder, currency, true);
    if (input.discountType === 'PERCENT' && value.gt(100)) throw new ConflictException('Percentage discount cannot exceed 100%.');
    return { discountType: input.discountType, discountValue: value, minimumOrder, currency, usageLimit: input.usageLimit, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), active: input.active };
  }

  async apply(tx: ScopeTransaction, ctx: { storeId: string; tenantId: string; currency: string }, rawCode: string | undefined, subtotal: Prisma.Decimal, now: Date) {
    if (!rawCode) return { coupon: null, code: null, discount: new Prisma.Decimal(0), total: subtotal };
    const code = rawCode.trim().toUpperCase();
    const coupon = await tx.storeCoupon.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, code, active: true, archived: false, startsAt: { lte: now }, endsAt: { gt: now } } });
    if (!coupon || coupon.currency !== ctx.currency || (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)) throw new ConflictException('This coupon is invalid or unavailable.');
    if (subtotal.lt(coupon.minimumOrder)) throw new ConflictException('The cart does not meet this coupon’s minimum order amount.');
    const discount = coupon.discountType === 'PERCENT'
      ? subtotal.mul(coupon.discountValue).div(100).toDecimalPlaces(currencyPrecision(ctx.currency), Prisma.Decimal.ROUND_DOWN)
      : Prisma.Decimal.min(subtotal, coupon.discountValue);
    return { coupon, code: coupon.code, discount, total: subtotal.sub(discount) };
  }

  async redeem(tx: ScopeTransaction, ctx: { storeId: string; tenantId: string }, coupon: { id: string; usageLimit: number | null; revision: number } | null, orderId: string, now: Date) {
    if (!coupon) return;
    const result = await tx.storeCoupon.updateMany({
      where: { id: coupon.id, tenantId: ctx.tenantId, storeId: ctx.storeId, active: true, archived: false, revision: coupon.revision, startsAt: { lte: now }, endsAt: { gt: now }, ...(coupon.usageLimit === null ? { usageLimit: null } : { usageLimit: coupon.usageLimit, usageCount: { lt: coupon.usageLimit } }) },
      data: { usageCount: { increment: 1 } },
    });
    if (result.count !== 1) throw new ConflictException('This coupon reached its limit while checkout was being completed.');
    await tx.couponRedemption.create({ data: { tenantId: ctx.tenantId, storeId: ctx.storeId, couponId: coupon.id, orderId } });
  }
}
