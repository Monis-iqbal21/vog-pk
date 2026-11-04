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
import { fail } from '../product-types/validation.js';
import { CategoryService } from './category.service.js';
import { CategoryFiltersService } from './filters.service.js';
import * as v from './validation.js';
import { z } from 'zod';
type Action = 'review' | 'draft' | 'approve' | 'activate' | 'archive';
const action = (name: string): Action => {
  if (!['review', 'draft', 'approve', 'activate', 'archive'].includes(name))
    fail('Unknown lifecycle action.');
  return name as Action;
};
@Controller('admin/stores/:storeId')
@ScopedAccess()
export class CategoriesController {
  constructor(
    @Inject(CategoryService) private readonly categories: CategoryService,
    @Inject(CategoryFiltersService)
    private readonly filters: CategoryFiltersService,
  ) {}
  @Get('categories') list(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Query() query: unknown,
  ) {
    return this.categories.list(
      r.identity.id,
      validId(store),
      validate(v.categoryList, query),
    );
  }
  @Get('categories/tree') tree(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Query() query: unknown,
  ) {
    return this.categories.tree(
      r.identity.id,
      validId(store),
      validate(v.treeInput, query),
    );
  }
  @Get('categories/:id') getCategory(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
  ) {
    return this.categories.get(r.identity.id, validId(store), validId(id));
  }
  @Post('categories') create(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Body() body: unknown,
  ) {
    return this.categories.create(
      r.identity.id,
      validId(store),
      validate(v.categoryInput, body),
    );
  }
  @Patch('categories/:id') update(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.categories.update(
      r.identity.id,
      validId(store),
      validId(id),
      validate(v.categoryUpdate, body),
    );
  }
  @Post('categories/:id/move') move(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.categories.move(
      r.identity.id,
      validId(store),
      validId(id),
      validate(v.moveInput, body),
    );
  }
  @Get('categories/:id/impact') impact(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
  ) {
    return this.categories.impact(r.identity.id, validId(store), validId(id));
  }
  @Post('categories/:id/actions/:action') transition(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('action') name: string,
    @Body() body: unknown,
  ) {
    return this.categories.transition(
      r.identity.id,
      validId(store),
      validId(id),
      action(name),
      validate(v.transition, body).revision,
    );
  }
  @Get('filter-registry') registry(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
  ) {
    return this.filters.registry(r.identity.id, validId(store));
  }
  @Get('filter-schemas') schemas(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Query() query: unknown,
  ) {
    return this.filters.eligible(
      r.identity.id,
      validId(store),
      validate(v.historyInput, query),
    );
  }
  @Get('categories/:id/filter-sets') history(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.filters.history(
      r.identity.id,
      validId(store),
      validId(id),
      validate(v.historyInput, query),
    );
  }
  @Post('categories/:id/filter-sets') createFilters(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    validate(z.object({}).strict(), body);
    return this.filters.create(r.identity.id, validId(store), validId(id));
  }
  @Get('categories/:id/active-filters') active(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
  ) {
    return this.filters.active(r.identity.id, validId(store), validId(id));
  }
  @Get('categories/:id/filter-sets/:setId') get(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
  ) {
    return this.filters.get(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
    );
  }
  @Patch('categories/:id/filter-sets/:setId') save(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
    @Body() body: unknown,
  ) {
    return this.filters.save(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
      validate(v.filterDraft, body),
    );
  }
  @Get('categories/:id/filter-sets/:setId/impact') filterImpact(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
  ) {
    return this.filters.impact(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
    );
  }
  @Post('categories/:id/filter-sets/:setId/preview') preview(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
    @Body() body: unknown,
  ) {
    return this.filters.preview(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
      validate(v.previewInput, body),
    );
  }
  @Post('categories/:id/filter-sets/:setId/clone') clone(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
    @Body() body: unknown,
  ) {
    return this.filters.clone(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
      validate(v.transition, body).revision,
    );
  }
  @Post('categories/:id/filter-sets/:setId/actions/:action') filterAction(
    @Req() r: AdminRequest,
    @Param('storeId') store: string,
    @Param('id') id: string,
    @Param('setId') set: string,
    @Param('action') name: string,
    @Body() body: unknown,
  ) {
    return this.filters.transition(
      r.identity.id,
      validId(store),
      validId(id),
      validId(set),
      action(name),
      validate(v.transition, body),
    );
  }
}
