import { Module } from '@nestjs/common';
import MovieService from './movie.service';
import { MovieController } from './movie.controller';
import { UserMovieModule } from '../user-movie/user-movie.module';

@Module({
  imports: [UserMovieModule],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService],
})
export class MovieModule {}
