import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { featuresDatabase } from './features-database';
import { UserService } from '../src/user/user.service';
import { UserController } from '../src/user/user.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtGuard } from '../src/common/guards';
import type { PrismaService } from '../src/prisma/prisma.service';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let app: INestApplication;
let owner: string;
let other: string;
let base: string;

beforeAll(async () => {
  db = await featuresDatabase();
  owner = (
    await db.prisma.user.create({
      data: {
        email: 'preferences-owner@example.test',
        fullName: 'Владелец',
        password: 'qa-unused-hash',
      },
    })
  ).id;
  other = (
    await db.prisma.user.create({
      data: {
        email: 'preferences-other@example.test',
        fullName: 'Другой',
        password: 'qa-unused-hash',
      },
    })
  ).id;
  const module = await Test.createTestingModule({
    controllers: [UserController],
    providers: [
      {
        provide: UserService,
        useValue: new UserService(db.prisma as PrismaService, {} as never),
      },
    ],
  })
    .overrideGuard(JwtGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        const request = context
          .switchToHttp()
          .getRequest<{ headers: Record<string, string>; user: unknown }>();
        request.user = { id: request.headers['x-test-user'], role: 'USER' };
        return true;
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  await db?.close();
});

describe('Персональные настройки на PostgreSQL и HTTP', () => {
  it('задаёт значения по умолчанию для каждого аккаунта', async () => {
    for (const id of [owner, other]) {
      expect(await db.prisma.user.findUnique({ where: { id } })).toMatchObject({
        quickAddEnabled: true,
        watchTonightEnabled: false,
        collectionFilesEnabled: false,
        notifyNewMessages: true,
        notifyFriendRequests: true,
        notifyRecommendations: false,
        showAchievements: true,
        showDetailedAnalytics: true,
        showCommunityTops: true,
        showActorsSection: true,
      });
    }
  });

  it('сохраняет только выбранные флаги и возвращает их после новой проверки сессии', async () => {
    const response = await fetch(`${base}/users/${owner}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-user': owner },
      body: JSON.stringify({
        watchTonightEnabled: true,
        notifyNewMessages: false,
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      watchTonightEnabled: true,
      notifyNewMessages: false,
      quickAddEnabled: true,
      fullName: 'Владелец',
    });
    const auth = new AuthService(
      db.prisma as PrismaService,
      new ConfigService({
        JWT_ACCESS_TOKEN_TTL: '15m',
        JWT_REFRESH_TOKEN_TTL: '12h',
        COOKIE_DOMAIN: 'localhost',
      }),
      new JwtService({ secret: 'qa-only-signing-key' }),
    );
    expect(await auth.validate(owner)).toMatchObject({
      watchTonightEnabled: true,
      notifyNewMessages: false,
    });
    expect(await auth.validate(other)).toMatchObject({
      watchTonightEnabled: false,
      notifyNewMessages: true,
    });
    const oldClient = await fetch(`${base}/users/${owner}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-user': owner },
      body: JSON.stringify({ fullName: 'Новое имя' }),
    });
    expect(oldClient.status).toBe(200);
    expect(await oldClient.json()).toMatchObject({
      watchTonightEnabled: true,
      notifyNewMessages: false,
    });
  });

  it('отклоняет строковые флаги и изменение чужого аккаунта без изменения БД', async () => {
    const before = await db.prisma.user.findUnique({ where: { id: other } });
    const foreign = await fetch(`${base}/users/${other}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-user': owner },
      body: JSON.stringify({ quickAddEnabled: false }),
    });
    expect(foreign.status).toBe(403);
    const invalid = await fetch(`${base}/users/${other}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-test-user': other },
      body: JSON.stringify({ quickAddEnabled: 'false' }),
    });
    expect(invalid.status).toBe(400);
    expect(await db.prisma.user.findUnique({ where: { id: other } })).toEqual(
      before,
    );
    expect(
      await new UserService(db.prisma as PrismaService, {} as never).findById(
        other,
        { id: other, role: 'USER' },
      ),
    ).not.toHaveProperty('notifyNewMessages');
  });
});
