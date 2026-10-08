import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  Matches,
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
  @Matches(/\S/)
  text: string;

  @ApiProperty({
    description: 'Рейтинг отзыва',
    example: 7,
    minimum: 0,
    maximum: 10,
  })
  @IsInt()
  @Min(0)
  @Max(10)
  rate: number;

  @ApiProperty({
    description: 'ID фильма/сериала',
    example: 'dad213-dad21-d1213-dokojp2',
    type: String,
  })
  @IsUUID('4')
  movieId: string;
}
