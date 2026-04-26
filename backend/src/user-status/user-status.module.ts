import { Module } from '@nestjs/common';
import { UserStatusService } from './user-status.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UserStatusService],
  exports: [UserStatusService],
})
export class UserStatusModule {}
