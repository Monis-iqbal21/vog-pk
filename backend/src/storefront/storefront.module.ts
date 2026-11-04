import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { LocalMediaStorage } from '../operations/storage.js';
import { StorefrontService } from './storefront.service.js';
import { StorefrontController } from './storefront.controller.js';
@Module({
  imports: [CategoriesModule],
  providers: [StorefrontService, LocalMediaStorage],
  controllers: [StorefrontController],
})
export class StorefrontModule {}
