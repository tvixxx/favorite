import { Test } from '@nestjs/testing';
import {
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { WatchDiaryController } from './watch-diary.controller';
import { WatchDiaryService } from './watch-diary.service';
import { JwtGuard } from '../common/guards';
import { AuthOriginGuard } from '../common/guards/auth-origin.guard';
import type { Server } from 'node:http';
import type { CreateDiaryDto } from './watch-diary.dto';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('HTTP-границы личного дневника', () => {
  let app: INestApplication<Server>;
  const owner = '00000000-0000-4000-8000-000000000001';
  const calls = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    create: jest
      .fn<Promise<{ status: string }>, [string, CreateDiaryDto]>()
      .mockResolvedValue({ status: 'saved' }),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const body = {
    requestId: '00000000-0000-4000-8000-000000000002',
    movieId: '00000000-0000-4000-8000-000000000003',
    viewedOn: '2020-05-10',
    scope: 'TITLE',
    isRewatch: false,
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WatchDiaryController],
      providers: [
        { provide: WatchDiaryService, useValue: calls },
        {
          provide: ConfigService,
          useValue: { get: () => 'https://diary.test' },
        },
        AuthOriginGuard,
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate(context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: { id: string };
            };
          };
        }) {
          const req = context.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer test-owner')
            throw new UnauthorizedException();
          req.user = { id: owner };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
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
  beforeEach(() => jest.clearAllMocks());
  const server = (): Server => app.getHttpServer();
  const post = (value: object) =>
    request(server())
      .post(`/users/${owner}/watch-diary`)
      .set('Authorization', 'Bearer test-owner')
      .set('Origin', 'https://diary.test')
      .send(value);

  it('требует входа и не разрешает читать чужой маршрут даже с действующей сессией', async () => {
    await request(server()).get(`/users/${owner}/watch-diary`).expect(401);
    await request(server())
      .get('/users/00000000-0000-4000-8000-000000000009/watch-diary')
      .set('Authorization', 'Bearer test-owner')
      .expect(403);
    expect(calls.list).not.toHaveBeenCalled();
  });
  it('закрывает запись из чужого источника и выдаёт приватный запрет кеширования', async () => {
    await request(server())
      .post(`/users/${owner}/watch-diary`)
      .set('Authorization', 'Bearer test-owner')
      .set('Origin', 'https://foreign.test')
      .send(body)
      .expect(403);
    const result = await request(server())
      .get(`/users/${owner}/watch-diary`)
      .set('Authorization', 'Bearer test-owner')
      .expect(200);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(calls.create).not.toHaveBeenCalled();
  });
  it.each([
    { userId: 'other' },
    { rating: '9' },
    { rating: 0 },
    { season: '003' },
    { syncStatus: 'true' },
    { note: 'x'.repeat(501) },
    { note: 'text\u0000' },
    { isRewatch: null },
  ])('отклоняет недопустимые поля до сервиса: %j', async (extra) => {
    await post({ ...body, ...extra }).expect(400);
    expect(calls.create).not.toHaveBeenCalled();
  });
  it('принимает обычный текст, но не превращает его в HTML', async () => {
    await post({
      ...body,
      note: 'Заметка O’Connor <3\nПовторный просмотр',
    }).expect(200);
    expect(calls.create.mock.calls[0][1].note).toBe(
      'Заметка O’Connor <3\nПовторный просмотр',
    );
  });
});
