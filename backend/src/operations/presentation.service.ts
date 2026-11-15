import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OperationsAccess } from './access.js';
import { MediaService } from './media.service.js';
import { ownership, json, stale } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
import * as v from './validation.js';
import type { z } from 'zod';
const graph = {
  media: {
    include: {
      productMedia: { include: { asset: true } },
      skuMedia: { include: { asset: true } },
    },
    orderBy: [{ purpose: 'asc' as const }, { sortOrder: 'asc' as const }],
  },
  skus: true,
  productRevision: {
    include: {
      media: { include: { asset: true } },
      skus: { include: { sku: true, media: { include: { asset: true } } } },
    },
  },
};
@Injectable()
export class PresentationService {
  constructor(
    @Inject(OperationsAccess) readonly access: OperationsAccess,
    @Inject(MediaService) readonly media: MediaService,
  ) {}
  async read(actor: string, storeId: string, listingId: string, id: string) {
    const ctx = await this.access.context(actor, storeId, 'listing-media.view');
    const row = await this.access.db.listingRevision.findFirst({
      where: { id, listingId, ...ownership(ctx) },
      include: graph,
    });
    if (!row) throw new NotFoundException('Listing presentation not found.');
    return row;
  }
  async content(
    actor: string,
    storeId: string,
    listingId: string,
    id: string,
    assetId: string,
    width: number,
  ) {
    const row = await this.read(actor, storeId, listingId, id);
    const sources = [
      ...row.productRevision.media,
      ...row.productRevision.skus.flatMap((s) => s.media),
    ];
    const source = sources.find((s) => s.assetId === assetId);
    if (!source) fail('Media is outside this pinned listing presentation.');
    const bytes = await this.media.storage.read(row.tenantId, assetId, width);
    return {
      assetId,
      width,
      mimeType: 'image/webp',
      dataUrl: `data:image/webp;base64,${bytes.toString('base64')}`,
      private: true,
    };
  }
  assign(
    actor: string,
    storeId: string,
    listingId: string,
    id: string,
    input: z.infer<typeof v.listingAssignments>,
  ) {
    return this.access.write(
      actor,
      storeId,
      'listing-media.manage',
      async (tx, ctx) => {
        await this.access.auth.require(actor, ctx, ['listings.update'], tx);
        const row = await tx.listingRevision.findFirst({
          where: {
            id,
            listingId,
            ...ownership(ctx),
            listing: { archived: false },
          },
          include: graph,
        });
        if (!row) throw new NotFoundException('Listing revision not found.');
        if (row.revision !== input.revision) stale();
        if (row.status !== 'DRAFT')
          throw new ConflictException(
            'Clone listing presentation before editing it.',
          );
        for (const ref of input.references) {
          const source = ref.productMediaId
            ? row.productRevision.media.find((m) => m.id === ref.productMediaId)
            : row.productRevision.skus
                .filter((s) =>
                  row.skus.some((pin) => pin.skuRevisionId === s.id),
                )
                .flatMap((s) => s.media)
                .find((m) => m.id === ref.skuMediaId);
          if (
            !source ||
            source.purpose !== ref.purpose ||
            source.asset.archived
          )
            fail(
              'Presentation source must match its purpose and exact approved product/SKU pin.',
            );
        }
        await tx.listingRevisionMedia.deleteMany({
          where: { listingRevisionId: id, ...ownership(ctx) },
        });
        const orders = new Map<string, number>();
        for (const ref of input.references) {
          const sortOrder = orders.get(ref.purpose) ?? 0;
          orders.set(ref.purpose, sortOrder + 1);
          await tx.listingRevisionMedia.create({
            data: {
              ...ownership(ctx),
              listingRevisionId: id,
              productId: row.productId,
              productRevisionId: row.productRevisionId,
              productMediaId: ref.productMediaId,
              skuMediaId: ref.skuMediaId,
              purpose: ref.purpose,
              sortOrder,
              altText: ref.altText,
              caption: ref.caption,
              visible: ref.visible,
              presentation: json(ref.presentation),
            },
          });
        }
        await tx.listingRevision.update({
          where: { id },
          data: { revision: { increment: 1 }, updatedBy: actor },
        });
        await this.access.audit(
          tx,
          actor,
          ctx,
          'listing_presentation_saved',
          id,
        );
        return { revision: row.revision + 1 };
      },
    );
  }
}
