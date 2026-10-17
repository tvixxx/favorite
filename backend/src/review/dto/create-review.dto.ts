import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsBoolean,
  ValidateIf,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { PlainText } from '../../common/validation/plain-text';

export class CreateReviewDto {
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

  @ApiProperty({
    description: 'ID фильма/сериала',
    example: 'dad213-dad21-d1213-dokojp2',
    type: String,
  })
  @IsUUID('4')
  movieId: string;
}
