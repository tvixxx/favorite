import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import MovieService from '../movie/movie.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService, MovieService],
})
export class ReviewModule {}
