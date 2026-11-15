import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import helmet from 'helmet';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { securityConfig } from './security/config.js';
import { SafeExceptionFilter } from './security/http.js';
import { listenOptions } from './listen-options.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet());
  app.use('/api/catalog',(_req:Request,res:Response,next:NextFunction)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use(
    '/api/admin',
    (
      _request: unknown,
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      next();
    },
  );
  const ordinaryJson = express.json({ limit: '100kb' }),
    uploadJson = express.json({ limit: '8mb' });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.method === 'POST' &&
      /^\/api\/admin\/scopes\/tenants\/[a-f0-9-]{36}\/media\/uploads$/.test(
        req.path,
      )
      ? uploadJson
      : ordinaryJson)(req, res, next),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        [400, 413].includes(Number(error.status))
      )
        return res.status(Number(error.status)).json({
          message:
            Number(error.status) === 413
              ? 'Request too large.'
              : 'Invalid JSON.',
        });
      next(error);
    },
  );
  const cfg = securityConfig();
  app.useGlobalFilters(new SafeExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [cfg.storefrontOrigin, cfg.adminOrigin],
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Bff-Key',
      'X-Admin-Client-Ip',
    ],
  });
  app.enableShutdownHooks();
  const { port, host } = listenOptions();
  await app.listen(port, host);
}
await bootstrap();
