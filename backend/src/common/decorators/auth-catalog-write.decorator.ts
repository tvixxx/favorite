import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthProtected } from './auth-protected.decorator';

export function AuthCatalogWrite() {
  return applyDecorators(
    Throttle({ default: { limit: 60, ttl: 60000 } }),
    AuthProtected(),
  );
}
