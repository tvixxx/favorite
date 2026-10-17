import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoveryRequestDto, ResetPasswordDto } from './password-recovery.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import nodemailer from 'nodemailer';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../message/message.gateway', () => ({ MessageGateway: class {} }));
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: jest.fn(), close: jest.fn() })),
  },
}));

const config = (extra: Record<string, unknown> = {}) =>
  new ConfigService({
    PASSWORD_RECOVERY_ENABLED: 'true',
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_FROM: 'favorite@example.test',
    SMTP_USER: 'test-only',
    SMTP_PASS: 'test-only',
    FRONTEND_ORIGIN: 'https://favorite.example.test',
    NODE_ENV: 'production',
    ...extra,
  });

describe('Безопасные границы восстановления пароля', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([undefined, 'false'])(
    'отключает запрос и расходование старой ссылки при флаге %s',
    async (flag) => {
      const findUnique = jest.fn();
      const service = new PasswordRecoveryService(
        { user: { findUnique }, passwordReset: { findUnique } } as never,
        {} as never,
        config({ PASSWORD_RECOVERY_ENABLED: flag }),
      );

      expect(() => service.request('known@example.test')).toThrow(
        ServiceUnavailableException,
      );
      expect(() => service.request('missing@example.test')).toThrow(
        ServiceUnavailableException,
      );
      await expect(
        service.reset('a'.repeat(64), 'new-password-123'),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(findUnique).not.toHaveBeenCalled();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      await service.onModuleDestroy();
    },
  );
  it('отклоняет ошибочное значение флага и включение без SMTP', () => {
    for (const flag of ['yes', '1', 'TRUE']) {
      expect(
        () =>
          new PasswordRecoveryService(
            {} as never,
            {} as never,
            config({ PASSWORD_RECOVERY_ENABLED: flag }),
          ),
      ).toThrow('PASSWORD_RECOVERY_ENABLED');
    }
    expect(
      () =>
        new PasswordRecoveryService(
          {} as never,
          {} as never,
          config({ SMTP_HOST: '' }),
        ),
    ).toThrow('SMTP_HOST');
  });
  it('не ищет аккаунт до возврата одинакового ответа на запрос', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new PasswordRecoveryService(
      prisma as never,
      {} as never,
      config(),
    );
    expect(service.request('known@example.test')).toEqual(
      service.request('unknown@example.test'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    await Promise.resolve();
    await service.onModuleDestroy();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
  it('ограничивает число фоновых запросов при недоступной БД', async () => {
    let finish!: (value: null) => void;
    const pending = new Promise<null>((resolve) => {
      finish = resolve;
    });
    const prisma = { user: { findUnique: jest.fn(() => pending) } };
    const service = new PasswordRecoveryService(
      prisma as never,
      {} as never,
      config(),
    );
    for (let i = 0; i < 32; i++) service.request(`${i}@example.test`);
    expect(() => service.request('overflow@example.test')).toThrow(
      ServiceUnavailableException,
    );
    await Promise.resolve();
    expect(prisma.user.findUnique.mock.calls.length).toBeLessThanOrEqual(32);
    finish(null);
    await service.onModuleDestroy();
  });
  it('требует TLS в production и не разрешает SMTP читать файлы или URL', () => {
    new PasswordRecoveryService({} as never, {} as never, config());
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pool: true,
        secure: false,
        requireTLS: true,
        disableFileAccess: true,
        disableUrlAccess: true,
        maxConnections: 2,
      }),
    );
    expect(
      () =>
        new PasswordRecoveryService(
          {} as never,
          {} as never,
          config({ FRONTEND_ORIGIN: 'http://favorite.example.test' }),
        ),
    ).toThrow();
  });
  it('не требует SMTP для явно выключенного восстановления', () => {
    const service = new PasswordRecoveryService(
      {} as never,
      {} as never,
      config({ PASSWORD_RECOVERY_ENABLED: 'false', SMTP_HOST: '' }),
    );
    expect(() => service.request('user@example.test')).toThrow(
      ServiceUnavailableException,
    );
  });
  it('отклоняет заголовочную инъекцию и невалидный токен или пароль', async () => {
    expect(
      await validate(
        plainToInstance(RecoveryRequestDto, {
          email: 'user@example.test\r\nBcc:attacker@example.test',
        }),
      ),
    ).not.toHaveLength(0);
    for (const data of [
      { token: 'x'.repeat(64), password: 'valid123' },
      { token: 'a'.repeat(64), password: '12345' },
      { token: 'a'.repeat(64), password: 'x'.repeat(129) },
      { token: 'a'.repeat(64), password: '      ' },
    ])
      expect(
        await validate(plainToInstance(ResetPasswordDto, data)),
      ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ResetPasswordDto, {
          token: 'a'.repeat(64),
          password: 'valid123',
        }),
      ),
    ).toHaveLength(0);
  });
});
