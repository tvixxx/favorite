import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentKind, Genre } from '../../generated/prisma/enums';
import type { Actor } from '../../generated/prisma/client';

export class MoviePosterResponse {
  @ApiProperty({ description: 'Ссылка на постер' })
  url: string;

  @ApiProperty({ type: String, nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  assetId: string | null;
}

export class MovieResponse {
  @ApiPropertyOptional({ enum: ContentKind, nullable: true })
  contentKind: ContentKind | null;
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Нормализованное название для проверки дублей' })
  titleNormalized: string;

  @ApiProperty({
    description: 'Название фильма',
    example: 'Титаник',
    type: String,
  })
  title: string;

  @ApiProperty({
    description: 'Дата выхода',
    example: '1993-01-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  publishDate: string | null;

  @ApiProperty({ type: MoviePosterResponse, nullable: true })
  poster: MoviePosterResponse | null;

  @ApiProperty({
    description: 'Описание фильма',
    example: 'Посмотрел фильм, хороший, не скучный, много драмы',
    type: String,
  })
  description: string;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 — страны производства',
    example: ['US', 'GB'],
    type: [String],
  })
  countryCodes: string[];

  @ApiProperty({
    description: 'Жанры',
    enum: Genre,
    isArray: true,
    example: ['ACTION', 'DRAMA'],
  })
  genres: Genre[];

  @ApiProperty({
    description: 'Средний балл отзывов (по шкале 0–10)',
    example: 8.4,
    nullable: true,
    type: Number,
  })
  averageRating: number | null;

  @ApiProperty({
    description: 'Признак сериала',
    example: false,
    type: Boolean,
  })
  isSerial: boolean;

  @ApiProperty({
    description: 'Количество сезонов',
    example: 1,
    type: Number,
    nullable: true,
  })
  seasonCount: number | null;

  @ApiProperty({
    description: 'Количество эпизодов',
    example: 5,
    type: Number,
    nullable: true,
  })
  episodeCount: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  createdById: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  posterId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  @ApiPropertyOptional({
    type: [Object],
    description: 'Актёры в детальном ответе и поиске',
  })
  actors?: Actor[];

  @ApiPropertyOptional({
    type: Object,
    description: 'Число отзывов и актёров в каталоге',
  })
  _count?: { reviews: number; actors: number };
}
