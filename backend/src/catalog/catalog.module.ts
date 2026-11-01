import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { CatalogController, ListingsController } from './catalog.controller.js';
import { ProductsService } from './products.service.js';
import { ListingsService } from './listings.service.js';
@Module({
  imports: [CategoriesModule],
  controllers: [CatalogController, ListingsController],
  providers: [ProductsService, ListingsService],
})
export class CatalogModule {}
