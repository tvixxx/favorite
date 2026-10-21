import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
  ValidateBy,
} from 'class-validator';
import { ContentKind, Genre, WatchStatus } from '../generated/prisma/enums';
import { PRODUCTION_COUNTRY_CODES } from '../constants/production-countries';
import type { TvdbType } from './tvdb.types';
import { isTvdbId } from './tvdb-mapping';
import { PlainText } from '../common/validation/plain-text';
import {
  IsMediaYear,
  MAX_EPISODES,
  MAX_SEASONS,
} from '../common/validation/media-numbers';

export class TvdbSearchDto {
  @IsString() @Matches(/\S/) @MaxLength(200) @PlainText() public query: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(['movie', 'series'])
  public type?: TvdbType;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsMediaYear()
  public year?: number;
}
export class TvdbIdentityDto {
  @IsString()
  @ValidateBy({ name: 'tvdbId', validator: { validate: isTvdbId } })
  public id: string;
  @IsIn(['movie', 'series']) public type: TvdbType;
}
export class TvdbCollectionDto {
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsEnum(WatchStatus)
  public watchStatus?: WatchStatus;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  public seeLater?: boolean;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_EPISODES)
  public currentEpisode?: number;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_SEASONS)
  public currentSeason?: number;
}
export class TvdbImportDto extends TvdbIdentityDto {
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt()
  @Min(1)
  @Max(200)
  public actorLimit?: number;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(10)
  @MaxLength(500)
  @PlainText({ multiline: true })
  public distinctReason?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsUUID('4')
  public existingMovieId?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  @PlainText()
  public title?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(10000)
  @PlainText({ multiline: true })
  public description?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(['ru', 'en'])
  public descriptionLanguage?: 'ru' | 'en';
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsEnum(ContentKind)
  public contentKind?: ContentKind;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(50)
  @IsIn([...PRODUCTION_COUNTRY_CODES], { each: true })
  public countryCodes?: string[];
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(Object.values(Genre).length)
  @IsEnum(Genre, { each: true })
  public genres?: Genre[];
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @ValidateNested()
  @Type(() => TvdbCollectionDto)
  public collection?: TvdbCollectionDto;
}
