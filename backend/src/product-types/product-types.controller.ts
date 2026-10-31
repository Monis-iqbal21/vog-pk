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
import { ProductTypesService } from './product-types.service.js';
import * as v from './validation.js';

@Controller('admin/scopes/tenants/:tenantId/schema')
@ScopedAccess()
export class ProductTypesController {
  constructor(
    @Inject(ProductTypesService) private readonly service: ProductTypesService,
  ) {}
  @Get('product-types/:typeId/versions')
  versions(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Query() query: unknown,
  ) {
    return this.service.versions(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validate(v.paginationInput, query),
    );
  }
  @Get('registry') registry(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
  ) {
    return this.service.registry(req.identity.id, validId(tenant));
  }
  @Get('attributes') attributes(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Query() query: unknown,
  ) {
    return this.service.list(
      req.identity.id,
      validId(tenant),
      'attributes',
      validate(v.listInput, query),
    );
  }
  @Post('attributes') createAttribute(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Body() body: unknown,
  ) {
    return this.service.createAttribute(
      req.identity.id,
      validId(tenant),
      validate(v.attributeInput, body),
    );
  }
  @Patch('attributes/:id') updateAttribute(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateAttribute(
      req.identity.id,
      validId(tenant),
      validId(id),
      validate(v.attributeUpdate, body),
    );
  }
  @Get('option-sets') options(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Query() query: unknown,
  ) {
    return this.service.list(
      req.identity.id,
      validId(tenant),
      'option-sets',
      validate(v.listInput, query),
    );
  }
  @Get('option-sets/:id') option(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('id') id: string,
  ) {
    return this.service.optionSet(
      req.identity.id,
      validId(tenant),
      validId(id),
    );
  }
  @Post('option-sets') createOptions(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Body() body: unknown,
  ) {
    return this.service.createOptionSet(
      req.identity.id,
      validId(tenant),
      validate(v.optionInput, body),
    );
  }
  @Patch('option-sets/:id') updateOptions(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateOptionSet(
      req.identity.id,
      validId(tenant),
      validId(id),
      validate(v.optionUpdate, body),
    );
  }
  @Get('product-types') types(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Query() query: unknown,
  ) {
    return this.service.list(
      req.identity.id,
      validId(tenant),
      'product-types',
      validate(v.listInput, query),
    );
  }
  @Post('product-types') createType(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Body() body: unknown,
  ) {
    return this.service.createType(
      req.identity.id,
      validId(tenant),
      validate(v.typeInput, body),
    );
  }
  @Get('product-types/:typeId/versions/:id') version(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Param('id') id: string,
  ) {
    return this.service.version(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validId(id),
    );
  }
  @Get('product-types/:typeId/versions/:id/impact') impact(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Param('id') id: string,
  ) {
    return this.service.compare(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validId(id),
    );
  }
  @Patch('product-types/:typeId/versions/:id') saveDraft(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.saveDraft(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validId(id),
      validate(v.draftInput, body),
    );
  }
  @Post('product-types/:typeId/versions/:id/clone') clone(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.clone(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validId(id),
      validate(v.transitionInput, body).revision,
    );
  }
  @Post('product-types/:typeId/versions/:id/actions/:action') transition(
    @Req() req: AdminRequest,
    @Param('tenantId') tenant: string,
    @Param('typeId') typeId: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ) {
    if (!['review', 'draft', 'approve', 'activate', 'archive'].includes(action))
      v.fail('Unknown schema action.');
    return this.service.transition(
      req.identity.id,
      validId(tenant),
      validId(typeId),
      validId(id),
      action as 'review' | 'draft' | 'approve' | 'activate' | 'archive',
      validate(v.transitionInput, body),
    );
  }
}
