import {CanActivate,ExecutionContext,ForbiddenException,Inject,Injectable,SetMetadata,UnauthorizedException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {timingSafeEqual} from 'node:crypto';
import type {Request} from 'express';
import {AuthService} from './auth.service.js';
import {securityConfig} from './config.js';
import type {AuthIdentity} from './roles.js';
export const Public=()=>SetMetadata('public',true);
export const SessionOnly=()=>SetMetadata('sessionOnly',true);
export const RequirePermissions=(...permissions:string[])=>SetMetadata('permissions',permissions);
export type AdminRequest=Request&{identity:AuthIdentity;sessionId:string};
@Injectable()
export class SecurityGuard implements CanActivate {
 constructor(@Inject(Reflector) private readonly reflector:Reflector,@Inject(AuthService) private readonly auth:AuthService){}
 async canActivate(context:ExecutionContext){
  const request=context.switchToHttp().getRequest<AdminRequest>();
  const targets=[context.getHandler(),context.getClass()],isPublic=this.reflector.getAllAndOverride<boolean>('public',targets);
  const isAdmin=request.path.startsWith('/api/admin/');
  if(!isAdmin){if(isPublic)return true;throw new UnauthorizedException('Authentication required.');}
  const cfg=securityConfig(),provided=request.get('x-admin-bff-key')??'';
  if(Buffer.byteLength(provided)!==Buffer.byteLength(cfg.secret)||!timingSafeEqual(Buffer.from(provided),Buffer.from(cfg.secret)))throw new UnauthorizedException('Authentication required.');
  const origin=request.get('origin');
  if(origin&&origin!==cfg.adminOrigin)throw new ForbiddenException('Origin not allowed.');
  if(isPublic)return true;
  const authorization=request.get('authorization')??'';
  const session=await this.auth.authenticate(authorization.startsWith('Bearer ')?authorization.slice(7):'');
  request.identity=session.user;request.sessionId=session.sessionId;
  const required=this.reflector.getAllAndOverride<string[]>('permissions',targets);
  const sessionOnly=this.reflector.getAllAndOverride<boolean>('sessionOnly',targets);
  if((!required?.length&&!sessionOnly)||required?.some(permission=>!session.user.permissions.includes(permission))){
   await this.auth.audit('authorization.denied',session.user.id,{path:request.path,method:request.method});throw new ForbiddenException('Access denied.');
  }
  return true;
 }
}
