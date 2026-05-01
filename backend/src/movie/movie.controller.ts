import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import MovieService from './movie.service';
import { CreateMovieRequest, MovieResponse } from './dto';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MoviesStatsResponse } from './dto/movies-stats.dto';
import { Genre } from '../generated/prisma/enums';
import { ReviewResponse } from '../review/dto/review.dto';

@ApiTags('Movies')
@Controller('movies')
export class MovieController {
  constructor(private readonly movieService: MovieService) {}

  @ApiOperation({
    summary: 'Получить список фильмов',
    description: 'Возвращает список всех фильмов',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Фильмы найдены',
    type: [MovieResponse],
  })
  @Get()
  public findAll(
    @Query('genre') genre?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
  ) {
    return this.movieService.findAll({
      genre: genre ? (genre as Genre) : undefined,
      publishDateFrom,
      publishDateTo,
    });
  }

  @ApiOperation({
    summary: 'Поиск фильмов',
    description: 'Поиск по названию и/или жанру',
  })
  @ApiOkResponse({
    description: 'Фильмы найдены',
    type: [MovieResponse],
  })
  @ApiNotFoundResponse({
    description: 'Фильмы не найдены',
  })
  @Get('search')
  public search(
    @Query('q') query: string,
    @Query('genre') genre?: string,
    @Query('publishDateFrom') publishDateFrom?: string,
    @Query('publishDateTo') publishDateTo?: string,
  ) {
    return this.movieService.search(query, {
      genre: genre ? (genre as Genre) : undefined,
      publishDateFrom,
      publishDateTo,
    });
  }

  @ApiOperation({
    summary: 'Получить статистику по фильмам и сериалам',
    description:
      'Возвращает статистику по всем фильмам, сериалам, просмотреть позже и избранному',
  })
  @ApiOkResponse({
    description: 'Статистика получена',
    type: MoviesStatsResponse,
  })
  @ApiNotFoundResponse({
    description: 'Статистика не получена',
  })
  @Get('stats')
  public getMoviesStats(): Promise<MoviesStatsResponse> {
    return this.movieService.getMoviesStats();
  }

  @ApiOperation({
    summary: 'Получить фильм по айди',
    description: 'Возвращает информацию о фильме',
  })
  @ApiOkResponse({
    description: 'Фильмы найден',
    type: MovieResponse,
  })
  @ApiNotFoundResponse({
    description: 'Фильм не найден',
    example: {
      status: HttpStatus.NOT_FOUND,
      message: 'Фильм не найден',
      timestamp: '2025-07-12',
      path: '/movie/:id',
    },
  })
  @Get(':id')
  public findById(@Param('id') id: string) {
    return this.movieService.findById(id);
  }

  @ApiOperation({
    summary: 'Получить актеров по айди фильма',
    description: 'Возвращает информацию о актерах у фильма',
  })
  @ApiOkResponse({
    description: 'Актеры найдены',
  })
  @ApiNotFoundResponse({
    description: 'Актеры не найдены',
  })
  @Get(':id/actors')
  public getActorsByMovieId(
    @Param('id') id: string,
    @Query('take') take?: string,
  ) {
    return this.movieService.getActorsByMovieId(id, take);
  }

  @ApiOperation({
    summary: 'Получить отзывы по айди фильма',
    description: 'Возвращает информацию об отзывах у фильма',
  })
  @ApiOkResponse({
    description:
      'Список отзывов к фильму. Пустой массив, если отзывов нет или фильма с таким id нет в связке.',
    type: [ReviewResponse],
  })
  @Get(':id/reviews')
  public getReviewsByMovieId(
    @Param('id') id: string,
    @Query('take') take?: string,
  ) {
    return this.movieService.getReviewsByMovieId(id, take);
  }

  @ApiOperation({
    summary: 'Создать фильм',
    description: 'Создает новый фильм',
  })
  @ApiOkResponse({
    description: 'Фильм создан',
    type: MovieResponse,
  })
  @Post()
  public create(@Body() dto: CreateMovieRequest) {
    return this.movieService.create(dto);
  }

  @ApiOperation({
    summary: 'Обновить фильм',
    description: 'Обновляет фильм целиком по ID',
  })
  @ApiOkResponse({
    description: 'Фильм обновлен',
    type: Boolean,
  })
  @ApiNotFoundResponse({
    description: 'Фильм не найден',
  })
  @Put(':id')
  public update(@Param('id') id: string, @Body() dto: CreateMovieRequest) {
    return this.movieService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Обновить фильм',
    description: 'Обновляет переданные поля фильма по ID',
  })
  @ApiOkResponse({
    description: 'Фильм обновлен частично',
    type: Boolean,
  })
  @ApiNotFoundResponse({
    description: 'Фильм не найден',
  })
  @Patch(':id')
  public patch(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMovieRequest>,
  ) {
    return this.movieService.patch(id, dto);
  }

  @ApiOperation({
    summary: 'Удалить фильм',
    description: 'Удаляет фильм по ID',
  })
  @ApiOkResponse({
    description: 'Фильм удален',
    type: Boolean,
  })
  @ApiNotFoundResponse({
    description: 'Фильм не найден',
  })
  @Delete(':id')
  public delete(@Param('id') id: string) {
    return this.movieService.delete(id);
  }
}
