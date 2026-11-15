import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { OperationsAccess } from './access.js';
import type { z } from 'zod';
import * as v from './validation.js';

@Injectable()
export class CheckoutSettingsService {
  constructor(@Inject(OperationsAccess) readonly access: OperationsAccess) {}

  async read(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'settings.view');
    const row = await this.access.db.storeCheckoutSettings.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } });
    return { revision: row?.revision ?? 0, codEnabled: row?.codEnabled ?? false, cardEnabled: false, cardAvailable: false, cardReason: 'A verified payment gateway is not configured.' };
  }

  update(actor: string, storeId: string, input: z.infer<typeof v.checkoutSettings>) {
    if (input.cardEnabled) throw new ConflictException('Card payment cannot be enabled without a verified payment gateway.');
    return this.access.write(actor, storeId, 'settings.manage', async (tx, ctx) => {
      const current = await tx.storeCheckoutSettings.findFirst({ where: { storeId: ctx.storeId, tenantId: ctx.tenantId } });
      if ((current?.revision ?? 0) !== input.expectedRevision)
        throw new ConflictException('Checkout settings changed. Reload and try again.');
      const result = current
        ? await tx.storeCheckoutSettings.update({ where: { id: current.id }, data: { codEnabled: input.codEnabled, cardEnabled: false, revision: { increment: 1 }, updatedBy: actor } })
        : await tx.storeCheckoutSettings.create({ data: { tenantId: ctx.tenantId, storeId: ctx.storeId, codEnabled: input.codEnabled, cardEnabled: false, revision: 1, updatedBy: actor } });
      await this.access.audit(tx, actor, ctx, 'checkout_settings_updated', result.id);
      return { revision: result.revision, codEnabled: result.codEnabled, cardEnabled: false, cardAvailable: false, cardReason: 'A verified payment gateway is not configured.' };
    });
  }
}
