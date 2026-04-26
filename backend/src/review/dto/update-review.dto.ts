import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateReviewDto {
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
}
