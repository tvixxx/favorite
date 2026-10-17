import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import cookieParser from 'cookie-parser';
import { io, type Socket } from '../../frontend/node_modules/socket.io-client';
import { featuresDatabase } from './features-database';
import { smtpCapture } from './smtp-capture';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordRecoveryModule } from '../src/password-recovery/password-recovery.module';
import { PasswordRecoveryService } from '../src/password-recovery/password-recovery.service';
import { AuthService } from '../src/auth/auth.service';
import { HttpThrottlerGuard } from '../src/common/guards/http-throttler.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let capture: Awaited<ReturnType<typeof smtpCapture>>;
let app: INestApplication;
let service: PasswordRecoveryService;
let base: string;
let userId: string;
let socket: Socket | undefined;
let originalOrigin: string | undefined;
const email = 'recovery@example.test';
const origin = 'http://127.0.0.1:8096';
const post = async (path: string, data: unknown) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });

async function waitFor(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 5000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('QA ожидание истекло');
    await delay(10);
  }
}
async function issuedToken(index = 0) {
  await waitFor(() => capture.messages.length > index);
  const message = capture.messages[index];
  const boundary = message.indexOf('\r\n\r\n');
  const headers = message.slice(0, boundary);
  const body = message.slice(boundary + 4);
  const decoded = /Content-Transfer-Encoding: base64/i.test(headers)
    ? Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8')
    : body
        .replace(/=\r?\n/g, '')
        .replace(/=([a-f0-9]{2})/gi, (_, hex: string) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
  const match = decoded.match(
    /http[^\s]+\/reset-password#token=([a-f0-9]{64})/,
  );
  if (!match) throw new Error('В письме нет корректной ссылки');
  expect(new URL(match[0]).origin).toBe(origin);
  expect(new URL(match[0]).search).toBe('');
  return match[1];
}
beforeAll(async () => {
  db = await featuresDatabase();
  originalOrigin = process.env.CORS_ORIGINS;
  process.env.CORS_ORIGINS = origin;
});
afterAll(async () => {
  if (originalOrigin === undefined) delete process.env.CORS_ORIGINS;
  else process.env.CORS_ORIGINS = originalOrigin;
  await db?.close();
});
beforeEach(async () => {
  await db.prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  capture = await smtpCapture();
  userId = randomUUID();
  await db.prisma.user.create({
    data: {
      id: userId,
      email,
      fullName: 'QA recovery',
      password: await hash('old-password-123'),
    },
  });
  const config = new ConfigService({
    PASSWORD_RECOVERY_ENABLED: 'true',
    NODE_ENV: 'development',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(capture.port),
    SMTP_FROM: 'favorite@example.test',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_SECURE: 'false',
    FRONTEND_ORIGIN: origin,
    CORS_ORIGINS: origin,
    JWT_SECRET: 'qa-recovery-only-key',
    JWT_ACCESS_TOKEN_TTL: '15m',
    JWT_REFRESH_TOKEN_TTL: '1h',
    COOKIE_DOMAIN: '127.0.0.1',
  });
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 200 }]),
      PasswordRecoveryModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: HttpThrottlerGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(db.prisma)
    .overrideProvider(ConfigService)
    .useValue(config)
    .compile();
  app = module.createNestApplication({ logger: false });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  service = app.get(PasswordRecoveryService);
});
afterEach(async () => {
  socket?.disconnect();
  socket = undefined;
  await app?.close();
  await capture?.close();
});

