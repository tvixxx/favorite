import { PartialType } from '@nestjs/mapped-types';
import { CreateMovieRequest } from './create-movie.dto';

export class PatchMovieDto extends PartialType(CreateMovieRequest) {}
