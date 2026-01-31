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
  public findAll() {
    return this.movieService.findAll();
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
    description: 'Отзывы найдены',
  })
  @ApiNotFoundResponse({
    description: 'Отзывы не найдены',
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
