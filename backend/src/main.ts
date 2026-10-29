import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import helmet from 'helmet';
import {securityConfig} from './security/config.js';
import {SafeExceptionFilter} from './security/http.js';
import {listenOptions} from './listen-options.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg=securityConfig();
  app.use(helmet());
  app.use('/api/admin',(_request:unknown,response:{setHeader:(name:string,value:string)=>void},next:()=>void)=>{response.setHeader('Cache-Control','no-store');response.setHeader('X-Robots-Tag','noindex, nofollow');next();});
  app.useGlobalFilters(new SafeExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableCors({origin:[cfg.storefrontOrigin,cfg.adminOrigin],credentials:false,methods:['GET','POST','PATCH','OPTIONS'],allowedHeaders:['Content-Type','Authorization','X-Admin-Bff-Key','X-Admin-Client-Ip']});
  app.enableShutdownHooks();
  const {port,host}=listenOptions();
  await app.listen(port,host);
}
await bootstrap();
