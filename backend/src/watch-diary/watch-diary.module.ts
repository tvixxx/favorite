import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserMovieModule } from '../user-movie/user-movie.module';
import { WatchDiaryController } from './watch-diary.controller';
import { WatchDiaryService } from './watch-diary.service';

@Module({
  imports: [AuthModule, UserMovieModule],
  controllers: [WatchDiaryController],
  providers: [WatchDiaryService],
})
export class WatchDiaryModule {}
