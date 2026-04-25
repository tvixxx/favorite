import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Текст отзыва',
    example: 'Какой-то отзыв для примера',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  text: string;

  @ApiProperty({
    description: 'Рейтинг отзыва',
    example: '7',
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @Max(10)
  rate: number;

  @ApiProperty({
    description: 'ID пользователя',
    example: 'dad213-dad21-d1213-dokojp2',
    type: String,
  })
  @IsUUID('4')
  userId: string;

  @ApiProperty({
    description: 'ID фильма/сериала',
    example: 'dad213-dad21-d1213-dokojp2',
    type: String,
  })
  @IsUUID('4')
  movieId: string;
}
