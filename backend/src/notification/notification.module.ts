import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { AnnouncementService } from './announcement.service';
import { NotificationCenterService } from './notification-center.service';
import {
  NotificationCenterController,
  AnnouncementAdminController,
} from './notification-center.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    NotificationController,
    NotificationCenterController,
    AnnouncementAdminController,
  ],
  providers: [
    NotificationService,
    AnnouncementService,
    NotificationCenterService,
  ],
  exports: [NotificationService, AnnouncementService],
})
export class NotificationModule {}
