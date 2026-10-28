import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import helmet from 'helmet';
import {securityConfig} from './security/config.js';
import {SafeExceptionFilter} from './security/http.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const cfg=securityConfig();
  app.use(helmet());
  app.use('/api/admin',(_request:unknown,response:{setHeader:(name:string,value:string)=>void},next:()=>void)=>{response.setHeader('Cache-Control','no-store');response.setHeader('X-Robots-Tag','noindex, nofollow');next();});
  app.useGlobalFilters(new SafeExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableCors({origin:[cfg.storefrontOrigin,cfg.adminOrigin],credentials:false,methods:['GET','POST','PATCH','OPTIONS'],allowedHeaders:['Content-Type','Authorization','X-Admin-Bff-Key','X-Admin-Client-Ip']});
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT??4000));
}
await bootstrap();
