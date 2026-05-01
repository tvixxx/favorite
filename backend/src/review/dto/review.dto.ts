import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewUserSnippetDto {
  @ApiProperty({ description: 'ID пользователя' })
  id: string;

  @ApiProperty({ description: 'Отображаемое имя' })
  fullName: string;

  @ApiProperty({ description: 'Email' })
  email: string;
}

export class ReviewResponse {
  @ApiProperty({ description: 'ID отзыва' })
  id: string;

  @ApiProperty({
    description: 'Текст отзыва',
    example: 'Хороший фильм, рекомендую',
  })
  text: string;

  @ApiProperty({
    description: 'Оценка от 0 до 10',
    example: 7,
    minimum: 0,
    maximum: 10,
  })
  rate: number;

  @ApiProperty({ description: 'ID автора отзыва' })
  userId: string;

  @ApiProperty({ description: 'ID фильма / сериала' })
  movieId: string;

  @ApiProperty({
    description: 'Дата создания',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата обновления',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Автор',
    type: ReviewUserSnippetDto,
  })
  user?: ReviewUserSnippetDto;
}
