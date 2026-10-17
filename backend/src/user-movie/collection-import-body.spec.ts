import {
  Body,
  Controller,
  Patch,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureCollectionImportBody } from './collection-import-body';

@Controller('users/owner')
class BodyController {
  @Patch()
  patch(@Body() body: unknown) {
    return body ?? null;
  }

  @Post('movies/import')
  import(@Body() body: { content: string }) {
    return { length: body.content.length };
  }
}

describe('JSON-запросы с отдельным лимитом импорта коллекции', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BodyController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureCollectionImportBody(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('передаёт JSON обычного PATCH обработчику', async () => {
    const body = { watchTonightEnabled: true };
    const response = await fetch(`${base}/users/owner`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
  });

  it('разрешает импорт больше стандартных 100 КБ', async () => {
    const content = 'x'.repeat(200_000);
    const response = await fetch(`${base}/users/owner/movies/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ length: content.length });
  });

  it('сохраняет стандартный лимит для остальных запросов', async () => {
    const response = await fetch(`${base}/users/owner`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x'.repeat(200_000) }),
    });
    expect(response.status).toBe(413);
  });
});
