import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessageModule } from '../message/message.module';
import { AdminController, UsageController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [AuthModule, MessageModule],
  controllers: [AdminController, UsageController],
  providers: [AdminService, AdminAnalyticsService],
})
export class AdminModule {}
