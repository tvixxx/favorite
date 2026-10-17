import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentKind, Genre, WatchStatus } from '../../generated/prisma/enums';
import {
  parseCountryFilters,
  parseGenreFilters,
} from '../../common/utils/parse-query-filters';
import {
  queryBoolean,
  queryDate,
  queryEnum,
  queryNumber,
} from '../../common/utils/query-value';

export class CollectionQueryDto {
  @IsOptional()
  @IsEnum(ContentKind)
  contentKind?: ContentKind;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  offset = 0;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    parseGenreFilters(value as string | string[]),
  )
  @IsEnum(Genre, { each: true })
  genres?: Genre[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    parseCountryFilters(value as string | string[]),
  )
  @IsString({ each: true })
  countryCode?: string[];

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryNumber(value, key, 0, 10),
  )
  @IsNumber()
  @Min(0)
  @Max(10)
  personalRateMin?: number;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryNumber(value, key, 0, 10),
  )
  @IsNumber()
  @Min(0)
  @Max(10)
  personalRateMax?: number;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryDate(value, key),
  )
  @IsString()
  publishDateFrom?: string;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryDate(value, key),
  )
  @IsString()
  publishDateTo?: string;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryBoolean(value, key),
  )
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryBoolean(value, key),
  )
  @IsBoolean()
  seeLater?: boolean;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryBoolean(value, key),
  )
  @IsBoolean()
  isSerial?: boolean;

  @IsOptional()
  @Transform(({ value, key }: { value: unknown; key: string }) =>
    queryEnum(value, key, Object.values(WatchStatus)),
  )
  @IsEnum(WatchStatus)
  watchStatus?: WatchStatus;
}
