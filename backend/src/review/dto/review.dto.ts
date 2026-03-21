import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponse {
  @ApiProperty({
    description: 'Текст отзыва',
    example: 'Какой-то отзыв для примера',
    type: String,
  })
  text: string;

  @ApiProperty({
    description: 'Рейтинг отзыва',
    example: '7',
    type: Number,
  })
  rate: number;

  @ApiProperty({
    description: 'ID фильма/сериала',
    example: 'dad213-dad21-d1213-dokojp2',
    type: String,
  })
  movieId: string;
}
