import { Global, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController, TimezoneController } from './user.controller';
import { MediaModule } from '../media/media.module';

@Global()
@Module({
  imports: [MediaModule],
  controllers: [UserController, TimezoneController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
