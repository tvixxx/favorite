import { forwardRef, Module } from '@nestjs/common';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    forwardRef(() => MessageModule),
  ],
  controllers: [FriendshipController],
  providers: [FriendshipService],
  exports: [FriendshipService],
})
export class FriendshipModule {}
