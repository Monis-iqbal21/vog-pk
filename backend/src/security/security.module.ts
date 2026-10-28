import {Global,Module} from '@nestjs/common';
import {APP_GUARD} from '@nestjs/core';
import {AuthService} from './auth.service.js';
import {DatabaseService} from './database.js';
import {StaffService} from './staff.service.js';
import {SecurityGuard} from './guards.js';
import {AdminController} from './admin.controller.js';
@Global()
@Module({providers:[DatabaseService,AuthService,StaffService,{provide:APP_GUARD,useClass:SecurityGuard}],controllers:[AdminController],exports:[DatabaseService,AuthService,StaffService]})
export class SecurityModule {}
