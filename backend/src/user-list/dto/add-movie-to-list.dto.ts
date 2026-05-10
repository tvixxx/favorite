import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddMovieToListDto {
  @ApiProperty({
    description: 'ID фильма для добавления в список',
    example: '8b6a18f2-cdb7-4c88-becf-c5889feec57f',
  })
  @IsUUID('4')
  movieId: string;
}
