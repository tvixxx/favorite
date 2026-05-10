import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserListController } from './user-list.controller';
import { UserListService } from './user-list.service';

@Module({
  imports: [AuthModule],
  controllers: [UserListController],
  providers: [UserListService],
  exports: [UserListService],
})
export class UserListModule {}
