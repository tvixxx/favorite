import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { Response, Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterRequest } from './dto/register.dto';
import type { JwtPayload } from './types';
import { LoginRequest } from './dto/login.dto';
import { isDev } from '../common/utils';

@Injectable()
export class AuthService {
  private readonly refreshTokenKey = 'refresh_token';

  private readonly JWT_ACCESS_TOKEN_TTL: string;
  private readonly JWT_REFRESH_TOKEN_TTL: string;

  private readonly COOKIE_DOMAIN: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.JWT_ACCESS_TOKEN_TTL = configService.getOrThrow<string>(
      'JWT_ACCESS_TOKEN_TTL',
    );
    this.JWT_REFRESH_TOKEN_TTL = configService.getOrThrow<string>(
      'JWT_REFRESH_TOKEN_TTL',
    );

    this.COOKIE_DOMAIN = configService.getOrThrow<string>('COOKIE_DOMAIN');
  }

  public async register(res: Response, dto: RegisterRequest) {
    const { fullName, email, password } = dto;

    const existUser = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (existUser) {
      throw new ConflictException('Пользователь с такой почтой уже существует');
    }

    const hashedPass = await hash(password);

    const user = await this.prismaService.user.create({
      data: {
        fullName,
        email,
        password: hashedPass,
      },
    });

    return this.auth(res, user.id, user.authVersion);
  }

  public async login(res: Response, dto: LoginRequest) {
    const { email, password } = dto;

    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        blockedAt: true,
        authVersion: true,
      },
    });

    if (!user) {
      // Выполняем сопоставимую работу, чтобы отсутствие аккаунта не давало быстрый ответ.
      await hash(password);
      throw new NotFoundException('Неверная почта или пароль');
    }

    const isValidPassword = await verify(user.password, password);

    if (!isValidPassword) {
      throw new NotFoundException('Неверная почта или пароль');
    }

    if (user.blockedAt) {
      throw new UnauthorizedException('Доступ к аккаунту ограничен');
    }

    return this.auth(res, user.id, user.authVersion);
  }

  public async refresh(req: Request, res: Response) {
    const refreshToken: unknown = req.cookies[this.refreshTokenKey];

    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new UnauthorizedException('Не действительный refresh-token');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Недействительный refresh-token');
    }

    if (
      payload.type !== 'refresh' ||
      typeof payload.id !== 'string' ||
      !payload.id
    ) {
      throw new UnauthorizedException('Недействительный refresh-token');
    }

    const user = await this.validate(payload.id, payload.authVersion);

    return this.auth(res, user.id, payload.authVersion ?? 0);
  }

  public logout(res: Response): Promise<boolean> {
    this.setCookie(res, this.refreshTokenKey, new Date(0));

    return Promise.resolve(true);
  }

  public async validate(id: string, authVersion = 0) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        blockedAt: true,
        authVersion: true,
        tags: true,
        timezone: true,
        quickAddEnabled: true,
        watchTonightEnabled: true,
        collectionFilesEnabled: true,
        notifyNewMessages: true,
        notifyFriendRequests: true,
        notifyRecommendations: true,
        showAchievements: true,
        showDetailedAnalytics: true,
        showCommunityTops: true,
        showActorsSection: true,
        avatarUrl: true,
        avatarThumbnailUrl: true,
        avatarAssetId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (user.blockedAt) {
      throw new UnauthorizedException('Доступ к аккаунту ограничен');
    }

    const { authVersion: currentVersion, ...publicUser } = user;

    if (
      !Number.isSafeInteger(authVersion) ||
      authVersion < 0 ||
      currentVersion !== authVersion
    ) {
      throw new UnauthorizedException('Сессия отозвана. Войдите снова');
    }

    return publicUser;
  }

  public async verifyAccessToken(token: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Недействительный access-token');
    }

    if (
      payload.type !== 'access' ||
      typeof payload.id !== 'string' ||
      !payload.id
    ) {
      throw new UnauthorizedException('Недействительный access-token');
    }

    const user = await this.validate(payload.id, payload.authVersion);

    return {
      ...user,
      accessTokenExpiresAt:
        payload.exp === undefined ? undefined : payload.exp * 1000,
    };
  }

  private auth(res: Response, id: string, authVersion: number) {
    const { accessToken, refreshToken } = this.generateTokens(id, authVersion);
    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);
    const expiresTimeMs = new Date(exp * 1000);

    this.setCookie(res, refreshToken, expiresTimeMs);

    return { accessToken };
  }

  private setCookie(res: Response, value: string, expires: Date) {
    res.cookie(this.refreshTokenKey, value, {
      expires,
      httpOnly: true,
      domain: this.COOKIE_DOMAIN,
      secure: !isDev(this.configService),
      sameSite: !isDev(this.configService) ? 'none' : 'lax',
    });
  }

  private generateTokens(
    id: string,
    authVersion: number,
  ): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = { id, authVersion };

    const accessToken = this.jwtService.sign({ ...payload, type: 'access' }, {
      expiresIn: this.JWT_ACCESS_TOKEN_TTL,
    } as JwtSignOptions);

    const refreshToken = this.jwtService.sign({ ...payload, type: 'refresh' }, {
      expiresIn: this.JWT_REFRESH_TOKEN_TTL,
    } as JwtSignOptions);

    return {
      accessToken,
      refreshToken,
    };
  }
}
