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
import { ReviewModule } from './review/review.module';
import { ActorModule } from './actor/actor.module';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './common/middlewares';
import { AuthModule } from './auth/auth.module';
import { UserMovieModule } from './user-movie/user-movie.module';
import { BadgeModule } from './badge/badge.module';

@Module({
  imports: [
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
