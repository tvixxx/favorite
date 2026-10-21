import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  IsUrl,
  IsUUID,
  MaxLength,
  Matches,
  IsTimeZone,
  ValidateIf,
} from 'class-validator';
import { Genre } from '../../generated/prisma/enums';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { PlainText } from '../../common/validation/plain-text';

export class UpdateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().replace(/^@/, '').toLowerCase() || null
      : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{3,32}$/, {
    message: 'Логин: 3–32 латинские буквы, цифры или знак _',
  })
  username?: string | null;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  quickAddEnabled?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  watchTonightEnabled?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  collectionFilesEnabled?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  notifyNewMessages?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  notifyFriendRequests?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  notifyRecommendations?: boolean;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(80)
  @IsTimeZone()
  timezone?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Полное имя должно быть строкой' })
  @IsNotEmpty({ message: 'Полное имя не должно быть пустым' })
  @Matches(/\S/)
  @PlainText()
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