describe('Восстановление через реальный SMTP и PostgreSQL18', () => {
  it('отключает бездействующий сокет после истечения access-токена', async () => {
    const token = app
      .get(JwtService)
      .sign(
        { id: userId, authVersion: 0, type: 'access' },
        { expiresIn: '2s' },
      );
    socket = io(`${base}/chat`, {
      auth: { token },
      extraHeaders: { Origin: origin },
      transports: ['websocket'],
      reconnection: false,
    });
    await waitFor(
      async () =>
        !!socket?.connected &&
        !!(await db.prisma.userStatus.findUnique({ where: { userId } }))
          ?.isOnline,
    );

    await waitFor(() => !socket?.connected);
    await waitFor(
      async () =>
        !(await db.prisma.userStatus.findUnique({ where: { userId } }))
          ?.isOnline,
    );
    expect(
      (await db.prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .authVersion,
    ).toBe(0);
  });

  it('отвечает одинаково известному/неизвестному email и хранит только хеш одноразовой ссылки', async () => {
    const known = await post('/auth/password/request', { email });
    const unknown = await post('/auth/password/request', {
      email: 'missing@example.test',
    });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    const token = await issuedToken();
    const record = await db.prisma.passwordReset.findUniqueOrThrow({
      where: { userId },
    });
    expect(record.tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(record.tokenHash).not.toBe(token);
    expect(record.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60000);
    expect(record.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      15 * 60000,
    );
    expect(await db.prisma.passwordReset.count()).toBe(1);
  });
  it('смена пароля отзывает access/refresh и отключает прежний сокет, повторное использование не меняет данные', async () => {
    const jwt = app.get(JwtService);
    const oldAccess = jwt.sign({ id: userId, authVersion: 0, type: 'access' });
    const oldRefresh = jwt.sign({
      id: userId,
      authVersion: 0,
      type: 'refresh',
    });
    socket = io(`${base}/chat`, {
      auth: { token: oldAccess },
      extraHeaders: { Origin: origin },
      transports: ['websocket'],
      reconnection: false,
    });
    await waitFor(
      async () =>
        !!(await db.prisma.userStatus.findUnique({ where: { userId } }))
          ?.isOnline,
    );
    service.request(email);
    const token = await issuedToken();
    const changed = await post('/auth/password/reset', {
      token,
      password: 'new-password-456',
    });
    expect(changed.status).toBe(200);
    await waitFor(() => !socket?.connected);
    const user = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(await verify(user.password, 'new-password-456')).toBe(true);
    expect(user.authVersion).toBe(1);
    await expect(
      app.get(AuthService).verifyAccessToken(oldAccess),
    ).rejects.toThrow();
    const refresh = await fetch(base + '/auth/refresh', {
      method: 'POST',
      headers: { Origin: origin, Cookie: `refresh_token=${oldRefresh}` },
    });
    expect(refresh.status).toBe(401);
    expect(
      (
        await post('/auth/password/reset', {
          token,
          password: 'reused-password-789',
        })
      ).status,
    ).toBe(400);
    expect(await db.prisma.passwordReset.count()).toBe(0);
    expect(
      (await db.prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .password,
    ).toBe(user.password);
  });
  it('два одновременных расходования ссылки дают ровно один успешный результат', async () => {
    service.request(email);
    const token = await issuedToken();
    const passwords = ['winner-password-111', 'winner-password-222'];
    const result = await Promise.all(
      passwords.map((password) =>
        service.reset(token, password).then(
          () => true,
          () => false,
        ),
      ),
    );
    expect(result.filter(Boolean)).toHaveLength(1);
    const user = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(user.authVersion).toBe(1);
    expect(await verify(user.password, passwords[result.indexOf(true)])).toBe(
      true,
    );
  });
  it('истёкшая ссылка не меняет пароль и даёт тот же ответ, что неизвестная', async () => {
    service.request(email);
    const token = await issuedToken();
    await db.prisma.passwordReset.update({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const expired = await post('/auth/password/reset', {
      token,
      password: 'new-password-456',
    });
    const unknown = await post('/auth/password/reset', {
      token: 'f'.repeat(64),
      password: 'new-password-456',
    });
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({
      message: ((await unknown.json()) as { message: string }).message,
    });
    const user = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(await verify(user.password, 'old-password-123')).toBe(true);
    expect(user.authVersion).toBe(0);
  });
  it('ограничивает повторное письмо и заменяет старую ссылку только новым запросом после минуты', async () => {
    service.request(email);
    const first = await issuedToken();
    service.request(email);
    await delay(100);
    expect(capture.messages).toHaveLength(1);
    await db.prisma.passwordReset.update({
      where: { userId },
      data: { createdAt: new Date(Date.now() - 61000) },
    });
    service.request(email);
    const second = await issuedToken(1);
    expect(second).not.toBe(first);
    await expect(service.reset(first, 'new-password-456')).rejects.toThrow();
    await expect(
      service.reset(second, 'new-password-456'),
    ).resolves.toMatchObject({
      message: 'Пароль изменён. Войдите с новым паролем.',
    });
  });
  it('не восстанавливает заблокированный аккаунт и не принимает ссылку прежней authVersion после разблокировки', async () => {
    service.request(email);
    const token = await issuedToken();
    await db.prisma.user.update({
      where: { id: userId },
      data: { blockedAt: new Date(), authVersion: { increment: 1 } },
    });
    await expect(service.reset(token, 'new-password-456')).rejects.toThrow();
    await db.prisma.user.update({
      where: { id: userId },
      data: { blockedAt: null },
    });
    await expect(service.reset(token, 'new-password-456')).rejects.toThrow();
  });
  it('независимо от UI отклоняет лишние поля, неправильный Origin и перебор запросов', async () => {
    expect(
      (
        await post('/auth/password/request', {
          email,
          redirectUrl: 'https://attacker.example.test',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post('/auth/password/reset', {
          token: 'a'.repeat(64),
          password: 'valid123',
          userId,
          authVersion: 99,
        })
      ).status,
    ).toBe(400);
    const badOrigin = await fetch(base + '/auth/password/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example.test',
      },
      body: JSON.stringify({ email }),
    });
    expect(badOrigin.status).toBe(403);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push(
        (
          await post('/auth/password/request', {
            email: 'missing@example.test',
          })
        ).status,
      );
    expect(statuses).toContain(429);
    expect(await db.prisma.passwordReset.count()).toBe(0);
  });
});
