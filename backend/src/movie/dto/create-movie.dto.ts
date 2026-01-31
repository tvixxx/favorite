import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Genre as PrismaGenre } from '../../generated/prisma/enums';
import { Genre } from '../../constants';

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
    description: 'Дата просмотра',
    example: '05.12.2024',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  date?: string;

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
    description: 'Рейтинг',
    example: '7',
    type: Number,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(10)
  rate: number;

  @IsOptional()
  @IsEnum(Genre, { message: 'Неверный жанр' })
  genre?: PrismaGenre;

  @ApiProperty({
    description: 'Добавлен в избранное',
    example: false,
    type: Boolean,
  })
  @IsBoolean()
  @IsNotEmpty()
  isFavorite: boolean;

  @ApiProperty({
    description: 'ID избранного фильма',
    example: 'dasijo2-d12dsad-d12kx1-dxzv1',
    type: Number,
    nullable: true,
  })
  @IsInt()
  @IsOptional()
  favoriteId?: number;

  @ApiProperty({
    description: 'ID актеров',
    example: ['dad213-dad21-d1213-dokojp2', 'dopdad1-1212dsx-cczcsq-d1221q'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  actorIds: string[];
}
