import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserMovieService } from './user-movie.service';
import { CreateUserMovieDto, UpdateUserMovieDto } from './dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Genre, WatchStatus } from '../generated/prisma/enums';

@ApiTags('User Movies')
@Controller('users/:userId/movies')
export class UserMovieController {
  constructor(private readonly userMovieService: UserMovieService) {}

  @ApiOperation({
    summary: 'Получить все фильмы пользователя',
    description: 'Возвращает все фильмы пользователя с персональными данными и фильтрами',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @Get()
  public findAllByUser(
    @Param('userId') userId: string,
    @Query('genre') genre?: string,
    @Query('personalRateMin') personalRateMin?: string,
    @Query('personalRateMax') personalRateMax?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('seeLater') seeLater?: string,
    @Query('watchStatus') watchStatus?: string,
  ) {
    return this.userMovieService.findAllByUser(userId, {
      genre: genre ? (genre as Genre) : undefined,
      personalRateMin: personalRateMin ? Number(personalRateMin) : undefined,
      personalRateMax: personalRateMax ? Number(personalRateMax) : undefined,
      publishDateFrom,
      publishDateTo,
      isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
      seeLater: seeLater !== undefined ? seeLater === 'true' : undefined,
      watchStatus: watchStatus ? (watchStatus as WatchStatus) : undefined,
    });
  }

  @ApiOperation({
    summary: 'Поиск по фильмам пользователя',
    description: 'Поиск по названию с фильтрами',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @Get('search')
  public searchUserMovies(
    @Param('userId') userId: string,
    @Query('q') query: string,
    @Query('genre') genre?: string,
    @Query('personalRateMin') personalRateMin?: string,
    @Query('personalRateMax') personalRateMax?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
    @Query('isFavorite') isFavorite?: string,
    @Query('seeLater') seeLater?: string,
    @Query('watchStatus') watchStatus?: string,
  ) {
    return this.userMovieService.searchUserMovies(userId, query, {
      genre: genre ? (genre as Genre) : undefined,
      personalRateMin: personalRateMin ? Number(personalRateMin) : undefined,
      personalRateMax: personalRateMax ? Number(personalRateMax) : undefined,
      publishDateFrom,
      publishDateTo,
      isFavorite: isFavorite !== undefined ? isFavorite === 'true' : undefined,
      seeLater: seeLater !== undefined ? seeLater === 'true' : undefined,
      watchStatus: watchStatus ? (watchStatus as WatchStatus) : undefined,
    });
  }

  @ApiOperation({
    summary: 'Получить избранные фильмы пользователя',
    description: 'Возвращает фильмы в избранном',
  })
  @ApiOkResponse({
    description: 'Избранные фильмы найдены',
  })
  @Get('favorites')
  public findFavorites(@Param('userId') userId: string) {
    return this.userMovieService.findFavoritesByUser(userId);
  }

  @ApiOperation({
    summary: 'Получить фильмы "посмотреть позже"',
    description: 'Возвращает фильмы отмеченные как "посмотреть позже"',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
  })
  @Get('see-later')
  public findSeeLater(@Param('userId') userId: string) {
    return this.userMovieService.findSeeLaterByUser(userId);
  }

  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description: 'Возвращает персональную статистику пользователя',
  })
  @ApiOkResponse({
    description: 'Статистика получена',
  })
  @Get('stats')
  public getUserStats(@Param('userId') userId: string) {
    return this.userMovieService.getUserStats(userId);
  }

  @ApiOperation({
    summary: 'Получить персональные данные о фильме',
    description: 'Возвращает персональные данные пользователя о конкретном фильме',
  })
  @ApiOkResponse({
    description: 'Данные найдены',
  })
  @ApiNotFoundResponse({
    description: 'Данные не найдены',
  })
  @Get(':movieId')
  public findByUserAndMovie(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
  ) {
    return this.userMovieService.findByUserAndMovie(userId, movieId);
  }

  @ApiOperation({
    summary: 'Добавить фильм пользователю',
    description: 'Создает связь пользователь-фильм с персональными данными',
  })
  @ApiOkResponse({
    description: 'Фильм добавлен',
  })
  @Post()
  public create(@Body() dto: CreateUserMovieDto) {
    return this.userMovieService.create(dto);
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
  @Patch(':movieId')
  public update(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
    @Body() dto: UpdateUserMovieDto,
  ) {
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
  @Delete(':movieId')
  public delete(
    @Param('userId') userId: string,
    @Param('movieId') movieId: string,
  ) {
    return this.userMovieService.delete(userId, movieId);
  }
}
