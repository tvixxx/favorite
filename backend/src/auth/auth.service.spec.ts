import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { hash } from 'argon2';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Авторизация и назначение токенов', () => {
  const config = new ConfigService({
    JWT_SECRET: 'test-only-signing-key',
    JWT_ACCESS_TOKEN_TTL: '15m',
    JWT_REFRESH_TOKEN_TTL: '12h',
    COOKIE_DOMAIN: 'localhost',
    NODE_ENV: 'development',
  });
  const jwt = new JwtService({ secret: 'test-only-signing-key' });
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let service: AuthService;
  let res: Response;
  let cookie: jest.Mock<void, [string, string, { expires: Date }]>;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-id', authVersion: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'user-id', authVersion: 0 }),
      },
    };
    service = new AuthService(prisma as unknown as PrismaService, config, jwt);
    cookie = jest.fn<void, [string, string, { expires: Date }]>();
    res = { cookie } as unknown as Response;
  });

  it('выдаёт разные назначения access и refresh', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await service.register(res, {
      fullName: 'Тест',
      email: 'example@example.test',
      password: 'test-password',
    });
    expect(jwt.verify(result.accessToken)).toMatchObject({
      id: 'user-id',
      type: 'access',
    });
    expect(jwt.verify(cookie.mock.calls[0][1])).toMatchObject({
      id: 'user-id',
      type: 'refresh',
    });
  });

  it('не раскрывает существование аккаунта текстом ошибки входа', async () => {
    const password = await hash('test-only-password');

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.login(res, {
        email: 'missing@example.test',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Неверная почта или пароль',
    });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-id', password });
    await expect(
      service.login(res, {
        email: 'existing@example.test',
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Неверная почта или пароль',
    });
    expect(cookie).not.toHaveBeenCalled();
  });

  it('отклоняет access в refresh-cookie', async () => {
    const token = jwt.sign({ id: 'user-id', type: 'access' });
    await expect(
      service.refresh(
        { cookies: { refresh_token: token } } as unknown as Request,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('отклоняет refresh при проверке доступа к API', async () => {
    const strategy = new JwtStrategy(service, config);
    await expect(
      strategy.validate({ id: 'user-id', type: 'refresh' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('отклоняет старый токен без назначения', async () => {
    const strategy = new JwtStrategy(service, config);
    await expect(strategy.validate({ id: 'user-id' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('возвращает 401 для просроченного refresh', async () => {
    const token = jwt.sign(
      { id: 'user-id', type: 'refresh' },
      { expiresIn: -1 },
    );
    await expect(
      service.refresh(
        { cookies: { refresh_token: token } } as unknown as Request,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ставит срок cookie по сроку JWT, в том числе для TTL в часах', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await service.register(res, {
      fullName: 'Тест',
      email: 'example@example.test',
      password: 'test-password',
    });
    const [, token, options] = cookie.mock.calls[0];
    const payload = jwt.verify<{ exp: number }>(token);
    expect(options.expires.getTime()).toBe(payload.exp * 1000);
  });

  it('обновляет сессию действительным refresh', async () => {
    const token = jwt.sign({ id: 'user-id', type: 'refresh' });
    const result = await service.refresh(
      { cookies: { refresh_token: token } } as unknown as Request,
      res,
    );
    expect(jwt.verify(result.accessToken)).toMatchObject({
      id: 'user-id',
      type: 'access',
    });
  });

  it('не принимает действующий access-токен заблокированного пользователя', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      blockedAt: new Date(),
    });

    await expect(
      service.verifyAccessToken(jwt.sign({ id: 'user-id', type: 'access' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('не обновляет сессию заблокированного пользователя', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      blockedAt: new Date(),
    });

    await expect(
      service.refresh(
        {
          cookies: {
            refresh_token: jwt.sign({ id: 'user-id', type: 'refresh' }),
          },
        } as unknown as Request,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('не выдаёт токены заблокированному пользователю даже с верным паролем', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      password: await hash('test-only-password'),
      blockedAt: new Date(),
    });

    await expect(
      service.login(res, {
        email: 'blocked@example.test',
        password: 'test-only-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookie).not.toHaveBeenCalled();
  });
  it('после разблокировки требует новый вход для API, чата и обновления сессии', async () => {
    const user = {
      id: 'user-id',
      password: await hash('test-only-password'),
      blockedAt: null as Date | null,
      authVersion: 0,
    };
    prisma.user.findUnique.mockImplementation(() =>
      Promise.resolve({ ...user }),
    );
    const oldSession = await service.login(res, {
      email: 'example@example.test',
      password: 'test-only-password',
    });
    const oldRefresh = cookie.mock.calls[0][1];
    const strategy = new JwtStrategy(service, config);

    user.blockedAt = new Date();
    user.authVersion++;
    await expect(
      service.verifyAccessToken(oldSession.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    user.blockedAt = null;

    await expect(
      strategy.validate(jwt.verify(oldSession.accessToken)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.verifyAccessToken(oldSession.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    cookie.mockClear();
    await expect(
      service.refresh(
        { cookies: { refresh_token: oldRefresh } } as unknown as Request,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookie).not.toHaveBeenCalled();

    const fresh = await service.login(res, {
      email: 'example@example.test',
      password: 'test-only-password',
    });
    await expect(
      service.verifyAccessToken(fresh.accessToken),
    ).resolves.toMatchObject({ id: user.id });
    await expect(
      strategy.validate(jwt.verify(fresh.accessToken)),
    ).resolves.toMatchObject({ id: user.id });
    await expect(
      service.refresh(
        {
          cookies: { refresh_token: cookie.mock.calls[0][1] },
        } as unknown as Request,
        res,
      ),
    ).resolves.toHaveProperty('accessToken');
  });

  it('принимает прежние токены без версии только до первой блокировки', async () => {
    const token = jwt.sign({ id: 'user-id', type: 'access' });
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      id: 'user-id',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      blockedAt: null,
      authVersion: 1,
    });
    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
