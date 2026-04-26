import { Module } from '@nestjs/common';
import { BadgeController } from './badge.controller';
import { BadgeService } from './badge.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserMovieModule } from '../user-movie/user-movie.module';

@Module({
  imports: [PrismaModule, UserMovieModule],
  controllers: [BadgeController],
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
