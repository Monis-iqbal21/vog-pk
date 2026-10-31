import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import {SecurityModule} from './security/security.module.js';
import {ReadinessController} from './readiness.controller.js';
import {ProductTypesModule} from './product-types/product-types.module.js';
@Module({ imports:[SecurityModule,ProductTypesModule],controllers: [AppController,ReadinessController] })
export class AppModule {}
