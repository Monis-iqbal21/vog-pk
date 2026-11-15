import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OperationsAccess } from './access.js';
import { ownership, stale } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import type { StoreContext } from '../categories/category.service.js';
import { validatePrice, currentOffer, currencyPrecision } from './money.js';
import * as v from './validation.js';
import type { z } from 'zod';
const graph = {
  promotions: { orderBy: { startsAt: 'asc' as const } },
  approvals: true,
};
@Injectable()
export class PricingService {
  constructor(@Inject(OperationsAccess) readonly access: OperationsAccess) {}
  async settings(actor: string, storeId: string) {
    const ctx = await this.access.context(actor, storeId, 'pricing.view');
    return this.access.db.store.findFirstOrThrow({
      where: { id: ctx.storeId, tenantId: ctx.tenantId },
      select: { currency: true, timeZone: true },
    });
  }
  configure(actor: string, storeId: string, input: z.infer<typeof v.settings>) {
    return this.access.write(
      actor,
      storeId,
      'pricing.configure',
      async (tx, ctx) => {
        currencyPrecision(input.currency);
        try {
          new Intl.DateTimeFormat('en', { timeZone: input.timeZone });
        } catch {
          fail('Choose an IANA timezone.');
        }
        const store = await tx.store.findUniqueOrThrow({
          where: { id: storeId },
        });
        if (
          store.currency !== input.expectedCurrency ||
          store.timeZone !== input.expectedTimeZone
        )
          stale();
        if (
          store.currency !== input.currency &&
          (await tx.storePrice.count({
            where: { ...ownership(ctx), publishedRevisionId: { not: null } },
          }))
        )
          throw new ConflictException(
            'Archive published offers before changing the store currency.',
          );
        await tx.store.update({
          where: { id: storeId },
          data: { currency: input.currency, timeZone: input.timeZone },
        });
        await this.access.audit(tx, actor, ctx, 'currency_configured', storeId);
        return { currency: input.currency, timeZone: input.timeZone };
      },
    );
  }
  async row(
    tx: ScopeTransaction,
    ctx: StoreContext,
    skuId: string,
    id: string,
  ) {
    const row = await tx.priceRevision.findFirst({
      where: { id, ...ownership(ctx), price: { skuId } },
      include: { ...graph, price: true },
    });
    if (!row) throw new NotFoundException('Price revision not found.');
    return row;
  }
  async read(
    actor: string,
    storeId: string,
    skuId: string,
    q: z.infer<typeof v.page>,
  ) {
    const ctx = await this.access.context(actor, storeId, 'pricing.view');
    await this.access.sku(this.access.db, ctx, skuId);
    const root = await this.access.db.storePrice.findUnique({
      where: { storeId_skuId: { storeId, skuId } },
      include: { published: { include: graph } },
    });
    const where = { ...ownership(ctx), price: { skuId } };
    return {
      root,
      items: await this.access.db.priceRevision.findMany({
        where,
        include: graph,
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
        orderBy: { number: 'desc' },
      }),
      total: await this.access.db.priceRevision.count({ where }),
      effectiveOffer: currentOffer(root?.published ?? null),
      currency: (
        await this.access.db.store.findUniqueOrThrow({ where: { id: storeId } })
      ).currency,
      purchasable: false,
    };
  }
  propose(
    actor: string,
    storeId: string,
    skuId: string,
    input: z.infer<typeof v.price>,
  ) {
    return this.access.write(
      actor,
      storeId,
      'pricing.propose',
      async (tx, ctx) => {
        const sku = await this.access.sku(tx, ctx, skuId, true),
          data = validatePrice(input),
          store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
        if (data.currency !== store.currency)
          fail('Offer currency must match the configured store currency.');
        const root = await tx.storePrice.upsert({
          where: { storeId_skuId: { storeId, skuId } },
          create: { ...ownership(ctx), skuId, productId: sku.productId },
          update: {},
        });
        const last = await tx.priceRevision.findFirst({
          where: { priceId: root.id, ...ownership(ctx) },
          orderBy: { number: 'desc' },
        });
        const { promotions, ...fields } = data;
        const row = await tx.priceRevision.create({
          data: {
            ...fields,
            ...ownership(ctx),
            priceId: root.id,
            number: (last?.number ?? 0) + 1,
            createdBy: actor,
          },
        });
        if (promotions.length)
          await tx.pricePromotion.createMany({
            data: promotions.map((p) => ({
              ...p,
              ...ownership(ctx),
              priceRevisionId: row.id,
            })),
          });
        await this.access.audit(tx, actor, ctx, 'price_proposed', row.id);
        return {
          ...(await this.row(tx, ctx, skuId, row.id)),
          rootRevision: root.revision,
        };
      },
    );
  }
  save(
    actor: string,
    storeId: string,
    skuId: string,
    id: string,
    input: z.infer<typeof v.priceSave>,
  ) {
    return this.access.write(
      actor,
      storeId,
      'pricing.propose',
      async (tx, ctx) => {
        const row = await this.row(tx, ctx, skuId, id);
        if (row.revision !== input.revision) stale();
        if (row.status !== 'DRAFT')
          throw new ConflictException('Only price drafts may change.');
        const data = validatePrice(input),
          store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
        if (input.currency !== store.currency)
          fail('Offer currency must match this store.');
        await tx.pricePromotion.deleteMany({
          where: { priceRevisionId: id, ...ownership(ctx) },
        });
        const { promotions, ...fields } = data;
        await tx.priceRevision.update({
          where: { id },
          data: { ...fields, revision: { increment: 1 } },
        });
        if (promotions.length)
          await tx.pricePromotion.createMany({
            data: promotions.map((p) => ({
              ...p,
              ...ownership(ctx),
              priceRevisionId: id,
            })),
          });
        await this.access.audit(tx, actor, ctx, 'price_draft_saved', id);
        return {
          ...(await this.row(tx, ctx, skuId, id)),
          rootRevision: row.price.revision,
        };
      },
    );
  }
  action(
    actor: string,
    storeId: string,
    skuId: string,
    id: string,
    action: z.infer<typeof v.action>,
    input: z.infer<typeof v.lifecycle>,
  ) {
    return this.access.write(
      actor,
      storeId,
      action === 'approve'
        ? 'pricing.approve'
        : action === 'publish'
          ? 'pricing.publish'
          : action === 'archive'
            ? 'pricing.archive'
            : 'pricing.propose',
      async (tx, ctx) => {
        const row = await this.row(tx, ctx, skuId, id);
        if (row.revision !== input.revision) stale();
        const states = {
          review: ['DRAFT'],
          draft: ['IN_REVIEW'],
          approve: ['IN_REVIEW'],
          publish: ['APPROVED'],
          archive: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'],
        };
        if (!states[action].includes(row.status))
          throw new ConflictException('Invalid price lifecycle transition.');
        const store = await tx.store.findUniqueOrThrow({
          where: { id: storeId },
        });
        if (['review', 'approve', 'publish'].includes(action)) {
          await this.access.sku(tx, ctx, skuId, true);
          if (row.currency !== store.currency)
            fail('Store currency changed; propose a current offer.');
          validatePrice({
            currency: row.currency,
            regularAmount: row.regularAmount.toString(),
            validFrom: row.validFrom?.toISOString() ?? null,
            validUntil: row.validUntil?.toISOString() ?? null,
            promotions: row.promotions.map((p) => ({
              ...p,
              amount: p.amount.toString(),
              startsAt: p.startsAt.toISOString(),
              endsAt: p.endsAt.toISOString(),
            })),
          });
          if (row.validUntil && row.validUntil <= new Date())
            fail('An expired offer cannot be approved or published.');
        }
        if (
          action === 'publish' ||
          (action === 'archive' && row.price.publishedRevisionId === id)
        ) {
          if (input.rootRevision !== row.price.revision) stale();
          if (action === 'publish' && row.price.publishedRevisionId)
            await tx.priceRevision.update({
              where: { id: row.price.publishedRevisionId },
              data: { status: 'ARCHIVED', revision: { increment: 1 } },
            });
          await tx.storePrice.update({
            where: { id: row.priceId },
            data: {
              publishedRevisionId: action === 'publish' ? id : null,
              revision: { increment: 1 },
            },
          });
        }
        if (action === 'approve')
          await tx.priceApproval.create({
            data: {
              ...ownership(ctx),
              priceRevisionId: id,
              approvedRevision: row.revision + 1,
              actorId: actor,
              contentHash: createHash('sha256')
                .update(
                  JSON.stringify({
                    currency: row.currency,
                    amount: row.regularAmount,
                    from: row.validFrom,
                    until: row.validUntil,
                    promotions: row.promotions,
                  }),
                )
                .digest('hex'),
            },
          });
        await tx.priceRevision.update({
          where: { id },
          data: {
            status: (
              {
                review: 'IN_REVIEW',
                draft: 'DRAFT',
                approve: 'APPROVED',
                publish: 'PUBLISHED',
                archive: 'ARCHIVED',
              } as const
            )[action],
            revision: { increment: 1 },
            ...(action === 'approve'
              ? { approvedBy: actor, approvedAt: new Date() }
              : {}),
            ...(action === 'publish'
              ? { publishedBy: actor, publishedAt: new Date() }
              : {}),
          },
        });
        await this.access.audit(tx, actor, ctx, 'price_' + action, id);
        return {
          ...(await this.row(tx, ctx, skuId, id)),
          rootRevision: (
            await tx.storePrice.findUniqueOrThrow({
              where: { id: row.priceId },
            })
          ).revision,
        };
      },
    );
  }
  async offer(
    tx: ScopeTransaction,
    ctx: StoreContext,
    skuId: string,
    now = new Date(),
  ) {
    const root = await tx.storePrice.findUnique({
      where: { storeId_skuId: { storeId: ctx.storeId, skuId } },
      include: { published: { include: graph } },
    });
    return currentOffer(root?.published ?? null, now);
  }
}
