import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadgeService } from './badge.service';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';

@ApiTags('Badges')
@Controller('users/:userId/badges')
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  @Get()
  @AuthProtected()
  @ApiOperation({ summary: 'Получить все бейджи пользователя' })
  @ApiParam({ name: 'userId', description: 'ID пользователя' })
  @ApiResponse({
    status: 200,
    description: 'Список бейджей с прогрессом',
  })
  async getUserBadges(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    if (userId !== user.id) {
      throw new ForbiddenException(
        'Нет доступа к достижениям этого пользователя',
      );
    }

    return this.badgeService.getUserBadges(userId);
  }
}
