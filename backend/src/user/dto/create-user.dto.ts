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

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @BlackListNames(['xxx', 'xx', 'nigger', 'slave', 'master'])
  @Length(3, 20)
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
