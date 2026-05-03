import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Genre } from '../../generated/prisma/enums';
import { PRODUCTION_COUNTRY_CODES } from '../../constants/production-countries';

function toUuidArray(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const arr = Array.isArray(value) ? value : [value];

  return arr.map(String).filter(Boolean);
}

function toGenreArray(value: unknown): Genre[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const arr = Array.isArray(value) ? value : [value];

  return arr.map(String).filter(Boolean) as Genre[];
}

function toCountryArray(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const arr = Array.isArray(value) ? value : [value];

  return arr.map(String).filter(Boolean);
}

export enum LeaderboardMovieSortBy {
  AVG_PERSONAL_RATE = 'avgPersonalRate',
  RATINGS_COUNT = 'ratingsCount',
  TITLE = 'title',
  PUBLISH_DATE = 'publishDate',
}

export enum LeaderboardMovieSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class LeaderboardTopMoviesQueryDto {
  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 20;

  @ApiPropertyOptional({
    enum: LeaderboardMovieSortBy,
    default: LeaderboardMovieSortBy.AVG_PERSONAL_RATE,
  })
  @IsOptional()
  @IsEnum(LeaderboardMovieSortBy)
  sortBy: LeaderboardMovieSortBy = LeaderboardMovieSortBy.AVG_PERSONAL_RATE;

  @ApiPropertyOptional({
    enum: LeaderboardMovieSortOrder,
    default: LeaderboardMovieSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(LeaderboardMovieSortOrder)
  sortOrder: LeaderboardMovieSortOrder = LeaderboardMovieSortOrder.DESC;

  @ApiPropertyOptional({
    description:
      'Минимум диапазона средней пользовательской оценки (0 — без оценок считается 0)',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  personalRateMin?: number;

  @ApiPropertyOptional({
    description: 'Максимум диапазона средней пользовательской оценки',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  personalRateMax?: number;

  @ApiPropertyOptional({ type: [String], description: 'Жанры (hasSome)' })
  @IsOptional()
  @Transform(({ value }) => toGenreArray(value))
  @IsArray()
  @IsEnum(Genre, { each: true })
  genres: Genre[] = [];

  @ApiPropertyOptional({ type: [String], description: 'Коды стран (hasSome)' })
  @IsOptional()
  @Transform(({ value }) => toCountryArray(value))
  @IsArray()
  @IsIn([...PRODUCTION_COUNTRY_CODES], { each: true })
  countryCodes: string[] = [];

  @ApiPropertyOptional({ description: 'Дата выхода, с (ISO)' })
  @IsOptional()
  @IsISO8601()
  publishDateFrom?: string;

  @ApiPropertyOptional({ description: 'Дата выхода, по (ISO)' })
  @IsOptional()
  @IsISO8601()
  publishDateTo?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Актёры: фильмы, где снялся любой из указанных',
  })
  @IsOptional()
  @Transform(({ value }) => toUuidArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  actorIds: string[] = [];
}
