import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { FeedbackType } from '../../generated/prisma/enums';

export class CreateFeedbackDto {
  @ApiProperty({
    enum: FeedbackType,
    description: 'Тип обращения',
    example: FeedbackType.IDEA,
  })
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @ApiProperty({
    description: 'Текст обращения',
    example: 'Не хватает импорта коллекции из файла',
  })
  @IsString()
  @Length(10, 1000)
  message: string;

  @ApiProperty({
    required: false,
    description: 'Почта для ответа. Может отличаться от почты аккаунта',
    example: 'me@mail.ru',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    required: false,
    description: 'Страница, с которой отправлено обращение (автоконтекст)',
    example: '/library/collection',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  pageUrl?: string;

  @ApiProperty({
    required: false,
    description: 'User-Agent браузера (автоконтекст)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;

  @ApiProperty({
    required: false,
    description: 'Размер вьюпорта (автоконтекст)',
    example: '1440x900',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  viewport?: string;
}
