import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Authorization } from '../common/decorators';
import { LeaderboardQueryDto } from './dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top-users')
  @Authorization()
  @ApiOperation({
    summary: 'Топ пользователей',
    description:
      'Рейтинг по сумме: все добавленные фильмы (не сериалы) + полностью досмотренные сериалы. Сортировка и пагинация на сервере.',
  })
  @ApiOkResponse({ description: 'Страница рейтинга' })
  public getTopUsers(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getTopUsers(query);
  }
}
