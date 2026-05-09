import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard, JwtGuard } from '../guards';

export function AdminOnly() {
  return applyDecorators(ApiBearerAuth(), UseGuards(JwtGuard, AdminGuard));
}
