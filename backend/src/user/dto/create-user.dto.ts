import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { BlackListNames } from '../decorators';
import { Genre } from '../../constants';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @BlackListNames(['xxx', 'xx', 'nigger', 'slave', 'master'])
  @Length(3, 20)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsArray({ message: 'Теги должны быть массивом строк' })
  @IsEnum(Genre, { message: 'Недопустимое значение тега', each: true })
  @IsOptional()
  tags: string[];

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  @Matches(/^(?=.*[A-Z])(?=.*[0-9]).+$/, {
    message: 'Пароль должен содержать хотя бы одну заглавную букву и цифру',
  })
  password: string;
}
