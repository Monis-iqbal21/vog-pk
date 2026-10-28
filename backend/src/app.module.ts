import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import {SecurityModule} from './security/security.module.js';
@Module({ imports:[SecurityModule],controllers: [AppController] })
export class AppModule {}
