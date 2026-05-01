import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BadgeModule } from '../badge/badge.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [PrismaModule, BadgeModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
