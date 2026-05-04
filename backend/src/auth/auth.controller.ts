import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterRequest } from './dto/register.dto';
import { LoginRequest } from './dto/login.dto';
import { AuthResponse } from './dto/auth.dto';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';

@ApiTags('Authorization')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Создание аккаунта',
    description: 'Создает новый аккаунт пользователя',
  })
  @ApiOkResponse({
    type: AuthResponse,
  })
  @ApiBadRequestResponse({
    description: 'некоректные входные данные',
  })
  @ApiConflictResponse({
    description: 'Пользователь с такой почтой уже существует',
  })
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  public async register(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterRequest,
  ) {
    return await this.authService.register(res, dto);
  }

  @ApiOperation({
    summary: 'Вход в аккаунт',
    description: 'Авторизует пользователя и выдает токен доступа',
  })
  @ApiOkResponse({
    type: AuthResponse,
  })
  @ApiBadRequestResponse({
    description: 'Некоректные входные данные',
  })
  @ApiNotFoundResponse({
    description: 'Пользователь с такой почтой не найден',
  })
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async login(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginRequest,
  ) {
    return await this.authService.login(res, dto);
  }

  @ApiOperation({
    summary: 'Обновление токена',
    description: 'Генерирует новый токен доступа',
  })
  @ApiOkResponse({
    type: AuthResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Не действительный refresh-token',
  })
  @Throttle({ default: { limit: 45, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.authService.refresh(req, res);
  }

  @ApiOperation({
    summary: 'Выход из системы',
  })
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(@Res({ passthrough: true }) res: Response) {
    return await this.authService.logout(res);
  }

  @SkipThrottle()
  @AuthProtected()
  @Get('@me')
  @HttpCode(HttpStatus.OK)
  public async me(@Authorized() user: User) {
    return user;
  }
}
