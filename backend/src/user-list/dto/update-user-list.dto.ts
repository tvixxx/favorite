import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateUserListDto {
  @ApiProperty({
    required: false,
    description: 'Новое название списка',
    example: 'Вечерние фильмы',
  })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiProperty({
    required: false,
    description: 'Краткое описание списка',
    example: 'Подборка на выходные',
  })
  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Метки списка',
    example: ['уютно', 'детектив'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(1, 24, { each: true })
  labels?: string[];
}
