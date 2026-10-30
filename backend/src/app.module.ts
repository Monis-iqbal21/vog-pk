import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import {SecurityModule} from './security/security.module.js';
import {ReadinessController} from './readiness.controller.js';
@Module({ imports:[SecurityModule],controllers: [AppController,ReadinessController] })
export class AppModule {}
