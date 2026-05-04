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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { ReviewResponse, CreateReviewDto, UpdateReviewDto } from './dto';
import { AuthProtected, Authorized } from '../common/decorators';
import type { User } from '../generated/prisma/client';

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
  @AuthProtected()
  @Post()
  public create(@Body() dto: CreateReviewDto, @Authorized() user: User) {
    return this.reviewService.create(dto, user.id);
  }

  @ApiOperation({
    summary: 'Получить отзыв по ID',
    description: 'Возвращает один отзыв по идентификатору',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Отзыв найден',
    type: ReviewResponse,
  })
  @ApiNotFoundResponse({
    description: 'Отзыв не найден',
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
    description: 'Отзыв обновлён',
    type: ReviewResponse,
  })
  @ApiNotFoundResponse({
    description: 'Отзыв не найден',
  })
  @ApiForbiddenResponse({
    description: 'Нельзя редактировать чужой отзыв',
  })
  @AuthProtected()
  @Put(':id')
  public update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @Authorized() user: User,
  ) {
    return this.reviewService.update(id, dto, user.id);
  }

  @ApiOperation({
    summary: 'Удалить отзыв',
    description: 'Удаляет отзыв по ID',
  })
  @ApiOkResponse({
    description: 'Идентификатор удалённого отзыва',
    schema: {
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440000',
    },
  })
  @ApiNotFoundResponse({
    description: 'Отзыв не найден',
  })
  @ApiForbiddenResponse({
    description: 'Нельзя удалить чужой отзыв',
  })
  @AuthProtected()
  @Delete(':id')
  public delete(@Param('id') id: string, @Authorized() user: User) {
    return this.reviewService.delete(id, user.id);
  }
}
