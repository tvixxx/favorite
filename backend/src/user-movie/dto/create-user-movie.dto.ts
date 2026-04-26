import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { WatchStatus } from '../../generated/prisma/enums';

export class CreateUserMovieBodyDto {
  @ApiProperty({
    description: 'ID фильма',
    example: 'dad213-dad21-d1213-dokojp2',
  })
  @IsUUID('4')
  movieId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  seeLater?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  personalRate?: number;

  @ApiProperty({ required: false, enum: WatchStatus })
  @IsOptional()
  @IsEnum(WatchStatus)
  watchStatus?: WatchStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  currentSeason?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  currentEpisode?: number;
}
