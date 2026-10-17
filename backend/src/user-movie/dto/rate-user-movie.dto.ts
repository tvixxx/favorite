import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsBoolean,
  ValidateIf,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlainText } from '../../common/validation/plain-text';

export class RateUserMovieDto {
  @ApiPropertyOptional({
    description: 'Отзыв содержит спойлеры',
    type: Boolean,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isSpoiler?: boolean;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  personalRate: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @PlainText({ multiline: true })
  reviewText?: string;
}
