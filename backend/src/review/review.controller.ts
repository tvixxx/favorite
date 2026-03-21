import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { ReviewResponse, CreateReviewDto } from './dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiOperation({
    summary: 'Создать отзыв',
    description: 'Создает новый отзыв',
  })
  @ApiOkResponse({
    description: 'Отзыв создан',
    type: ReviewResponse,
  })
  @Post()
  public create(@Body() dto: CreateReviewDto) {
    return this.reviewService.create(dto);
  }

  @ApiOperation({
    summary: 'Получить список отзывов',
    description: 'Возвращает список всех отзывов',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзывы найдены',
    type: [ReviewResponse],
  })
  @Get(':id')
  public findById(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }

  @ApiOperation({
    summary: 'Обновить отзыв',
    description: 'Обновляет отзыв по ID',
  })
  @ApiOkResponse({
    description: 'Отзыв обновлен',
    type: Boolean,
  })
  @ApiNotFoundResponse({
    description: 'Отзыв не найден',
  })
  @Put(':id')
  public update(@Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Удалить отзыв',
    description: 'Удаляет отзыв по ID',
  })
  @ApiOkResponse({
    description: 'Отзыв удален',
    type: Boolean,
  })
  @ApiNotFoundResponse({
    description: 'Отзыв не найден',
  })
  @Delete(':id')
  public delete(@Param('id') id: string) {
    return this.reviewService.delete(id);
  }
}
