import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../../constants';

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
    description: 'Рейтинг',
    example: '7',
    type: Number,
  })
  rate: number;

  @ApiProperty({
    description: 'Жанр',
    example: 'ACTION',
    type: String,
  })
  genre?: Genre;

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
    description: 'ID актеров',
    example: ['dad213-dad21-d1213-dokojp2', 'dopdad1-1212dsx-cczcsq-d1221q'],
    type: [String],
  })
  actorIds: string[];
}
