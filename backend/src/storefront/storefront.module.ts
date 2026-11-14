import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { LocalMediaStorage } from '../operations/storage.js';
import { StorefrontService } from './storefront.service.js';
import { StorefrontController } from './storefront.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OperationsModule } from '../operations/operations.module.js';
@Module({
  imports: [CategoriesModule, OperationsModule],
  providers: [StorefrontService, CheckoutService, LocalMediaStorage],
  controllers: [StorefrontController],
  exports: [StorefrontService],
})
export class StorefrontModule {}
