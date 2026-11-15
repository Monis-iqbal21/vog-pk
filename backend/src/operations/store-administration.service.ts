import { ConflictException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OperationsAccess } from './access.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import * as v from './validation.js';

const transitions: Record<string, readonly string[]> = {
  RECEIVED: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED'], DELIVERED: [], CANCELLED: [],
};

@Injectable()
export class StoreAdministrationService {
  constructor(@Inject(OperationsAccess) readonly access: OperationsAccess) {}

  async dashboard(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'dashboard.view'), db = this.access.db;
    const [orders, pendingOrders, publishedListings, knownBalances, inventoryRows] = await Promise.all([
      db.storeOrder.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } }),
      db.storeOrder.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, status: { in: ['RECEIVED', 'CONFIRMED', 'PROCESSING'] } } }),
      db.storeListing.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, archived: false, published: { is: { status: 'PUBLISHED', visible: true } } } }),
      db.stockBalance.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, known: true, item: { policy: 'QUANTITY' }, location: { active: true } } }),
      db.inventoryItem.count({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, policy: 'QUANTITY' } }),
    ]);
    const store = await db.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId }, select: { name: true, currency: true } });
    return { store: { id: ctx.storeId, name: store?.name ?? 'Store', currency: store?.currency ?? 'PKR' }, orders, pendingOrders, publishedListings, verifiedStockBalances: knownBalances, quantityInventoryItems: inventoryRows };
  }

  async settings(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'settings.view');
    const row = await this.access.db.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId }, select: { id: true, name: true, slug: true, currency: true, locale: true, timeZone: true, settingsRevision: true } });
    if (!row) throw new NotFoundException('Store not found.');
    return { ...row, revision: row.settingsRevision };
  }

  saveSettings(actor: string, storeId: string, input: z.infer<typeof v.storeSettings>) {
    try { new Intl.DateTimeFormat('en', { timeZone: input.timeZone }); } catch { throw new ConflictException('Choose a supported time zone.'); }
    return this.access.write(actor, storeId, 'settings.manage', async (tx, ctx) => {
      const current = await tx.store.findFirst({ where: { id: ctx.storeId, tenantId: ctx.tenantId } });
      if (!current) throw new NotFoundException('Store not found.');
      if (current.settingsRevision !== input.expectedRevision) throw new ConflictException('Store settings changed. Reload before saving.');
      const saved = await tx.store.update({ where: { id: ctx.storeId }, data: { name: input.name, locale: input.locale, timeZone: input.timeZone, settingsRevision: { increment: 1 } } });
      await this.access.audit(tx, actor, ctx, 'store_settings_updated', saved.id);
      return { id: saved.id, name: saved.name, slug: saved.slug, currency: saved.currency, locale: saved.locale, timeZone: saved.timeZone, revision: saved.settingsRevision };
    });
  }

  async homepage(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'homepage.view');
    const page = await this.access.db.storeHomepage.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId }, include: { revisions: { orderBy: { number: 'desc' }, take: 20 } } });
    return { revision: page?.revision ?? 0, archived: page?.archived ?? false, draft: page?.revisions.find((r) => r.status === 'DRAFT') ?? null, published: page?.revisions.find((r) => r.status === 'PUBLISHED') ?? null };
  }

  async homepageAssets(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'homepage.view');
    const [references, categories] = await Promise.all([
      this.access.db.listingRevisionMedia.findMany({
        where: { tenantId: ctx.tenantId, storeId: ctx.storeId, visible: true, revision: { status: 'PUBLISHED', visible: true, listing: { archived: false }, publishedFor: { some: { archived: false } } },
          OR: [
            { productMedia: { asset: { tenantId: ctx.tenantId, archived: false, rights: 'APPROVED', publicUse: true, developmentOnly: false } } },
            { skuMedia: { asset: { tenantId: ctx.tenantId, archived: false, rights: 'APPROVED', publicUse: true, developmentOnly: false } } },
          ] },
        include: { productMedia: { include: { asset: true } }, skuMedia: { include: { asset: true } }, revision: { select: { listingId: true } } },
        orderBy: [{ purpose: 'asc' }, { sortOrder: 'asc' }], take: 300,
      }),
      this.access.db.category.findMany({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId, status: 'ACTIVE' }, select: { id: true, name: true, slug: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    const seen = new Set<string>(), assets = [];
    for (const ref of references) {
      const asset = ref.productMedia?.asset ?? ref.skuMedia?.asset;
      if (!asset || seen.has(asset.id)) continue;
      seen.add(asset.id);
      assets.push({ id: asset.id, code: asset.code, altText: ref.altText || asset.altText, previewUrl: `/api/admin/stores/${ctx.storeId}/operations/listings/${ref.revision.listingId}/revisions/${ref.listingRevisionId}/media/${asset.id}/content?width=640` });
    }
    return { assets, categories };
  }

  saveHomepage(actor: string, storeId: string, expectedRevision: number, content: z.infer<typeof v.homepageContent>, publish: boolean) {
    return this.access.write(actor, storeId, 'homepage.manage', async (tx, ctx) => {
      let homepage = await tx.storeHomepage.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } });
      if ((homepage?.revision ?? 0) !== expectedRevision) throw new ConflictException('Homepage content changed. Reload before saving.');
      if (homepage?.archived) throw new ConflictException('Archived homepage content cannot be edited.');
      if (publish) await this.validateHomepage(tx, ctx, content);
      if (!homepage) homepage = await tx.storeHomepage.create({ data: { tenantId: ctx.tenantId, storeId: ctx.storeId, revision: 0, updatedBy: actor } });
      await tx.storeHomepageRevision.updateMany({ where: { homepageId: homepage.id, status: 'DRAFT' }, data: { status: 'ARCHIVED' } });
      const revision = homepage.revision + 1;
      const saved = await tx.storeHomepageRevision.create({ data: { tenantId: ctx.tenantId, storeId: ctx.storeId, homepageId: homepage.id, number: revision, status: publish ? 'PUBLISHED' : 'DRAFT', content: content as object, createdBy: actor, ...(publish ? { publishedAt: new Date(), publishedBy: actor } : {}) } });
      await tx.storeHomepage.update({ where: { id: homepage.id }, data: { revision, updatedBy: actor } });
      await this.access.audit(tx, actor, ctx, publish ? 'homepage_published' : 'homepage_draft_saved', saved.id);
      return saved;
    });
  }

  async archiveHomepage(actor: string, storeId: string, expectedRevision: number) {
    return this.access.write(actor, storeId, 'homepage.manage', async (tx, ctx) => {
      const homepage = await tx.storeHomepage.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } });
      if (!homepage) throw new NotFoundException('Homepage content not found.');
      if (homepage.revision !== expectedRevision) throw new ConflictException('Homepage content changed. Reload before archiving.');
      const saved = await tx.storeHomepage.update({ where: { id: homepage.id }, data: { archived: true, revision: { increment: 1 }, updatedBy: actor } });
      await this.access.audit(tx, actor, ctx, 'homepage_archived', homepage.id);
      return { archived: saved.archived, revision: saved.revision };
    });
  }

  private async validateHomepage(tx: ScopeTransaction, ctx: StoreContext, content: z.infer<typeof v.homepageContent>) {
    const assetIds = [...new Set(content.slides.flatMap((slide) => slide.imageAssetId ? [slide.imageAssetId] : []))];
    const assets = await tx.mediaAsset.findMany({ where: { id: { in: assetIds }, tenantId: ctx.tenantId, archived: false, rights: 'APPROVED', publicUse: true, developmentOnly: false, productReferences: { some: { listingPins: { some: { visible: true, revision: { storeId: ctx.storeId, status: 'PUBLISHED', visible: true, publishedFor: { some: { archived: false } } } } } } } }, select: { id: true } });
    if (assets.length !== assetIds.length) throw new ConflictException('Every published hero slide must use an approved public media asset.');
    const categoryIds = [...new Set(content.sections.flatMap((section) => section.categoryId ? [section.categoryId] : []))];
    const categories = await tx.category.findMany({ where: { id: { in: categoryIds }, storeId: ctx.storeId, tenantId: ctx.tenantId, status: 'ACTIVE' }, select: { id: true } });
    if (categories.length !== categoryIds.length) throw new ConflictException('Homepage category placement must use an active category in this store.');
  }

  async orders(actor: string, storeId: string, input: z.infer<typeof v.orderList>) {
    const ctx = await this.access.context(actor, storeId, 'orders.view');
    const where = { storeId: ctx.storeId, tenantId: ctx.tenantId, ...(input.status ? { status: input.status } : {}), ...(input.search ? { OR: [{ orderNumber: { contains: input.search, mode: 'insensitive' as const } }, { phone: { contains: input.search } }] } : {}) };
    const [rows, total] = await Promise.all([
      this.access.db.storeOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, include: { _count: { select: { items: true } } } }),
      this.access.db.storeOrder.count({ where }),
    ]);
    return { rows: rows.map(({ _count, customerName, phone: _phone, address: _address, ...row }) => ({ ...row, customerName, itemCount: _count.items })), total, page: input.page, pageSize: input.pageSize };
  }

  async order(actor: string, storeId: string, orderId: string) {
    const ctx = await this.access.context(actor, storeId, 'orders.view');
    const row = await this.access.db.storeOrder.findFirst({ where: { id: orderId, storeId: ctx.storeId, tenantId: ctx.tenantId }, include: { items: { orderBy: { id: 'asc' } } } });
    if (!row) throw new NotFoundException('Order not found.');
    return row;
  }

  transitionOrder(actor: string, storeId: string, orderId: string, input: z.infer<typeof v.orderTransition>) {
    let step = 'transaction';
    return this.access.write(actor, storeId, 'orders.manage', async (tx, ctx) => {
      step = 'load-order';
      const current = await tx.storeOrder.findFirst({ where: { id: orderId, storeId: ctx.storeId, tenantId: ctx.tenantId }, include: { items: true } });
      if (!current) throw new NotFoundException('Order not found.');
      if (current.revision !== input.expectedRevision) throw new ConflictException('Order changed. Reload before updating.');
      if (!transitions[current.status].includes(input.status)) throw new ConflictException('This order status transition is not allowed.');
      step = 'save-status';
      const changed = await tx.storeOrder.update({ where: { id: current.id }, data: { status: input.status, revision: { increment: 1 } } });
      if (input.status === 'CANCELLED') {
        step = 'validate-reservation';
        const allocations = current.items.flatMap((item) => Array.isArray(item.inventoryReservation) ? item.inventoryReservation.flatMap((value) => {
          if (!value || typeof value !== 'object' || Array.isArray(value) || !('balanceId' in value) || !('inventoryItemId' in value) || !('quantity' in value) || typeof value.balanceId !== 'string' || typeof value.inventoryItemId !== 'string' || typeof value.quantity !== 'number' || !Number.isSafeInteger(value.quantity) || value.quantity <= 0) throw new ConflictException('Order stock reservation is incomplete; cancellation needs manual review.');
          return [{ balanceId: value.balanceId, inventoryItemId: value.inventoryItemId, quantity: value.quantity }];
        }) : []);
        if (allocations.length === 0) throw new ConflictException('Order stock reservation is missing; cancellation needs manual review.');
        const balanceIds = [...new Set(allocations.map((item) => item.balanceId))].sort();
        step = 'lock-stock';
        for (const balanceId of balanceIds) await tx.$queryRaw`SELECT id FROM "StockBalance" WHERE id=${balanceId}::uuid FOR UPDATE`;
        step = 'restore-stock';
        for (const allocation of allocations) {
          const balance = await tx.stockBalance.findFirst({ where: { id: allocation.balanceId, storeId: ctx.storeId, tenantId: ctx.tenantId, inventoryItemId: allocation.inventoryItemId, known: true } });
          if (!balance) throw new ConflictException('Reserved stock balance is unavailable; cancellation needs manual review.');
          const saved = await tx.stockBalance.update({ where: { id: balance.id }, data: { onHand: { increment: allocation.quantity }, revision: { increment: 1 } } });
          await tx.inventoryMovement.create({ data: { tenantId: ctx.tenantId, storeId: ctx.storeId, inventoryItemId: allocation.inventoryItemId, balanceId: balance.id, idempotencyKey: randomUUID(), requestHash: createHash('sha256').update(`order-cancel:${current.id}:${balance.id}`).digest('hex'), mode: 'DELTA', beforeQuantity: balance.onHand, afterQuantity: saved.onHand, beforeKnown: true, afterKnown: true, balanceRevision: saved.revision, reason: `Order ${current.orderNumber} cancellation stock release`, actorId: actor } });
        }
      }
      step = 'audit';
      await this.access.audit(tx, actor, ctx, 'order_status_changed', current.id);
      return changed;
    }).catch((error: unknown) => {
      if (!(error instanceof HttpException)) {
        const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^P\d{4}$/.test(error.code) ? error.code : 'UNEXPECTED';
        console.error(JSON.stringify({ event: 'operations.order-transition.failed', step, code }));
      }
      throw error;
    });
  }
}
