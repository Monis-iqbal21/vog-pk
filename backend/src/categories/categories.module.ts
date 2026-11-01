import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoryService } from './category.service.js';
import { CategoryFiltersService } from './filters.service.js';
import { CategoryUsageService } from './usage.service.js';
@Module({
  controllers: [CategoriesController],
  providers: [CategoryService, CategoryFiltersService, CategoryUsageService],
  exports: [CategoryService],
})
export class CategoriesModule {}
