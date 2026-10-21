import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { TvdbController } from './tvdb.controller';
import { TvdbProvider } from './tvdb-provider';
import { TvdbImportService } from './tvdb-import.service';
import { JwtGuard } from '../common/guards/auth.guard';
import { AuthOriginGuard } from '../common/guards/auth-origin.guard';
import { Genre } from '../generated/prisma/enums';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('HTTP контракт TheTVDB', () => {
  let app: INestApplication;
  const disabled = new TvdbProvider(new ConfigService({}));
  const imports = {
    search: jest
      .fn()
      .mockImplementation((query: string) => disabled.search(query)),
    preview: jest.fn(),
    importMovie: jest.fn().mockResolvedValue({ movieId: 'movie' }),
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TvdbController],
      providers: [
        { provide: TvdbProvider, useValue: disabled },
        { provide: TvdbImportService, useValue: imports },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ORIGINS: 'http://localhost:8080',
          }),
        },
        AuthOriginGuard,
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx
            .switchToHttp()
            .getRequest<{ headers: Record<string, string>; user: object }>();
          if (!req.headers.authorization) throw new UnauthorizedException();
          req.user = { id: 'owner', role: 'USER' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app.close();
  });
  it('публичная доступность закрыта по умолчанию и не кешируется', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/catalog/tvdb/capabilities')
      .expect(200, { enabled: false });
    expect(res.headers['cache-control']).toBe('no-store');
  });
  it('требует авторизацию и запрещает прямой поиск при выключенном флаге', async () => {
    await request(app.getHttpServer() as Server)
      .get('/catalog/tvdb/search?query=Dune')
      .expect(401);
    await request(app.getHttpServer() as Server)
      .get('/catalog/tvdb/search?query=Dune')
      .set('Authorization', 'Bearer test')
      .expect(503);
  });
  it('принимает неизвестную страну и отклоняет фиктивный код', async () => {
    await request(app.getHttpServer() as Server)
      .post('/catalog/tvdb/import')
      .set('Authorization', 'Bearer test')
      .set('Origin', 'http://localhost:8080')
      .send({ id: '6187', type: 'movie', countryCodes: [] })
      .expect(201);
    await request(app.getHttpServer() as Server)
      .post('/catalog/tvdb/import')
      .set('Authorization', 'Bearer test')
      .set('Origin', 'http://localhost:8080')
      .send({ id: '6187', type: 'movie', countryCodes: ['UNKNOWN'] })
      .expect(400);
  });

  it('запрещает изменение с чужого origin', async () => {
    await request(app.getHttpServer() as Server)
      .post('/catalog/tvdb/import')
      .set('Authorization', 'Bearer test')
      .set('Origin', 'https://other.example')
      .send({ id: '6187', type: 'movie' })
      .expect(403);
    expect(imports.importMovie).not.toHaveBeenCalled();
  });
  it('отклоняет подмену актёров, владельца, URL и вложенной оценки', async () => {
    for (const extra of [
      { actorIds: ['forged'] },
      { userId: 'other' },
      { imageUrl: 'http://localhost/secret' },
      { collection: { personalRate: 10 } },
    ]) {
      await request(app.getHttpServer() as Server)
        .post('/catalog/tvdb/import')
        .set('Authorization', 'Bearer test')
        .set('Origin', 'http://localhost:8080')
        .send({ id: '6187', type: 'movie', ...extra })
        .expect(400);
    }
    expect(imports.importMovie).not.toHaveBeenCalled();
  });
  it('отклоняет ID за пределами типа базы данных до вызова импорта', async () => {
    await request(app.getHttpServer() as Server)
      .post('/catalog/tvdb/import')
      .set('Authorization', 'Bearer test')
      .set('Origin', 'http://localhost:8080')
      .send({ id: '9999999999', type: 'movie' })
      .expect(400);
    expect(imports.importMovie).not.toHaveBeenCalled();
  });
  it('принимает расширенный справочник жанров и ограничивает количество актёров', async () => {
    for (const actorLimit of [0, 201, 1.5, '15']) {
      await request(app.getHttpServer() as Server)
        .post('/catalog/tvdb/import')
        .set('Authorization', 'Bearer test')
        .set('Origin', 'http://localhost:8080')
        .send({ id: '6187', type: 'movie', actorLimit })
        .expect(400);
    }
    expect(imports.importMovie).not.toHaveBeenCalled();
    await request(app.getHttpServer() as Server)
      .post('/catalog/tvdb/import')
      .set('Authorization', 'Bearer test')
      .set('Origin', 'http://localhost:8080')
      .send({
        id: '6187',
        type: 'movie',
        actorLimit: 25,
        genres: Object.values(Genre),
      })
      .expect(201);
  });
});
