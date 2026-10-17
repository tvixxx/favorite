import { PartialType } from '@nestjs/mapped-types';
import { CreateMovieRequest } from './create-movie.dto';
import { IsISO8601, IsOptional } from 'class-validator';

export class PatchMovieDto extends PartialType(CreateMovieRequest, {
  skipNullProperties: false,
}) {
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
}
