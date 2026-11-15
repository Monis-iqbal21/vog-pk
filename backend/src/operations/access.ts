import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../security/database.js';
import { ScopedAuthorizationService } from '../security/scoped-authorization.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
@Injectable()
export class OperationsAccess {
  constructor(
    @Inject(DatabaseService) readonly db: DatabaseService,
    @Inject(ScopedAuthorizationService)
    readonly auth: ScopedAuthorizationService,
  ) {}
  async context(
    actor: string,
    storeId: string,
    permission: string,
    tx: ScopeTransaction = this.db,
  ) {
    const ctx = await this.auth.storeContext(actor, storeId, tx);
    await this.auth.require(actor, ctx, [permission], tx);
    return ctx;
  }
  async sku(
    tx: ScopeTransaction,
    ctx: StoreContext,
    skuId: string,
    active = false,
  ) {
    const sku = await tx.sKU.findFirst({
      where: { id: skuId, tenantId: ctx.tenantId },
      include: { product: true },
    });
    if (!sku || (active && (sku.archived || sku.product.archived)))
      fail('Choose an active SKU belonging to this store tenant.');
    return sku;
  }
  async write<T>(
    actor: string,
    storeId: string,
    permission: string,
    fn: (tx: ScopeTransaction, ctx: StoreContext) => Promise<T>,
  ) {
    try {
      return await this.auth.write(async (tx) =>
        fn(tx, await this.context(actor, storeId, permission, tx)),
      );
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2034')
        throw new ConflictException(
          'Concurrent operation changed. Reload and retry with the same idempotency key.',
        );
      if (
        e instanceof ConflictException &&
        e.message === 'A role with that code already exists.'
      )
        throw new ConflictException(
          'An operational identity or idempotency key already exists.',
        );
      throw e;
    }
  }
  audit(
    tx: ScopeTransaction,
    actor: string,
    ctx: StoreContext,
    action: string,
    id: string,
  ) {
    return this.auth.audit(tx, actor, ctx, 'operations.' + action, id);
  }
}
