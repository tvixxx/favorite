import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthOriginGuard } from '../common/guards/auth-origin.guard';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoveryRequestDto, ResetPasswordDto } from './password-recovery.dto';

@ApiTags('Password Recovery')
@Controller('auth/password')
@UseGuards(AuthOriginGuard)
export class PasswordRecoveryController {
  constructor(private readonly service: PasswordRecoveryService) {}

  @Post('request')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  public request(@Body() dto: RecoveryRequestDto) {
    return this.service.request(dto.email);
  }

  @Post('reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  public reset(@Body() dto: ResetPasswordDto) {
    return this.service.reset(dto.token, dto.password);
  }
}
