import type { INestApplication } from '@nestjs/common';
import { json } from 'express';

export function configureCollectionImportBody(app: INestApplication): void {
  app.use(
    /^\/users\/[^/]+\/movies\/import(?:\/check)?\/?$/,
    json({ limit: '3mb' }),
  );
  // Nest видит jsonParser импорта и не добавляет общий парсер автоматически.
  app.use(json());
}
