import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadgeService } from './badge.service';
import { AuthProtected } from '../common/decorators';

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
  async getUserBadges(@Param('userId') userId: string) {
    return this.badgeService.getUserBadges(userId);
  }
}
