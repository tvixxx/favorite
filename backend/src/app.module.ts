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
    UserMovieModule,
    BadgeModule,
    FriendshipModule,
    MessageModule,
    UserStatusModule,
    LeaderboardModule,
    UserListModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '/movies', method: RequestMethod.GET });
  }
}
