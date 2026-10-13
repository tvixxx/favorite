import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isAllowedOrigin } from '../utils/cors-policy';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const allowed =
      this.config.get<string>('CORS_ORIGINS') ??
      this.config.get<string>('FRONTEND_ORIGIN');

    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !isAllowedOrigin(request.headers.origin, allowed)
    ) {
      throw new ForbiddenException('Источник запроса не разрешён');
    }

    return true;
  }
}
