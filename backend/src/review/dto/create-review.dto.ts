import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsString()
  text: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  rate: number;

  @IsUUID()
  movieId: string;
}
