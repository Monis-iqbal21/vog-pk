import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AdminRequest } from '../security/guards.js';
import { ScopedAccess } from '../security/scoped.controller.js';
import { validate, validId } from '../security/validation.js';
import { ProductsService } from './products.service.js';
import { ListingsService } from './listings.service.js';
import * as v from './validation.js';
@Controller('admin/scopes/tenants/:tenantId/catalog')
@ScopedAccess()
export class CatalogController {
  constructor(@Inject(ProductsService) readonly products: ProductsService) {}
  @Get('products/:id/revisions') history(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Query() q: unknown,
  ) {
    return this.products.history(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.list, q),
    );
  }
  @Get('schemas') schemas(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Query() q: unknown,
  ) {
    return this.products.schemas(
      r.identity.id,
      validId(t),
      validate(v.list, q),
    );
  }
  @Get('brands') brands(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Query() q: unknown,
  ) {
    return this.products.brands(r.identity.id, validId(t), validate(v.list, q));
  }
  @Post('brands') brand(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Body() b: unknown,
  ) {
    return this.products.brand(r.identity.id, validId(t), validate(v.brand, b));
  }
  @Get('products') list(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Query() q: unknown,
  ) {
    return this.products.list(r.identity.id, validId(t), validate(v.list, q));
  }
  @Post('products') create(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Body() b: unknown,
  ) {
    return this.products.create(
      r.identity.id,
      validId(t),
      validate(v.productCreate, b),
    );
  }
  @Get('products/:id') get(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
  ) {
    return this.products.get(r.identity.id, validId(t), validId(id));
  }
  @Post('products/:id/archive') archive(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.products.archive(
      r.identity.id,
      validId(t),
      validId(id),
      validate(v.archive, b).revision,
    );
  }
  @Get('products/:id/revisions/:rev') revision(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
  ) {
    return this.products.get(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
    );
  }
  @Patch('products/:id/revisions/:rev') save(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Body() b: unknown,
  ) {
    return this.products.save(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
      validate(v.productSave, b),
    );
  }
  @Get('products/:id/revisions/:rev/impact') impact(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
  ) {
    return this.products.compare(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
    );
  }
  @Post('products/:id/revisions/:rev/clone') clone(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Body() b: unknown,
  ) {
    return this.products.clone(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
      validate(v.archive, b).revision,
    );
  }
  @Post('products/:id/revisions/:rev/resolve') resolve(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Body() b: unknown,
  ) {
    return this.products.resolve(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
      validate(v.resolve, b),
    );
  }
  @Post('products/:id/revisions/:rev/actions/:action') action(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Param('action') action: string,
    @Body() b: unknown,
  ) {
    return this.products.transition(
      r.identity.id,
      validId(t),
      validId(id),
      validId(rev),
      validate(v.action, action),
      validate(v.lifecycle, b),
    );
  }
  @Post('products/:id/skus/:sku/archive') archiveSku(
    @Req() r: AdminRequest,
    @Param('tenantId') t: string,
    @Param('id') id: string,
    @Param('sku') sku: string,
    @Body() b: unknown,
  ) {
    return this.products.archiveSku(
      r.identity.id,
      validId(t),
      validId(id),
      validId(sku),
      validate(v.archive, b).revision,
    );
  }
}
@Controller('admin/stores/:storeId/listings')
@ScopedAccess()
export class ListingsController {
  constructor(@Inject(ListingsService) readonly listings: ListingsService) {}
  @Get(':id/revisions') history(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Query() q: unknown,
  ) {
    return this.listings.history(
      r.identity.id,
      validId(s),
      validId(id),
      validate(v.list, q),
    );
  }
  @Get('catalog') catalog(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Query() q: unknown,
  ) {
    return this.listings.catalog(
      r.identity.id,
      validId(s),
      validate(v.list, q),
    );
  }
  @Get('categories') categories(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
  ) {
    return this.listings.categoryOptions(r.identity.id, validId(s));
  }
  @Get() list(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Query() q: unknown,
  ) {
    return this.listings.list(r.identity.id, validId(s), validate(v.list, q));
  }
  @Post() create(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Body() b: unknown,
  ) {
    return this.listings.create(
      r.identity.id,
      validId(s),
      validate(v.listingCreate, b),
    );
  }
  @Get(':id') get(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
  ) {
    return this.listings.get(r.identity.id, validId(s), validId(id));
  }
  @Post(':id/archive') archive(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.listings.archive(
      r.identity.id,
      validId(s),
      validId(id),
      validate(v.archive, b).revision,
    );
  }
  @Get(':id/revisions/:rev') revision(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
  ) {
    return this.listings.get(
      r.identity.id,
      validId(s),
      validId(id),
      validId(rev),
    );
  }
  @Patch(':id/revisions/:rev') save(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Body() b: unknown,
  ) {
    return this.listings.save(
      r.identity.id,
      validId(s),
      validId(id),
      validId(rev),
      validate(v.listingSave, b),
    );
  }
  @Get(':id/revisions/:rev/impact') impact(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
  ) {
    return this.listings.compare(
      r.identity.id,
      validId(s),
      validId(id),
      validId(rev),
    );
  }
  @Post(':id/revisions/:rev/clone') clone(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Body() b: unknown,
  ) {
    return this.listings.clone(
      r.identity.id,
      validId(s),
      validId(id),
      validId(rev),
      validate(v.archive, b).revision,
    );
  }
  @Post(':id/revisions/:rev/actions/:action') action(
    @Req() r: AdminRequest,
    @Param('storeId') s: string,
    @Param('id') id: string,
    @Param('rev') rev: string,
    @Param('action') action: string,
    @Body() b: unknown,
  ) {
    return this.listings.transition(
      r.identity.id,
      validId(s),
      validId(id),
      validId(rev),
      validate(v.action, action),
      validate(v.lifecycle, b),
    );
  }
}
