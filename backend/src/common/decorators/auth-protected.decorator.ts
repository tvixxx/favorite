import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Authorization } from './authorization.decorator';

export function AuthProtected() {
  return applyDecorators(ApiBearerAuth(), Authorization());
}
