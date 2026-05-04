import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthProtected } from '../common/decorators';
import { LeaderboardQueryDto, LeaderboardTopMoviesQueryDto } from './dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top-users')
  @AuthProtected()
  @ApiOperation({
    summary: 'Топ пользователей',
    description:
      'Рейтинг по сумме: все добавленные фильмы (не сериалы) + полностью досмотренные сериалы. Сортировка и пагинация на сервере.',
  })
  @ApiOkResponse({ description: 'Страница рейтинга' })
  public getTopUsers(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getTopUsers(query);
  }

  @Get('top-movies')
  @AuthProtected()
  @ApiOperation({
    summary: 'Топ фильмов и сериалов по пользовательской оценке',
    description:
      'Среднее personal_rate по user_movies; без оценок считается 0 для фильтра и сортировки. Фильтры: жанры, страны, дата выхода, актёры (любой из списка).',
  })
  @ApiOkResponse({ description: 'Страница топа фильмов' })
  public getTopMovies(@Query() query: LeaderboardTopMoviesQueryDto) {
    return this.leaderboardService.getTopMovies(query);
  }
}
