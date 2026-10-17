import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { MovieModule } from './movie/movie.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReviewModule } from './review/review.module';
import { ActorModule } from './actor/actor.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './common/middlewares';
import { AuthModule } from './auth/auth.module';
import { UserMovieModule } from './user-movie/user-movie.module';
import { BadgeModule } from './badge/badge.module';
import { FriendshipModule } from './friendship/friendship.module';
import { MessageModule } from './message/message.module';
import { UserStatusModule } from './user-status/user-status.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { UserListModule } from './user-list/user-list.module';
import { NotificationModule } from './notification/notification.module';
import { FeedbackModule } from './feedback/feedback.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpThrottlerGuard } from './common/guards/http-throttler.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MediaModule } from './media/media.module';
import { HealthController } from './health/health.controller';
import { AdminModule } from './admin/admin.module';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module';
import { TvdbModule } from './tvdb/tvdb.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 200,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UserModule,
    MovieModule,
    ReviewModule,
    ActorModule,
    AuthModule,
    PasswordRecoveryModule,
    TvdbModule,
    UserMovieModule,
    BadgeModule,
    FriendshipModule,
    MessageModule,
    UserStatusModule,
    LeaderboardModule,
    UserListModule,
    NotificationModule,
    FeedbackModule,
    MediaModule,
    AdminModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '/movies', method: RequestMethod.GET });
  }
}
