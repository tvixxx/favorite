import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { BlackListNames } from '../decorators';
import { Genre } from '../../generated/prisma/enums';
import { Transform } from 'class-transformer';
import { PlainText } from '../../common/validation/plain-text';

export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @BlackListNames(['xxx', 'xx', 'nigger', 'slave', 'master'])
  @Length(3, 50)
  @PlainText()
  @Matches(/\S/)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsEnum(Genre, { message: 'Недопустимое значение тега' })
  @IsOptional()
  tags?: Genre | null;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9]).+$/, {
    message: 'Пароль должен содержать хотя бы одну заглавную букву и цифру',
  })
  password: string;
}
