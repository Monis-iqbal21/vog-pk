import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OperationsAccess } from './access.js';
import { ownership, stale } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import * as v from './validation.js';
import type { z } from 'zod';
@Injectable()
export class InventoryService {
  constructor(@Inject(OperationsAccess) readonly access: OperationsAccess) {}
  async locations(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'inventory.view');
    return this.access.db.inventoryLocation.findMany({
      where: ownership(ctx),
      take: 100,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }
  location(actor: string, storeId: string, input: z.infer<typeof v.location>) {
    return this.access.write(
      actor,
      storeId,
      'inventory.configure',
      async (tx, ctx) => {
        if (
          (await tx.inventoryLocation.count({ where: ownership(ctx) })) >= 100
        )
          fail('Location limit reached.');
        const row = await tx.inventoryLocation.create({
          data: { ...ownership(ctx), ...input },
        });
        await this.access.audit(tx, actor, ctx, 'location_created', row.id);
        return row;
      },
    );
  }
  configure(
    actor: string,
    storeId: string,
    skuId: string,
    input: z.infer<typeof v.policy>,
  ) {
    return this.access.write(
      actor,
      storeId,
      'inventory.configure',
      async (tx, ctx) => {
        const sku = await this.access.sku(tx, ctx, skuId, true),
          row = await tx.inventoryItem.findUnique({
            where: { storeId_skuId: { storeId, skuId } },
          });
        if ((row?.revision ?? 0) !== input.revision) stale();
        if (
          row &&
          row.policy !== input.policy &&
          (await tx.inventoryMovement.count({
            where: { inventoryItemId: row.id, ...ownership(ctx) },
          }))
        )
          throw new ConflictException(
            'Inventory with movements needs an explicitly reviewed policy migration.',
          );
        const result = row
          ? await tx.inventoryItem.update({
              where: { id: row.id },
              data: {
                policy: input.policy,
                lowStockThreshold: input.lowStockThreshold,
                revision: { increment: 1 },
              },
            })
          : await tx.inventoryItem.create({
              data: {
                ...ownership(ctx),
                productId: sku.productId,
                skuId,
                policy: input.policy,
                lowStockThreshold: input.lowStockThreshold,
              },
            });
        await this.access.audit(
          tx,
          actor,
          ctx,
          'inventory_configured',
          result.id,
        );
        return result;
      },
    );
  }
  async read(actor: string, storeId: string, skuId: string) {
    const ctx = await this.access.context(actor, storeId, 'inventory.view');
    await this.access.sku(this.access.db, ctx, skuId);
    const item = await this.access.db.inventoryItem.findUnique({
      where: { storeId_skuId: { storeId, skuId } },
      include: { balances: { include: { location: true } } },
    });
    return {
      item,
      summary: await this.summary(this.access.db, ctx, skuId),
      purchasable: false,
    };
  }
  adjust(
    actor: string,
    storeId: string,
    skuId: string,
    input: z.infer<typeof v.adjustment>,
  ) {
    return this.access.write(
      actor,
      storeId,
      'inventory.adjust',
      async (tx, ctx) => {
        await this.access.sku(tx, ctx, skuId, true);
        const hash = createHash('sha256')
          .update(JSON.stringify({ skuId, ...input }))
          .digest('hex');
        const prior = await tx.inventoryMovement.findUnique({
          where: {
            storeId_idempotencyKey: {
              storeId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (prior) {
          if (prior.requestHash !== hash)
            throw new ConflictException(
              'Idempotency key belongs to another adjustment payload.',
            );
          return { movement: prior, replayed: true };
        }
        const item = await tx.inventoryItem.findUnique({
          where: { storeId_skuId: { storeId, skuId } },
        });
        if (!item || item.policy !== 'QUANTITY')
          fail(
            'Quantity adjustments require the QUANTITY policy; other policies do not imply stock.',
          );
        const location = await tx.inventoryLocation.findFirst({
          where: { id: input.locationId, ...ownership(ctx), active: true },
        });
        if (!location)
          fail('Location belongs to another store or is inactive.');
        const balance = await tx.stockBalance.upsert({
          where: {
            inventoryItemId_locationId: {
              inventoryItemId: item.id,
              locationId: location.id,
            },
          },
          create: {
            ...ownership(ctx),
            inventoryItemId: item.id,
            locationId: location.id,
          },
          update: {},
        });
        if (balance.revision !== input.expectedRevision) stale();
        if (input.mode === 'DELTA' && !balance.known)
          throw new ConflictException(
            'Count and verify unknown stock before applying a delta.',
          );
        if (input.mode === 'INVALIDATE' && input.quantity !== 0)
          fail(
            'Invalidating verification does not alter the recorded quantity.',
          );
        const known = input.mode !== 'INVALIDATE';
        const next =
          input.mode === 'COUNT'
            ? input.quantity
            : input.mode === 'INVALIDATE'
              ? balance.onHand
              : balance.onHand + input.quantity;
        if (next < 0 || next > 1000000000)
          fail('Stock cannot become negative or exceed the safe limit.');
        const updated = await tx.stockBalance.update({
          where: { id: balance.id },
          data: { onHand: next, known, revision: { increment: 1 } },
        });
        const movement = await tx.inventoryMovement.create({
          data: {
            ...ownership(ctx),
            inventoryItemId: item.id,
            balanceId: balance.id,
            idempotencyKey: input.idempotencyKey,
            requestHash: hash,
            mode: input.mode,
            beforeQuantity: balance.onHand,
            afterQuantity: next,
            beforeKnown: balance.known,
            afterKnown: known,
            balanceRevision: updated.revision,
            reason: input.reason,
            actorId: actor,
          },
        });
        await this.access.audit(
          tx,
          actor,
          ctx,
          'inventory_adjusted',
          movement.id,
        );
        return { movement, replayed: false };
      },
    );
  }
  async history(
    actor: string,
    storeId: string,
    skuId: string,
    q: z.infer<typeof v.page>,
  ) {
    const ctx = await this.access.context(actor, storeId, 'inventory.audit');
    await this.access.sku(this.access.db, ctx, skuId);
    const where = { ...ownership(ctx), item: { skuId } };
    return {
      items: await this.access.db.inventoryMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      total: await this.access.db.inventoryMovement.count({ where }),
    };
  }
  async summary(tx: ScopeTransaction, ctx: StoreContext, skuId: string) {
    const item = await tx.inventoryItem.findUnique({
      where: { storeId_skuId: { storeId: ctx.storeId, skuId } },
      include: { balances: { where: { location: { active: true } } } },
    });
    if (!item || item.policy === 'UNTRACKED')
      return {
        policy: 'UNTRACKED',
        known: false,
        quantity: null,
        status: 'UNKNOWN',
        lowStock: false,
      };
    if (item.policy === 'SERIALIZED')
      return {
        policy: item.policy,
        known: false,
        quantity: null,
        status: 'SERIALIZED_NOT_IMPLEMENTED',
        lowStock: false,
      };
    if (item.policy === 'NON_STOCK')
      return {
        policy: item.policy,
        known: true,
        quantity: null,
        status: 'INVENTORY_NOT_REQUIRED',
        lowStock: false,
      };
    const locations = await tx.inventoryLocation.count({
        where: { ...ownership(ctx), active: true },
      }),
      known =
        locations > 0 &&
        item.balances.length === locations &&
        item.balances.every((b) => b.known);
    const quantity = known
      ? item.balances.reduce((n, b) => n + b.onHand, 0)
      : null;
    return {
      policy: item.policy,
      known,
      quantity,
      status: !known ? 'UNKNOWN' : quantity! > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      lowStock:
        known &&
        item.lowStockThreshold !== null &&
        quantity! <= item.lowStockThreshold,
    };
  }
}
