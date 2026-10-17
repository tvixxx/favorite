import { Module } from '@nestjs/common';
import { MovieModule } from '../movie/movie.module';
import { UserMovieModule } from '../user-movie/user-movie.module';
import { AuthModule } from '../auth/auth.module';
import { TvdbProvider } from './tvdb-provider';
import { TvdbImportService } from './tvdb-import.service';
import { TvdbController } from './tvdb.controller';

@Module({
  imports: [AuthModule, MovieModule, UserMovieModule],
  providers: [TvdbProvider, TvdbImportService],
  controllers: [TvdbController],
})
export class TvdbModule {}
