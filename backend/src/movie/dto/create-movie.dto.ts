import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Genre as PrismaGenre } from '../../generated/prisma/enums';
import { PRODUCTION_COUNTRY_CODES } from '../../constants/production-countries';

export class CreateMovieRequest {
  @ApiProperty({
    description: 'Название фильма',
    example: 'Титаник',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Дата выхода',
    example: '1993',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  publishDate?: string;

  @ApiProperty({
    description: 'Ссылка на постер фильма',
    example: 'https://example.com/',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Описание фильма',
    example: 'Посмотрел фильм, хороший, не скучный, много драмы',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description:
      'ISO 3166-1 alpha-2 — страны производства (несколько при ко-продукции)',
    example: ['US', 'GB'],
    type: [String],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Укажите хотя бы одну страну' })
  @IsIn([...PRODUCTION_COUNTRY_CODES], {
    each: true,
    message: 'Недопустимый код страны',
  })
  countryCodes: string[];

  @ApiProperty({
    description: 'Жанры (минимум один)',
    example: ['ACTION', 'DRAMA'],
    type: [String],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Укажите хотя бы один жанр' })
  @IsEnum(PrismaGenre, { each: true, message: 'Неверный жанр' })
  genres: PrismaGenre[];

  @ApiProperty({
    description: 'Признак сериала',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  @IsNotEmpty()
  isSerial: boolean;

  @ApiProperty({
    description: 'Количество сезонов',
    example: '2',
    type: Number,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  seasonCount?: number;

  @ApiProperty({
    description: 'Количество эпизодов',
    example: '10',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  episodeCount?: number;

  @ApiProperty({
    description: 'ID актеров',
    example: ['dad213-dad21-d1213-dokojp2', 'dopdad1-1212dsx-cczcsq-d1221q'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  actorIds: string[];
}
