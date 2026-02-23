import { ApiProperty } from '@nestjs/swagger';

export class MoviesStatsResponse {
  @ApiProperty({
    description: 'Все фильмы',
    example: '15',
    type: String,
  })
  allMovies: number;

  @ApiProperty({
    description: 'Все избранные фильмы',
    example: '5',
    type: String,
  })
  allFavorites: number;

  @ApiProperty({
    description: 'Все сериалы',
    example: '7',
    type: String,
  })
  allSerials: number;

  @ApiProperty({
    description: 'Посмотреть позже',
    example: '2',
    type: String,
  })
  allSeeLater: number;
}
