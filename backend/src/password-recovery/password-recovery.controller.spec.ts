import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageGateway } from '../message/message.gateway';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../message/message.gateway', () => ({ MessageGateway: class {} }));
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ close: jest.fn(), sendMail: jest.fn() })),
  },
}));

let app: INestApplication | undefined;
async function start(flag: string | undefined) {
  const findUnique = jest.fn().mockResolvedValue(null);
  const module = await Test.createTestingModule({
    controllers: [PasswordRecoveryController],
    providers: [
      PasswordRecoveryService,
      {
        provide: PrismaService,
        useValue: { user: { findUnique }, passwordReset: { findUnique } },
      },
      { provide: MessageGateway, useValue: {} },
      {
        provide: ConfigService,
        useValue: new ConfigService({
          PASSWORD_RECOVERY_ENABLED: flag,
          SMTP_HOST: 'smtp.example.test',
          SMTP_PORT: '587',
          SMTP_FROM: 'favorite@example.test',
          SMTP_USER: 'fixture-user',
          SMTP_PASS: 'fixture-pass',
          NODE_ENV: 'production',
          FRONTEND_ORIGIN: 'https://favorite.example.test',
        }),
      },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = (
    path: string,
    body: unknown,
    origin = 'https://favorite.example.test',
  ) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
  return { base, post, findUnique };
}
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('Публичная доступность и запрет HTTP-восстановления', () => {
  it.each([undefined, 'false'])(
    'не выдаёт секреты и отклоняет оба действия без БД при флаге %s',
    async (flag) => {
      const { base, post, findUnique } = await start(flag);
      const capabilities = await fetch(base + '/auth/password/capabilities');
      expect(capabilities.status).toBe(200);
      expect(capabilities.headers.get('cache-control')).toBe('no-store');
      expect(await capabilities.json()).toEqual({ passwordRecovery: false });
      const known = await post('/auth/password/request', {
        email: 'known@example.test',
      });
      const unknown = await post('/auth/password/request', {
        email: 'missing@example.test',
      });
      const reset = await post('/auth/password/reset', {
        token: 'a'.repeat(64),
        password: 'new-password-123',
      });
      expect([known.status, unknown.status, reset.status]).toEqual([
        503, 503, 503,
      ]);
      expect(await known.json()).toEqual(await unknown.json());
      expect(findUnique).not.toHaveBeenCalled();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    },
  );

  it('включает доступность одним флагом и одинаково принимает запросы для разных email', async () => {
    const { base, post } = await start('true');
    const capabilities = await fetch(base + '/auth/password/capabilities');
    expect(await capabilities.json()).toEqual({ passwordRecovery: true });
    const known = await post('/auth/password/request', {
      email: 'known@example.test',
    });
    const unknown = await post('/auth/password/request', {
      email: 'missing@example.test',
    });
    expect([known.status, unknown.status]).toEqual([202, 202]);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it('сохраняет запрет чужого origin независимо от выключенного флага', async () => {
    const { post, findUnique } = await start('false');
    const result = await post(
      '/auth/password/request',
      { email: 'known@example.test' },
      'https://other.example.test',
    );
    expect(result.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
