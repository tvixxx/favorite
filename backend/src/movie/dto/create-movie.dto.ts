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
  IsUrl,
  MaxLength,
  ArrayMinSize,
  Max,
  Min,
  Matches,
  ValidateNested,
  IsDateString,
  ValidateIf,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { UpdateUserMovieDto } from '../../user-movie/dto/update-user-movie.dto';
import {
  ContentKind,
  Genre as PrismaGenre,
} from '../../generated/prisma/enums';
import { PRODUCTION_COUNTRY_CODES } from '../../constants/production-countries';
import { normalizeGenre } from '../../common/utils/normalize-genre';

export class CreateMovieRequest {
  @ApiProperty({
    description: 'Название фильма',
    example: 'Титаник',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/\S/, { message: 'Введите название фильма' })
  title: string;

  @ApiProperty({
    description: 'Дата выхода',
    example: '1993',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  publishDate?: string | null;

  @ApiProperty({
    description: 'Ссылка на постер фильма',
    example: 'https://example.com/',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'ID загруженного постера',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  posterAssetId?: string | null;

  @ApiProperty({
    description: 'Описание фильма',
    example: 'Посмотрел фильм, хороший, не скучный, много драмы',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Введите описание фильма' })
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
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(normalizeGenre) : value,
  )
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

  @ApiPropertyOptional({
    enum: ContentKind,
    description: 'Категория. Отсутствует у старых клиентов.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(ContentKind)
  contentKind?: ContentKind;

  @ApiPropertyOptional({
    description: 'Только ADMIN: пояснение различия одноимённых произведений',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(10)
  @MaxLength(500)
  distinctReason?: string;

  @ApiProperty({
    description: 'Количество сезонов',
    minimum: 1,
    maximum: 1000,
    example: '2',
    type: Number,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(1000)
  seasonCount?: number;

  @ApiProperty({
    description: 'Количество эпизодов',
    minimum: 1,
    maximum: 10000,
    example: '10',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  episodeCount?: number;

  @ApiProperty({
    description: 'ID актеров',
    example: ['dad213-dad21-d1213-dokojp2', 'dopdad1-1212dsx-cczcsq-d1221q'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  actorIds: string[];

  @ApiPropertyOptional({ type: UpdateUserMovieDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserMovieDto)
  collection?: UpdateUserMovieDto;
}
