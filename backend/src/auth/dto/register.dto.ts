import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterRequest {
  @ApiProperty({
    description: 'Отображаемое имя',
    example: 'John doe',
    minLength: 3,
    maxLength: 50,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Имя должно быть строкой' })
  @IsNotEmpty({ message: 'Имя обязательно для заполнения' })
  @Matches(/\S/, { message: 'Имя не должно состоять из пробелов' })
  @MaxLength(50, { message: 'Имя не должно превышать 50 символов' })
  @MinLength(3, { message: 'Имя должно содержать не менее 3 символов' })
  fullName: string;

  @ApiProperty({
    description: 'Почтовый адрес',
    example: 'example@email.com',
  })
  @IsString({ message: 'Почта должна быть строкой' })
  @IsNotEmpty({ message: 'Почта обязательна для заполнения' })
  @IsEmail({}, { message: 'Некоректный формат електронной почты' })
  email: string;

  @ApiProperty({
    description: 'Пароль от аккаунта',
    example: 'qwerty123',
    minLength: 6,
    maxLength: 128,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Пароль обязателен для заполнения' })
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
  @MaxLength(128, { message: 'Пароль должен быть не более 128 символов' })
  password: string;
}
