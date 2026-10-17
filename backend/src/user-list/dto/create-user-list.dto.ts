import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { PlainText } from '../../common/validation/plain-text';

export class CreateUserListDto {
  @ApiProperty({
    description: 'Название пользовательского списка',
    example: 'Осень 2026',
  })
  @IsString()
  @Length(2, 80)
  @Matches(/\S/)
  @PlainText()
  name: string;

  @ApiProperty({
    required: false,
    description: 'Краткое описание списка',
    example: 'Что посмотреть в отпуске',
  })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  @PlainText({ multiline: true })
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Цвет обложки списка (HEX)',
    example: '#FF0032',
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({
    required: false,
    description: 'Метки списка',
    example: ['в дорогу', 'с друзьями'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(1, 24, { each: true })
  @PlainText({ each: true })
  labels?: string[];
}
