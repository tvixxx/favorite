import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserMovieService } from './user-movie.service';
import { CreateUserMovieBodyDto, UpdateUserMovieDto } from './dto';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WatchStatus } from '../generated/prisma/enums';
import {
  parseCountryFilters,
  parseGenreFilters,
} from '../common/utils/parse-query-filters';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';

@ApiTags('User Movies')
@Controller('users/:userId/movies')
export class UserMovieController {
  constructor(private readonly userMovieService: UserMovieService) {}

  private ensureSelf(paramUserId: string, user: { id: string }): void {
    if (paramUserId !== user.id) {
      throw new ForbiddenException();
    }
  }

  @ApiOperation({
    summary: 'Получить все фильмы пользователя',
    description:
      'Возвращает все фильмы пользователя с персональными данными и фильтрами',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @AuthProtected()
  @Get()
  public findAllByUser(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Query('genres') genres?: string | string[],
    @Query('countryCode') countryCode?: string | string[],
    @Query('personalRateMin') personalRateMin?: string,
    @Query('personalRateMax') personalRateMax?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('seeLater') seeLater?: string,
    @Query('watchStatus') watchStatus?: string,
    @Query('isSerial') isSerial?: string,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.findAllByUser(userId, {
      genres: parseGenreFilters(genres),
      countryCodes: parseCountryFilters(countryCode),
      personalRateMin: personalRateMin ? Number(personalRateMin) : undefined,
      personalRateMax: personalRateMax ? Number(personalRateMax) : undefined,
      publishDateFrom,
      publishDateTo,
      isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
      seeLater: seeLater !== undefined ? seeLater === 'true' : undefined,
      watchStatus: watchStatus ? (watchStatus as WatchStatus) : undefined,
      isSerial: isSerial !== undefined ? isSerial === 'true' : undefined,
    });
  }

  @ApiOperation({
    summary: 'Поиск по фильмам пользователя',
    description: 'Поиск по названию с фильтрами',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @AuthProtected()
  @Get('search')
  public searchUserMovies(
    @Param('userId') userId: string,
    @Authorized() user: User,
    @Query('q') query: string,
    @Query('genres') genres?: string | string[],
    @Query('countryCode') countryCode?: string | string[],
    @Query('personalRateMin') personalRateMin?: string,
    @Query('personalRateMax') personalRateMax?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('seeLater') seeLater?: string,
    @Query('watchStatus') watchStatus?: string,
    @Query('isSerial') isSerial?: string,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.searchUserMovies(userId, query, {
      genres: parseGenreFilters(genres),
      countryCodes: parseCountryFilters(countryCode),
      personalRateMin: personalRateMin ? Number(personalRateMin) : undefined,
      personalRateMax: personalRateMax ? Number(personalRateMax) : undefined,
      publishDateFrom,
      publishDateTo,
      isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
      seeLater: seeLater !== undefined ? seeLater === 'true' : undefined,
      watchStatus: watchStatus ? (watchStatus as WatchStatus) : undefined,
      isSerial: isSerial !== undefined ? isSerial === 'true' : undefined,
    });
  }

  @ApiOperation({
    summary: 'Получить избранные фильмы пользователя',
    description: 'Возвращает фильмы в избранном',
  })
  @ApiOkResponse({
    description: 'Избранные фильмы найдены',
  })
  @AuthProtected()
  @Get('favorites')
  public findFavorites(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.findFavoritesByUser(userId);
  }

  @ApiOperation({
    summary: 'Получить фильмы "посмотреть позже"',
    description: 'Возвращает фильмы отмеченные как "посмотреть позже"',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @AuthProtected()
  @Get('see-later')
  public findSeeLater(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.findSeeLaterByUser(userId);
  }

  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description: 'Возвращает персональную статистику пользователя',
  })
  @ApiOkResponse({
    description: 'Статистика получена',
  })
  @AuthProtected()
  @Get('stats')
  public getUserStats(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.getUserStats(userId);
  }

  @ApiOperation({
    summary: 'Получить расширенную аналитику пользователя',
    description:
      'Возвращает персональные инсайты: динамику, топ-жанры, прогресс статусов и сериалы в процессе',
  })
  @ApiOkResponse({
    description: 'Аналитика получена',
  })
  @AuthProtected()
  @Get('analytics')
  public getUserAnalytics(
    @Param('userId') userId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.getUserAnalytics(userId);
  }

  @ApiOperation({
    summary: 'Получить персональные данные о фильме',
    description:
      'Возвращает персональные данные пользователя о конкретном фильме',
  })
  @ApiOkResponse({
    description: 'Данные найдены',
  })
  @ApiNotFoundResponse({
    description: 'Данные не найдены',
  })
  @AuthProtected()
  @Get(':movieId')
  public async findByUserAndMovie(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    const row = await this.userMovieService.findByUserAndMovie(userId, movieId);

    if (!row) {
      throw new NotFoundException();
    }

    return row;
  }

  @ApiOperation({
    summary: 'Добавить фильм пользователю',
    description: 'Создает связь пользователь-фильм с персональными данными',
  })
  @ApiOkResponse({
    description: 'Фильм добавлен',
  })
  @ApiBadRequestResponse({
    description:
      'Некорректный прогресс (например, прогресс сезонов/эпизодов для не-сериала)',
  })
  @AuthProtected()
  @Post()
  public create(
    @Param('userId') userId: string,
    @Body() dto: CreateUserMovieBodyDto,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.create(userId, dto);
  }

  @ApiOperation({
    summary: 'Обновить персональные данные о фильме',
    description: 'Обновляет персональные данные пользователя о фильме',
  })
  @ApiOkResponse({
    description: 'Данные обновлены',
  })
  @ApiNotFoundResponse({
    description: 'Данные не найдены',
  })
  @ApiBadRequestResponse({
    description: 'Некорректные значения прогресса просмотра',
  })
  @AuthProtected()
  @Patch(':movieId')
  public update(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
    @Body() dto: UpdateUserMovieDto,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.update(userId, movieId, dto);
  }

  @ApiOperation({
    summary: 'Удалить связь пользователь-фильм',
    description: 'Удаляет персональные данные пользователя о фильме',
  })
  @ApiOkResponse({
    description: 'Данные удалены',
  })
  @ApiNotFoundResponse({
    description: 'Данные не найдены',
  })
  @AuthProtected()
  @Delete(':movieId')
  public delete(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
    @Authorized() user: User,
  ) {
    this.ensureSelf(userId, user);
    return this.userMovieService.delete(userId, movieId);
  }
}
