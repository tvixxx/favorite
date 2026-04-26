import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { UserStatusModule } from '../user-status/user-status.module';
import { FriendshipModule } from '../friendship/friendship.module';

@Module({
  imports: [PrismaModule, UserStatusModule, FriendshipModule],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
