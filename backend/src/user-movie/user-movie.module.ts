import { Module } from '@nestjs/common';
import { UserMovieController } from './user-movie.controller';
import { UserMovieService } from './user-movie.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserMovieController],
  providers: [UserMovieService],
  exports: [UserMovieService],
})
export class UserMovieModule {}
