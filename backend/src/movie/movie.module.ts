import { Module } from '@nestjs/common';
import MovieService from './movie.service';
import { MovieController } from './movie.controller';
import { UserMovieModule } from '../user-movie/user-movie.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [UserMovieModule, MediaModule],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService],
})
export class MovieModule {}
