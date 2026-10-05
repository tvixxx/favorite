import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { LoggerMiddlewareFn } from './common/middlewares';
import { initSwaggerDocs } from './common/swagger';
import { parseCorsOrigins } from './common/utils/cors-policy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
  });
  const configService = app.get(ConfigService);
  const allowedOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGINS') ??
      configService.get<string>('FRONTEND_ORIGIN'),
  );

  initSwaggerDocs(app);
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  if (configService.get<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
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

  const port = Number(configService.get<string>('PORT') ?? 3005);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT должен быть числом от 1 до 65535');
  }

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
