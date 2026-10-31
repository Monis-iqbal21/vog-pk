import { Module } from '@nestjs/common';
import { ProductTypesController } from './product-types.controller.js';
import { ProductTypesService } from './product-types.service.js';
import { SchemaUsageService } from './impact.service.js';

@Module({
  controllers: [ProductTypesController],
  providers: [ProductTypesService, SchemaUsageService],
})
export class ProductTypesModule {}
