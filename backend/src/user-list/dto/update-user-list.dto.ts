import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PlainText } from '../../common/validation/plain-text';

export class UpdateUserListDto {
  @ApiProperty({
    required: false,
    description: 'Новое название списка',
    example: 'Вечерние фильмы',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 80)
  @Matches(/\S/)
  @PlainText()
  name?: string;

  @ApiProperty({
    required: false,
    description: 'Краткое описание списка',
    example: 'Подборка на выходные',
  })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  @PlainText({ multiline: true })
  description?: string | null;

  @ApiProperty({
    required: false,
    description: 'Цвет обложки списка (HEX)',
    example: '#007CFF',
  })
  @IsOptional()
  @IsHexColor()
  color?: string | null;

  @ApiProperty({
    required: false,
    description: 'Метки списка',
    example: ['уютно', 'детектив'],
    type: [String],
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(1, 24, { each: true })
  @PlainText({ each: true })
  labels?: string[];
}
