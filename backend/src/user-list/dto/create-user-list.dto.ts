import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateUserListDto {
  @ApiProperty({
    description: 'Название пользовательского списка',
    example: 'Осень 2026',
  })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty({
    required: false,
    description: 'Краткое описание списка',
    example: 'Что посмотреть в отпуске',
  })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;

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
  labels?: string[];
}
