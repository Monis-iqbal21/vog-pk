import { Module } from '@nestjs/common';
import { OperationsAccess } from './access.js';
import { PricingService } from './pricing.service.js';
import { InventoryService } from './inventory.service.js';
import { LocalMediaStorage } from './storage.js';
import { MediaService } from './media.service.js';
import { PresentationService } from './presentation.service.js';
import {
  OperationsController,
  MediaController,
} from './operations.controller.js';
@Module({
  providers: [
    OperationsAccess,
    PricingService,
    InventoryService,
    LocalMediaStorage,
    MediaService,
    PresentationService,
  ],
  controllers: [OperationsController, MediaController],
  exports: [PricingService, InventoryService],
})
export class OperationsModule {}
