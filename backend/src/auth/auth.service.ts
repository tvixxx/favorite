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

    return this.auth(res, user.id);
  }

  public async login(res: Response, dto: LoginRequest) {
    const { email, password } = dto;

    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь с такой почтой не найден');
    }

    const isValidPassword = await verify(user.password, password);

    if (!isValidPassword) {
      throw new NotFoundException('Пользователь не найден');
    }

    return this.auth(res, user.id);
  }

  public async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies[this.refreshTokenKey];

    if (!refreshToken) {
      throw new UnauthorizedException('Не действительный refresh-token');
    }

    const payload: JwtPayload = await this.jwtService.verifyAsync(refreshToken);

    if (payload) {
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
        },
      });

      if (!user) {
        throw new NotFoundException('Пользователь не найден');
      }

      return this.auth(res, user.id);
    }
  }

  public async logout(res: Response) {
    this.setCookie(res, this.refreshTokenKey, new Date(0));

    return true;
  }

  public async validate(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    return user;
  }

  private auth(res: Response, id: string) {
    const { accessToken, refreshToken } = this.generateTokens(id);
    const expiresTimeMs = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * parseInt(this.JWT_REFRESH_TOKEN_TTL),
    );

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

  private generateTokens(id: string): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = { id };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.JWT_ACCESS_TOKEN_TTL,
    } as JwtSignOptions);

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.JWT_REFRESH_TOKEN_TTL,
    } as JwtSignOptions);

    return {
      accessToken,
      refreshToken,
    };
  }
}
