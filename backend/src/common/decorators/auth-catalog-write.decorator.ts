import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthProtected } from './auth-protected.decorator';

export function AuthCatalogWrite() {
  return applyDecorators(
    UseGuards(ThrottlerGuard),
    Throttle({ default: { limit: 60, ttl: 60000 } }),
    AuthProtected(),
  );
}
