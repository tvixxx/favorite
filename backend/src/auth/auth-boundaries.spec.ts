import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { type INestApplication, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BadgeController } from '../badge/badge.controller';
import { BadgeService } from '../badge/badge.service';
import { JwtGuard } from '../common/guards/auth.guard';
import { HttpThrottlerGuard } from '../common/guards/http-throttler.guard';
import { Controller, Get } from '@nestjs/common';

@Controller('throttle-check')
class ThrottleCheckController {
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get()
  public read(): { ok: boolean } {
    return { ok: true };
  }
}

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('HTTP границы авторизации и приватных достижений', () => {
  let app: INestApplication;
  const auth = {
    logout: jest.fn().mockResolvedValue({ success: true }),
    login: jest.fn(),
    refresh: jest.fn(),
  };
  const badges = { getUserBadges: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }])],
      controllers: [AuthController, BadgeController, ThrottleCheckController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: BadgeService, useValue: badges },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ORIGINS: 'http://localhost:8080',
          }),
        },
        { provide: APP_GUARD, useClass: HttpThrottlerGuard },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ user: { id: string } }>().user = {
            id: 'owner',
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['logout', 'login', 'refresh'])(
    'запрещает %s с постороннего origin до изменения cookie',
    async (route) => {
      await request(app.getHttpServer() as Server)
        .post(`/auth/${route}`)
        .set('Origin', 'https://untrusted.example')
        .send({})
        .expect(403);
      expect(auth.logout).not.toHaveBeenCalled();
      expect(auth.login).not.toHaveBeenCalled();
      expect(auth.refresh).not.toHaveBeenCalled();
    },
  );

  it('сохраняет выход из приложения с разрешённым origin и без браузерного origin', async () => {
    await request(app.getHttpServer() as Server)
      .post('/auth/logout')
      .set('Origin', 'http://localhost:8080')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .post('/auth/logout')
      .expect(200);
    expect(auth.logout).toHaveBeenCalledTimes(2);
  });

  it('возвращает собственные достижения и запрещает чужой приватный прогресс', async () => {
    await request(app.getHttpServer() as Server)
      .get('/users/owner/badges')
      .expect(200, []);
    await request(app.getHttpServer() as Server)
      .get('/users/another/badges')
      .expect(403);
    expect(badges.getUserBadges).toHaveBeenCalledTimes(1);
  });

  it('общий guard учитывает запрос один раз и ограничивает обычный маршрут', async () => {
    await request(app.getHttpServer() as Server)
      .get('/throttle-check')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get('/throttle-check')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .get('/throttle-check')
      .expect(429);
  });
});
