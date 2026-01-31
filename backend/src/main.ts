import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { LoggerMiddlewareFn } from './common/middlewares';
import { initSwaggerDocs } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  initSwaggerDocs(app);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.use(LoggerMiddlewareFn);
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
