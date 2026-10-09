import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsUrl,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { Genre } from '../../generated/prisma/enums';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Полное имя должно быть строкой' })
  @IsNotEmpty({ message: 'Полное имя не должно быть пустым' })
  @Matches(/\S/)
  @Length(3, 50, {
    message: 'Длина имени должна быть от 3 до 50 символов',
  })
  fullName: string;

  @IsEnum(Genre, { message: 'Недопустимое значение тега' })
  @IsOptional()
  tags?: Genre | null;

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

export class PatchUserDto extends PartialType(UpdateUserDto, {
  skipNullProperties: false,
}) {}
