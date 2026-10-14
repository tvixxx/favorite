import { Module } from '@nestjs/common';
import { UserMovieController } from './user-movie.controller';
import { UserMovieService } from './user-movie.service';
import { AuthModule } from '../auth/auth.module';
import { CollectionImportController } from './collection-import.controller';
import { CollectionImportService } from './collection-import.service';

@Module({
  imports: [AuthModule],
  controllers: [UserMovieController, CollectionImportController],
  providers: [UserMovieService, CollectionImportService],
  exports: [UserMovieService],
})
export class UserMovieModule {}
