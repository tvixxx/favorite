import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../../generated/prisma/enums';

export class MovieResponse {
  @ApiProperty({
    description: 'Название фильма',
    example: 'Титаник',
    type: String,
  })
  title: string;

  @ApiProperty({
    description: 'Дата просмотра',
    example: '05.12.2024',
    type: String,
    nullable: true,
  })
  date?: string;

  @ApiProperty({
    description: 'Дата выхода',
    example: '1993',
    type: String,
    nullable: true,
  })
  publishDate?: string;

  @ApiProperty({
    description: 'Ссылка на постер фильма',
    example: 'https://example.com/',
    type: String,
    nullable: true,
  })
  imageUrl?: string;

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
    isArray: true,
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
    description: 'Средний балл отзывов (по шкале 1–10)',
    example: 8.4,
    nullable: true,
    type: Number,
  })
  averageRating: number | null;

  @ApiProperty({
    description: 'Рейтинг',
    example: '7',
    type: Number,
  })
  rate: number;

  @ApiProperty({
    description: 'Добавлен в избранное',
    example: false,
    type: Boolean,
  })
  isFavorite: boolean;

  @ApiProperty({
    description: 'Добавлен в посмотреть позже',
    example: false,
    type: Boolean,
  })
  seeLater: boolean;

  @ApiProperty({
    description: 'Признак сериала',
    example: false,
    type: Boolean,
  })
  isSerial: boolean;

  @ApiProperty({
    description: 'Количество сезонов',
    example: '1',
    type: Number,
  })
  seasonCount: number;

  @ApiProperty({
    description: 'Количество эпизодов',
    example: '5',
    type: Number,
  })
  episodeCount: number;

  @ApiProperty({
    description: 'Текущий сезон просмотра',
    example: 2,
    type: Number,
    nullable: true,
  })
  currentSeason?: number;

  @ApiProperty({
    description: 'Текущий эпизод просмотра',
    example: 5,
    type: Number,
    nullable: true,
  })
  currentEpisode?: number;

  @ApiProperty({
    description: 'ID актеров',
    example: ['dad213-dad21-d1213-dokojp2', 'dopdad1-1212dsx-cczcsq-d1221q'],
    type: [String],
  })
  actorIds: string[];
}
