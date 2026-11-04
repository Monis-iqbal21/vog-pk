import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Req,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import type { AdminRequest } from '../security/guards.js';
import { ScopedAccess } from '../security/scoped.controller.js';
import { validId, validate } from '../security/validation.js';
import { PricingService } from './pricing.service.js';
import { InventoryService } from './inventory.service.js';
import { MediaService } from './media.service.js';
import { PresentationService } from './presentation.service.js';
import * as v from './validation.js';
@Controller('admin/stores/:storeId/operations')
@ScopedAccess()
export class OperationsController {
  constructor(
    @Inject(PricingService) readonly pricing: PricingService,
    @Inject(InventoryService) readonly inventory: InventoryService,
    @Inject(PresentationService) readonly presentation: PresentationService,
  ) {}
  @Get('skus/:sku/quote') async quote(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') id: string,
  ) {
    const storeId = validId(s),
      skuId = validId(id),
      ctx = await this.pricing.access.context(
        r.identity.id,
        storeId,
        'pricing.view',
      );
    await this.pricing.access.auth.require(r.identity.id, ctx, [
      'inventory.view',
    ]);
    await this.pricing.access.sku(this.pricing.access.db, ctx, skuId);
    const listing = await this.pricing.access.db.listingSKU.findFirst({
      where: {
        tenantId: ctx.tenantId,
        skuRevision: {
          skuId,
          state: 'ACTIVE',
          sku: { archived: false, product: { archived: false } },
        },
        revision: {
          storeId,
          status: 'PUBLISHED',
          visible: true,
          sellingMode: 'RETAIL',
          listing: { archived: false },
        },
      },
      select: { listingRevisionId: true },
    });
    const offer = listing
        ? await this.pricing.offer(this.pricing.access.db, ctx, skuId)
        : null,
      inventory = await this.inventory.summary(
        this.pricing.access.db,
        ctx,
        skuId,
      );
    return {
      skuId,
      offer,
      inventory,
      offerEligible: !!offer,
      inventoryEligible:
        inventory.status === 'INVENTORY_NOT_REQUIRED' ||
        (inventory.known &&
          inventory.quantity !== null &&
          inventory.quantity > 0),
      purchasable: false,
      checkout: 'DISABLED',
      reason: !listing
        ? 'NO_PUBLISHED_RETAIL_LISTING'
        : !offer
          ? 'NO_CURRENT_APPROVED_OFFER'
          : 'CHECKOUT_DISABLED',
    };
  }
  @Get('settings') settings(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
  ) {
    return this.pricing.settings(r.identity.id, validId(s));
  }
  @Patch('settings') configure(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Body() b: unknown,
  ) {
    return this.pricing.configure(
      r.identity.id,
      validId(s),
      validate(v.settings, b),
    );
  }
  @Get('skus/:sku/prices') prices(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Query() q: unknown,
  ) {
    return this.pricing.read(
      r.identity.id,
      validId(s),
      validId(sku),
      validate(v.page, q),
    );
  }
  @Post('skus/:sku/prices') propose(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Body() b: unknown,
  ) {
    return this.pricing.propose(
      r.identity.id,
      validId(s),
      validId(sku),
      validate(v.price, b),
    );
  }
  @Patch('skus/:sku/prices/:id') save(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.pricing.save(
      r.identity.id,
      validId(s),
      validId(sku),
      validId(id),
      validate(v.priceSave, b),
    );
  }
  @Post('skus/:sku/prices/:id/actions/:action') priceAction(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Param('id') id: string,
    @Param('action') a: string,
    @Body() b: unknown,
  ) {
    return this.pricing.action(
      r.identity.id,
      validId(s),
      validId(sku),
      validId(id),
      validate(v.action, a),
      validate(v.lifecycle, b),
    );
  }
  @Get('locations') locations(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
  ) {
    return this.inventory.locations(r.identity.id, validId(s));
  }
  @Post('locations') location(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Body() b: unknown,
  ) {
    return this.inventory.location(
      r.identity.id,
      validId(s),
      validate(v.location, b),
    );
  }
  @Get('skus/:sku/inventory') stock(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
  ) {
    return this.inventory.read(r.identity.id, validId(s), validId(sku));
  }
  @Patch('skus/:sku/inventory') policy(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Body() b: unknown,
  ) {
    return this.inventory.configure(
      r.identity.id,
      validId(s),
      validId(sku),
      validate(v.policy, b),
    );
  }
  @Post('skus/:sku/inventory/adjustments') adjust(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Body() b: unknown,
  ) {
    return this.inventory.adjust(
      r.identity.id,
      validId(s),
      validId(sku),
      validate(v.adjustment, b),
    );
  }
  @Get('skus/:sku/inventory/history') history(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('sku') sku: string,
    @Query() q: unknown,
  ) {
    return this.inventory.history(
      r.identity.id,
      validId(s),
      validId(sku),
      validate(v.page, q),
    );
  }
  @Get('listings/:listing/revisions/:id/media') listingMedia(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('listing') l: string,
    @Param('id') id: string,
  ) {
    return this.presentation.read(
      r.identity.id,
      validId(s),
      validId(l),
      validId(id),
    );
  }
  @Patch('listings/:listing/revisions/:id/media') assignListing(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('listing') l: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.presentation.assign(
      r.identity.id,
      validId(s),
      validId(l),
      validId(id),
      validate(v.listingAssignments, b),
    );
  }
  @Get('listings/:listing/revisions/:id/media/:asset/content') listingContent(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('listing') l: string,
    @Param('id') id: string,
    @Param('asset') a: string,
    @Query() q: unknown,
  ) {
    return this.presentation.content(
      r.identity.id,
      validId(s),
      validId(l),
      validId(id),
      validId(a),
      validate(v.thumbnail, q).width,
    );
  }
}
@Controller('admin/scopes/tenants/:tenantId/media')
@ScopedAccess()
export class MediaController {
  constructor(@Inject(MediaService) readonly media: MediaService) {}
  @Get('assets') assets(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Query() q: unknown,
  ) {
    return this.media.list(r.identity.id, validId(t), validate(v.page, q));
  }
  @Post('uploads') upload(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Body() b: unknown,
  ) {
    return this.media.upload(r.identity.id, validId(t), validate(v.upload, b));
  }
  @Patch('assets/:id') metadata(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.media.metadata(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.metadata, b),
    );
  }
  @Post('assets/:id/approve') approve(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.media.approve(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.approveMedia, b),
    );
  }
  @Post('assets/:id/archive') archive(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.media.archive(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.lifecycle, b).revision,
    );
  }
  @Post('assets/:id/reject') reject(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.media.reject(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.rejectMedia, b),
    );
  }
  @Get('assets/:id/review') review(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
  ) {
    return this.media.review(r.identity.id, validId(t), validId(id));
  }
  @Get('assets/:id/content') content(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Query() q: unknown,
  ) {
    return this.media.content(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.thumbnail, q).width,
    );
  }
  @Get('products/:product/revisions/:id/assignments') references(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('product') p: string,
    @Param('id') id: string,
  ) {
    return this.media.assignments(
      r.identity.id,
      validId(t),
      validId(p),
      validId(id),
    );
  }
  @Patch('products/:product/revisions/:id/assignments') assignShared(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('product') p: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.media.assign(
      r.identity.id,
      validId(t),
      validId(p),
      validId(id),
      undefined,
      validate(v.assignments, b),
    );
  }
  @Patch('products/:product/revisions/:id/skus/:sku/assignments') assignSku(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('product') p: string,
    @Param('id') id: string,
    @Param('sku') sku: string,
    @Body() b: unknown,
  ) {
    return this.media.assign(
      r.identity.id,
      validId(t),
      validId(p),
      validId(id),
      validId(sku),
      validate(v.assignments, b),
    );
  }
}
