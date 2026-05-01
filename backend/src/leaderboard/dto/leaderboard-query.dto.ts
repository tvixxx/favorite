import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum LeaderboardSortBy {
  TOTAL_SCORE = 'totalScore',
  REGISTERED_AT = 'registeredAt',
  FILMS = 'films',
  SERIALS_COMPLETED = 'serialsCompleted',
  SERIALS_TOTAL = 'serialsTotal',
}

export enum LeaderboardSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class LeaderboardQueryDto {
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
    enum: LeaderboardSortBy,
    default: LeaderboardSortBy.TOTAL_SCORE,
  })
  @IsOptional()
  @IsEnum(LeaderboardSortBy)
  sortBy: LeaderboardSortBy = LeaderboardSortBy.TOTAL_SCORE;

  @ApiPropertyOptional({
    enum: LeaderboardSortOrder,
    default: LeaderboardSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(LeaderboardSortOrder)
  sortOrder: LeaderboardSortOrder = LeaderboardSortOrder.DESC;
}
