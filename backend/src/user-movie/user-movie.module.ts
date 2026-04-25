import { Module } from '@nestjs/common';
import { UserMovieController } from './user-movie.controller';
import { UserMovieService } from './user-movie.service';

@Module({
  controllers: [UserMovieController],
  providers: [UserMovieService],
  exports: [UserMovieService],
})
export class UserMovieModule {}
