import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Genre } from '../../constants';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateUserDto {
  @IsString({ message: 'Полное имя должно быть строкой' })
  @IsNotEmpty({ message: 'Полное имя не должно быть пустым' })
  @Length(3, 20, {
    message: 'Длина имени должна быть длинной от 3 до 20 символов',
  })
  fullName: string;

  @IsArray({ message: 'Теги должны быть массивом строк' })
  @IsEnum(Genre, { message: 'Недопустимое значение тега', each: true })
  @IsOptional()
  tags: Genre[];

  @IsOptional()
  @IsUUID('4')
  avatarAssetId?: string | null;

  @IsOptional()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  avatarUrl?: string | null;
}

export class PatchUserDto extends PartialType(UpdateUserDto) {}
