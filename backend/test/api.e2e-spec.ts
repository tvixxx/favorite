import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaService } from '../src/media/media.service';
import { ImageStorage } from '../src/media/image-storage.service';
import { ImageProcessor } from '../src/media/image-processor.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

jest.mock('../src/prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Сборка приложения и HTTP-контракты без настоящей базы', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          NODE_ENV: 'test',
          JWT_SECRET: 'test-only-signing-key',
          JWT_ACCESS_TOKEN_TTL: '15m',
          JWT_REFRESH_TOKEN_TTL: '12h',
          COOKIE_DOMAIN: 'localhost',
          CORS_ORIGINS: 'http://localhost:8080',
        }),
      )
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
        movie: { findMany: jest.fn().mockResolvedValue([]) },
        review: { groupBy: jest.fn().mockResolvedValue([]) },
        userStatus: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      })
      .overrideProvider(MediaService)
      .useValue({})
      .overrideProvider(ImageStorage)
      .useValue({})
      .overrideProvider(ImageProcessor)
      .useValue({})
      .compile();

    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('подключает health и публичный каталог через настоящий AppModule', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/movies').expect(200, []);
  });

  it('подключает JWT guard к закрытым маршрутам', async () => {
    await request(app.getHttpServer()).get('/auth/@me').expect(401);
    await request(app.getHttpServer()).post('/movies').send({}).expect(401);
  });

  it('сохраняет формат ошибок и отклоняет неверные query-параметры', async () => {
    const response = await request(app.getHttpServer())
      .get('/movies?publishDateFrom=invalid')
      .expect(400);

    expect(response.body).toMatchObject({
      status: 400,
      statusCode: 400,
      path: '/movies',
    });
    await request(app.getHttpServer())
      .get('/movies/search?q=a&q=b')
      .expect(400);
  });

  it('подключает origin guard к cookie-операциям', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'https://untrusted.example')
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'http://localhost:8080')
      .expect(200, 'true');
  });

  it('описывает каталог в Swagger без несуществующих персональных полей', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('API test').setVersion('1').build(),
    );
    const schema = document.components?.schemas?.MovieResponse;

    expect(schema).toHaveProperty('properties.id');
    expect(schema).toHaveProperty('properties.poster');
    expect(schema).toHaveProperty('properties.createdById');
    expect(schema).not.toHaveProperty('properties.imageUrl');
    expect(schema).not.toHaveProperty('properties.isFavorite');
    expect(schema).not.toHaveProperty('properties.currentEpisode');
  });
});
