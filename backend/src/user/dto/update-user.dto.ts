import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Genre } from '../../constants';

export class UpdateUserDto {
  @IsString({ message: 'Полное имя должно быть строкой' })
  @IsNotEmpty({ message: 'Полное имя не должно быть пустым' })
  @Length(3, 20, {
    message: 'Длина имени должна быть длинной от 3 до 20 символов',
  })
  fullName: string;

  // @IsString({ message: 'Email должен быть строкой' })
  // @IsNotEmpty({ message: 'Email не должно быть пустым' })
  // @IsEmail()
  // email: string;

  @IsArray({ message: 'Теги должны быть массивом строк' })
  @IsEnum(Genre, { message: 'Недопустимое значение тега', each: true })
  @IsOptional()
  tags: Genre[];
}
