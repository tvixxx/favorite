import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import cookieParser from 'cookie-parser';
import { hash } from 'argon2';
import { featuresDatabase } from './features-database';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { UserController } from '../src/user/user.controller';
import { UserService } from '../src/user/user.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { configureCollectionImportBody } from '../src/user-movie/collection-import-body';

const origin = 'http://preferences.example.test';
const password = 'preferences-qa-only-password';
const defaults = {
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
};
const changed = {
  quickAddEnabled: false,
  watchTonightEnabled: true,
  collectionFilesEnabled: true,
  notifyNewMessages: false,
  notifyFriendRequests: false,
  notifyRecommendations: true,
  showAchievements: false,
  showDetailedAnalytics: false,
  showCommunityTops: false,
  showActorsSection: false,
};
let db: Awaited<ReturnType<typeof featuresDatabase>>;
let app: INestApplication;
let base: string;
let owner: string;
let other: string;

beforeAll(async () => {
  db = await featuresDatabase();
  const encrypted = await hash(password);
  owner = (
    await db.prisma.user.create({
      data: {
        email: 'owner@example.test',
        fullName: 'Владелец',
        password: encrypted,
      },
    })
  ).id;
  other = (
    await db.prisma.user.create({
      data: {
        email: 'other@example.test',
        fullName: 'Другой',
        password: encrypted,
      },
    })
  ).id;
  const config = new ConfigService({
    JWT_SECRET: 'preferences-qa-only-signing-key',
    JWT_ACCESS_TOKEN_TTL: '15m',
    JWT_REFRESH_TOKEN_TTL: '12h',
    COOKIE_DOMAIN: 'localhost',
    CORS_ORIGINS: origin,
  });
  const jwt = new JwtService({
    secret: config.getOrThrow<string>('JWT_SECRET'),
  });
  const module = await Test.createTestingModule({
    imports: [PassportModule],
    controllers: [AuthController, UserController],
    providers: [
      { provide: ConfigService, useValue: config },
      {
        provide: AuthService,
        useValue: new AuthService(db.prisma as PrismaService, config, jwt),
      },
      {
        provide: UserService,
        useValue: new UserService(db.prisma as PrismaService, {} as never),
      },
      JwtStrategy,
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.use(cookieParser());
  configureCollectionImportBody(app);
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

beforeEach(async () => {
  await db.prisma.user.updateMany({
    where: { id: { in: [owner, other] } },
    data: defaults,
  });
});

afterAll(async () => {
  await app?.close();
  await db?.close();
});

async function login(email: string) {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  let { accessToken } = (await response.json()) as { accessToken: string };
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  return {
    async profile() {
      const result = await fetch(`${base}/auth/@me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(result.status).toBe(200);
      return result.json() as Promise<typeof defaults>;
    },
    patch(id: string, data: Partial<typeof defaults>) {
      return fetch(`${base}/users/${id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          origin,
        },
        body: JSON.stringify(data),
      });
    },
    async refresh() {
      const result = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { cookie, origin },
      });
      expect(result.status).toBe(200);
      accessToken = ((await result.json()) as { accessToken: string })
        .accessToken;
    },
  };
}

describe('Настройки в независимых авторизованных сессиях', () => {
  it('переносит все настройки между сессиями и сохраняет их после нового входа', async () => {
    const desktop = await login('owner@example.test');
    const phone = await login('owner@example.test');
    expect((await desktop.patch(owner, changed)).status).toBe(200);
    expect(await phone.profile()).toMatchObject(changed);

    expect(
      (
        await phone.patch(owner, {
          quickAddEnabled: true,
          notifyNewMessages: true,
        })
      ).status,
    ).toBe(200);
    const expected = {
      ...changed,
      quickAddEnabled: true,
      notifyNewMessages: true,
    };
    expect(await desktop.profile()).toMatchObject(expected);
    await phone.refresh();
    expect(await phone.profile()).toMatchObject(expected);
    const fresh = await login('owner@example.test');
    expect(await fresh.profile()).toMatchObject(expected);
  });

  it('хранит отдельные значения пользователей и запрещает менять чужой профиль', async () => {
    const first = await login('owner@example.test');
    const second = await login('other@example.test');
    expect((await first.patch(owner, changed)).status).toBe(200);
    expect(await second.profile()).toMatchObject(defaults);
    const secondChoice = { ...defaults, collectionFilesEnabled: true };
    expect(
      (await second.patch(other, { collectionFilesEnabled: true })).status,
    ).toBe(200);
    expect(await first.profile()).toMatchObject(changed);
    expect((await first.patch(other, changed)).status).toBe(403);
    expect(await second.profile()).toMatchObject(secondChoice);
    expect(
      await db.prisma.user.findUnique({ where: { id: owner } }),
    ).toMatchObject(changed);
    expect(
      await db.prisma.user.findUnique({ where: { id: other } }),
    ).toMatchObject(secondChoice);
  });

  it('не возвращает персональный профиль без авторизации', async () => {
    expect((await fetch(`${base}/auth/@me`)).status).toBe(401);
  });
});
