import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { LoggerMiddlewareFn } from './common/middlewares';
import { initSwaggerDocs } from './common/swagger';

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:8080';

function parseCorsOrigins(raw: string | undefined): string[] {
  const source = raw?.trim() || DEFAULT_FRONTEND_ORIGIN;

  return source
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS') ??
      configService.get<string>('FRONTEND_ORIGIN'),
  );

  initSwaggerDocs(app);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.use(LoggerMiddlewareFn);

  // С `withCredentials: true` на фронте нельзя `Access-Control-Allow-Origin: *`.
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);

        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, origin);

        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.listen(3005);
}

void bootstrap();
