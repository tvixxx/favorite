import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

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
        findUnique: jest.fn().mockResolvedValue({ id: 'user-id' }),
        create: jest.fn().mockResolvedValue({ id: 'user-id' }),
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
    expect(jwt.verify(result!.accessToken)).toMatchObject({
      id: 'user-id',
      type: 'access',
    });
  });
});
