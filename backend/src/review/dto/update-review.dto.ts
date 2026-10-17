import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsBoolean,
  ValidateIf,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { PlainText } from '../../common/validation/plain-text';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    description: 'Отзыв содержит спойлеры',
    type: Boolean,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isSpoiler?: boolean;

  @ApiProperty({
    description: 'Текст отзыва',
    example: 'Какой-то отзыв для примера',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @Matches(/\S/)
  @PlainText({ multiline: true })
  @MaxLength(500)
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
}
