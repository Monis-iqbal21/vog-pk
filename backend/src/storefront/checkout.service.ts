import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../security/database.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { currencyPrecision } from '../operations/money.js';
import { StorefrontService } from './storefront.service.js';
import type { CartLines, CheckoutOrder } from './checkout.validation.js';
import { PAKISTAN_CITIES } from './pakistan-cities.js';
type CatalogContext = Awaited<ReturnType<StorefrontService['context']>>;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

type PricedLine = {
  listingId: string;
  listingRevisionId: string;
  skuRevisionId: string;
  skuId: string;
  productName: string;
  variantName: string;
  skuCode: string;
  selections: Prisma.JsonObject;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  inventoryItemId: string;
  stock: { id: string; locationId: string; onHand: number; known: boolean; revision: number }[];
};

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(DatabaseService) readonly db: DatabaseService,
    @Inject(StorefrontService) readonly catalog: StorefrontService,
  ) {}

  async context(tx: ScopeTransaction) {
    return this.catalog.context(tx);
  }

  async settings(tx: ScopeTransaction, ctx: CatalogContext) {
    const row = await tx.storeCheckoutSettings.findFirst({
      where: { storeId: ctx.storeId, tenantId: ctx.tenantId },
      select: { codEnabled: true, cardEnabled: true, revision: true },
    });
    return {
      revision: row?.revision ?? 0,
      enabled: Boolean(row?.codEnabled),
      // Card is intentionally unavailable until a verified gateway exists.
      paymentMethods: row?.codEnabled ? [{ code: 'COD' as const, label: 'Cash on Delivery' }] : [],
      cities: PAKISTAN_CITIES,
      currency: ctx.currency,
    };
  }

  async configuration() {
    return this.catalog.read(async (tx, ctx) => this.settings(tx, ctx));
  }

  private async eligibleLine(
    tx: ScopeTransaction,
    ctx: CatalogContext,
    line: CartLines[number],
    now: Date,
  ): Promise<PricedLine> {
    const listing = await tx.storeListing.findFirst({
      where: { id: line.listingId, storeId: ctx.storeId, tenantId: ctx.tenantId, archived: false, publishedRevisionId: { not: null } },
      include: {
        published: {
          include: {
            productRevision: { include: { product: true, bindings: true } },
            skus: { include: { skuRevision: { include: { sku: true } } } },
          },
        },
      },
    });
    const revision = listing?.published;
    if (!listing || !revision || revision.status !== 'PUBLISHED' || !revision.visible || revision.sellingMode !== 'RETAIL' ||
      revision.productRevision.status !== 'PUBLISHED' || revision.productRevision.product.archived ||
      revision.productRevision.product.publishedRevisionId !== revision.productRevisionId)
      throw new ConflictException('A cart item is no longer available for purchase.');

    const pin = revision.skus.find((candidate) => candidate.skuRevision.sku.code === line.skuCode);
    if (!pin || pin.skuRevision.state !== 'ACTIVE' || pin.skuRevision.sku.archived || pin.skuRevision.productRevisionId !== revision.productRevisionId)
      throw new BadRequestException('Choose a valid product variant.');

    const facts = pin.skuRevision.sku.identityFacts;
    const selectionFacts: [string, string][] = Array.isArray(facts)
      ? facts.flatMap((fact): [string, string][] => Array.isArray(fact) && fact.length === 2 && typeof fact[0] === 'string' && typeof fact[1] === 'string' ? [[fact[0], fact[1]]] : [])
      : [];
    const selections = Object.fromEntries(selectionFacts) as Prisma.JsonObject;
    const variantName = selectionFacts
      .flatMap(([attributeId, optionId]) => {
          const binding = revision.productRevision.bindings.find((candidate) => candidate.attributeId === attributeId);
          const snapshot = binding?.snapshot as { label?: string; options?: { id: string; label: string }[] } | undefined;
          const option = snapshot?.options?.find((candidate) => candidate.id === optionId);
          return option ? [`${snapshot?.label ?? 'Option'}: ${option.label}`] : [];
        }).join(' · ') || 'Default variant';

    const storePrice = await tx.storePrice.findUnique({
      where: { storeId_skuId: { storeId: ctx.storeId, skuId: pin.skuRevision.skuId } },
      include: { published: { include: { promotions: true, approvals: true } } },
    });
    const price = storePrice?.published;
    if (!price || price.status !== 'PUBLISHED' || !price.approvedAt || !price.publishedAt ||
      !price.approvals.some((approval) => approval.approvedRevision === price.revision - 1 && approval.actorId === price.approvedBy) ||
      (price.validFrom && price.validFrom > now) || (price.validUntil && price.validUntil <= now) || price.currency !== ctx.currency)
      throw new ConflictException('A cart item has no current approved store price.');

    const promotion = price.promotions.find((candidate) => candidate.startsAt <= now && candidate.endsAt > now);
    const unitPrice = new Prisma.Decimal(promotion?.amount ?? price.regularAmount);
    if (unitPrice.lte(0) || unitPrice.decimalPlaces() > currencyPrecision(ctx.currency))
      throw new ConflictException('A cart item price is not valid for the store currency.');

    const inventory = await tx.inventoryItem.findUnique({
      where: { storeId_skuId: { storeId: ctx.storeId, skuId: pin.skuRevision.skuId } },
      include: { balances: { where: { location: { active: true } }, orderBy: [{ locationId: 'asc' }, { id: 'asc' }] } },
    });
    const locations = await tx.inventoryLocation.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, active: true } });
    if (!inventory || inventory.policy !== 'QUANTITY' || locations < 1 || inventory.balances.length !== locations || inventory.balances.some((balance) => !balance.known))
      throw new ConflictException('Stock is not fully verified for a cart item.');

    return {
      listingId: listing.id,
      listingRevisionId: revision.id,
      skuRevisionId: pin.skuRevision.id,
      skuId: pin.skuRevision.skuId,
      productName: revision.title,
      variantName,
      skuCode: pin.skuRevision.sku.code,
      selections,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice.mul(line.quantity),
      inventoryItemId: inventory.id,
      stock: inventory.balances.map(({ id, locationId, onHand, known, revision: stockRevision }) => ({ id, locationId, onHand, known, revision: stockRevision })),
    };
  }

  private async quoteIn(tx: ScopeTransaction, ctx: CatalogContext, lines: CartLines, now = new Date()) {
    const priced: PricedLine[] = [];
    for (const line of lines) priced.push(await this.eligibleLine(tx, ctx, line, now));
    const quantities = new Map<string, number>();
    for (const line of priced) quantities.set(line.inventoryItemId, (quantities.get(line.inventoryItemId) ?? 0) + line.quantity);
    for (const line of priced) {
      const requested = quantities.get(line.inventoryItemId)!;
      if (line.stock.reduce((sum, balance) => sum + balance.onHand, 0) < requested)
        throw new ConflictException('Stock changed or the requested quantity is unavailable.');
    }
    const subtotal = priced.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    return { priced, subtotal, total: subtotal };
  }

  async quote(lines: CartLines) {
    return this.catalog.read(async (tx, ctx) => {
      const { priced, subtotal, total } = await this.quoteIn(tx, ctx, lines);
      return {
        currency: ctx.currency,
        items: priced.map((line) => ({ listingId: line.listingId, skuCode: line.skuCode, productName: line.productName, variantName: line.variantName, quantity: line.quantity, availableQuantity: line.stock.reduce((sum, balance) => sum + balance.onHand, 0), unitPrice: line.unitPrice.toString(), lineTotal: line.lineTotal.toString() })),
        subtotal: subtotal.toString(), delivery: '0', total: total.toString(),
      };
    });
  }

  private async lockStock(tx: ScopeTransaction, priced: PricedLine[]) {
    const inventoryIds = [...new Set(priced.map((line) => line.inventoryItemId))].sort();
    for (const id of inventoryIds) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "InventoryItem" WHERE id=${id}::uuid FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT b.id FROM "StockBalance" b JOIN "InventoryLocation" l ON l.id=b."locationId" WHERE b."inventoryItemId"=${id}::uuid AND l.active ORDER BY b."locationId",b.id FOR UPDATE OF b`);
    }
  }

  private async reserveStock(tx: ScopeTransaction, orderNumber: string, hash: string, priced: PricedLine[]) {
    const grouped = new Map<string, { quantity: number; lines: PricedLine[] }>();
    for (const line of priced) {
      const item = grouped.get(line.inventoryItemId) ?? { quantity: 0, lines: [] };
      item.quantity += line.quantity;
      item.lines.push(line);
      grouped.set(line.inventoryItemId, item);
    }
    for (const [inventoryItemId, group] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, include: { balances: { where: { location: { active: true } }, orderBy: [{ locationId: 'asc' }, { id: 'asc' }] } } });
      if (!item) throw new ConflictException('Stock configuration changed during checkout.');
      const locations = await tx.inventoryLocation.count({ where: { storeId: item.storeId, tenantId: item.tenantId, active: true } });
      if (!item || item.policy !== 'QUANTITY' || item.balances.length !== locations || item.balances.some((balance) => !balance.known) || item.balances.reduce((sum, balance) => sum + balance.onHand, 0) < group.quantity)
        throw new ConflictException('Stock changed while checkout was being submitted.');
      let remaining = group.quantity;
      for (const balance of item.balances) {
        if (remaining === 0) break;
        const taken = Math.min(balance.onHand, remaining);
        if (!taken) continue;
        const updated = await tx.stockBalance.update({ where: { id: balance.id }, data: { onHand: { decrement: taken }, revision: { increment: 1 } } });
        await tx.inventoryMovement.create({ data: {
          tenantId: item.tenantId, storeId: item.storeId, inventoryItemId: item.id, balanceId: balance.id,
          idempotencyKey: randomUUID(), requestHash: hash, mode: 'DELTA', beforeQuantity: balance.onHand,
          afterQuantity: updated.onHand, beforeKnown: true, afterKnown: true, balanceRevision: updated.revision,
          reason: `Customer order ${orderNumber} stock reservation`, actorId: null,
        } });
        remaining -= taken;
      }
      if (remaining) throw new ConflictException('Stock changed while checkout was being submitted.');
    }
  }

  async create(input: CheckoutOrder, origin: string | undefined) {
    const allowedOrigin = process.env.STOREFRONT_ORIGIN;
    if (!allowedOrigin || origin !== allowedOrigin) throw new ForbiddenException('Checkout origin is not allowed.');
    if (input.paymentMethod !== 'COD') throw new ConflictException('Card payment is unavailable until a verified payment gateway is configured.');
    if (!PAKISTAN_CITIES.includes(input.city as (typeof PAKISTAN_CITIES)[number])) throw new BadRequestException('Select a supported city in Pakistan.');
    const normalized = { ...input, customerName: input.customerName.trim(), phone: input.phone.trim(), city: input.city.trim(), address: input.address.trim(), items: [...input.items].sort((a, b) => `${a.listingId}:${a.skuCode}`.localeCompare(`${b.listingId}:${b.skuCode}`)) };
    const hash = digest(JSON.stringify({ ...normalized, idempotencyKey: undefined }));
    const storeCtx = await this.db.$transaction(async (tx) => this.context(tx), { isolationLevel: 'RepeatableRead', timeout: 15000 });
    const prior = await this.db.storeOrder.findUnique({ where: { storeId_idempotencyKey: { storeId: storeCtx.storeId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
    if (prior) {
      if (prior.requestHash !== hash) throw new ConflictException('This checkout key was already used for a different order.');
      return this.confirmation(prior, input.idempotencyKey, true);
    }

    let step = 'transaction';
    try {
      const order = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '12000'`;
        const ctx = await this.context(tx);
        step = 'payment-settings';
        const checkout = await tx.storeCheckoutSettings.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } });
        if (!checkout?.codEnabled || checkout.cardEnabled) throw new ConflictException('The selected payment method is not active for this store.');
        step = 'server-price-and-stock-validation';
        const { priced, subtotal } = await this.quoteIn(tx, ctx, normalized.items);
        step = 'stock-locking';
        await this.lockStock(tx, priced);
        const now = new Date();
        const orderId = randomUUID();
        const orderNumber = `VOG-${now.toISOString().slice(2, 10).replaceAll('-', '')}-${randomBytes(10).toString('hex').toUpperCase()}`;
        step = 'order-and-line-snapshots';
        const created = await tx.storeOrder.create({ data: {
          id: orderId, tenantId: ctx.tenantId, storeId: ctx.storeId, orderNumber,
          idempotencyKey: input.idempotencyKey, requestHash: hash, receiptTokenHash: digest(input.idempotencyKey),
          customerName: normalized.customerName, phone: normalized.phone, city: normalized.city, address: normalized.address,
          paymentMethod: 'COD', paymentStatus: 'PENDING', currency: ctx.currency, subtotal, total: subtotal,
          items: { create: priced.map((line) => ({ listingRevisionId: line.listingRevisionId, skuRevisionId: line.skuRevisionId, productName: line.productName, variantName: line.variantName, skuCode: line.skuCode, selections: line.selections, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })) },
        }, include: { items: true } });
        step = 'inventory-ledger';
        await this.reserveStock(tx, orderNumber, hash, priced);
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 5000 });
      return this.confirmation(order, input.idempotencyKey, false);
    } catch (error) {
      if (!(error instanceof HttpException) && !(error && typeof error === 'object' && 'code' in error && (error.code === 'P2002' || error.code === 'P2034'))) {
        const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^P\d{4}$/.test(error.code) ? error.code : 'UNEXPECTED';
        console.error(JSON.stringify({ event: 'checkout.transaction.failed', step, code }));
      }
      if (error && typeof error === 'object' && 'code' in error && (error.code === 'P2002' || error.code === 'P2034')) {
        const duplicate = await this.db.storeOrder.findUnique({ where: { storeId_idempotencyKey: { storeId: storeCtx.storeId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
        if (duplicate?.requestHash === hash) return this.confirmation(duplicate, input.idempotencyKey, true);
        throw new ConflictException('Checkout changed concurrently. Verify the cart and submit again with the same checkout key.');
      }
      throw error;
    }
  }

  private confirmation(order: { orderNumber: string; currency: string; subtotal: Prisma.Decimal; total: Prisma.Decimal; paymentMethod: string; paymentStatus: string; status: string; createdAt: Date; items: { productName: string; variantName: string; skuCode: string; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }[] }, receiptToken: string, replayed: boolean) {
    return {
      orderNumber: order.orderNumber,
      receiptToken,
      replayed,
      receipt: {
        currency: order.currency, subtotal: order.subtotal.toString(), total: order.total.toString(),
        paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, status: order.status, createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({ productName: item.productName, variantName: item.variantName, skuCode: item.skuCode, quantity: item.quantity, unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString() })),
      },
    };
  }

  async readReceipt(orderNumber: string, token: string) {
    return this.catalog.read(async (tx, ctx) => {
      const order = await tx.storeOrder.findFirst({ where: { orderNumber, storeId: ctx.storeId, tenantId: ctx.tenantId }, include: { items: { orderBy: { id: 'asc' } } } });
      if (!order || !safeEqual(order.receiptTokenHash, digest(token))) throw new NotFoundException('Order receipt not found.');
      return {
        orderNumber: order.orderNumber, customerName: order.customerName, phone: order.phone,
        city: order.city, address: order.address, currency: order.currency,
        subtotal: order.subtotal.toString(), total: order.total.toString(), paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus, status: order.status, createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({ productName: item.productName, variantName: item.variantName, skuCode: item.skuCode, quantity: item.quantity, unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString() })),
      };
    });
  }
}
