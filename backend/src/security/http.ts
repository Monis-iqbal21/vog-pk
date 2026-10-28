import {ArgumentsHost,Catch,ExceptionFilter,HttpException} from '@nestjs/common';
import type {Response} from 'express';
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost){
  const response=host.switchToHttp().getResponse<Response>();
  const status=error instanceof HttpException?error.getStatus():500;
  if(status===429)response.setHeader('Retry-After','900');
  response.status(status).json({statusCode:status,message:error instanceof HttpException?error.message:'The service is temporarily unavailable.'});
 }
}
