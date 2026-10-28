import {Body,Controller,Get,Inject,Param,Patch,Post,Req} from '@nestjs/common';
import {AuthService} from './auth.service.js';
import {Public,RequirePermissions,SessionOnly} from './guards.js';
import type {AdminRequest} from './guards.js';
import {DatabaseService} from './database.js';
import {StaffService} from './staff.service.js';
import {createStaffSchema,loginSchema,updateStaffSchema,validate,validId} from './validation.js';
@Controller('admin')
export class AdminController {
 constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(DatabaseService) private readonly db:DatabaseService,@Inject(StaffService) private readonly staff:StaffService){}
 @Post('auth/login') @Public()
 login(@Body() body:unknown,@Req() request:AdminRequest){const input=validate(loginSchema,body);return this.auth.login(input.email,input.password,(request.get('x-admin-client-ip')??'unknown').slice(0,128));}
 @Get('auth/me') @SessionOnly()
 me(@Req() request:AdminRequest){return request.identity;}
 @Post('auth/logout') @SessionOnly()
 async logout(@Req() request:AdminRequest){await this.auth.logout(request.sessionId,request.identity.id);return {ok:true};}
 @Get('roles') @RequirePermissions('roles.view')
 roles(){return this.db.role.findMany({select:{id:true,code:true,name:true,description:true,system:true,permissions:{select:{permission:{select:{code:true}}}}},orderBy:{code:'asc'}});}
 @Get('permissions') @RequirePermissions('roles.view')
 permissions(){return this.db.permission.findMany({select:{code:true,description:true},orderBy:{code:'asc'}});}
 @Get('staff') @RequirePermissions('staff.view')
 list(){return this.staff.list();}
 @Post('staff') @RequirePermissions('staff.manage','roles.manage')
 create(@Body() body:unknown,@Req() request:AdminRequest){return this.staff.create(request.identity.id,validate(createStaffSchema,body));}
 @Patch('staff/:id') @RequirePermissions('staff.manage','roles.manage')
 update(@Param('id') id:string,@Body() body:unknown,@Req() request:AdminRequest){return this.staff.update(request.identity.id,validId(id),validate(updateStaffSchema,body));}
 @Get('audit-logs') @RequirePermissions('audit.view')
 audit(){return this.db.auditLog.findMany({take:100,orderBy:{createdAt:'desc'},select:{id:true,action:true,resource:true,resourceId:true,createdAt:true,metadata:true,actor:{select:{id:true,name:true}}}});}
}
