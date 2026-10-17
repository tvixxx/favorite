import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import { setTimeout as delay } from 'node:timers/promises';
import cookieParser from 'cookie-parser';
import { featuresDatabase } from './features-database';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MovieModule } from '../src/movie/movie.module';
import { UserModule } from '../src/user/user.module';
import { ActorModule } from '../src/actor/actor.module';
import { UserListModule } from '../src/user-list/user-list.module';
import { LeaderboardModule } from '../src/leaderboard/leaderboard.module';
import { MessageModule } from '../src/message/message.module';
import { AdminModule } from '../src/admin/admin.module';
import { HttpThrottlerGuard } from '../src/common/guards/http-throttler.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PasswordRecoveryModule } from '../src/password-recovery/password-recovery.module';
import { smtpCapture } from './smtp-capture';
import { createRequire } from 'node:module';
import { ImageProcessor } from '../src/media/image-processor.service';
import { FeedbackModule } from '../src/feedback/feedback.module';

export async function performanceFixture(initialize = true) {
  const db = await featuresDatabase();
  const mediaDir = await mkdtemp('/private/tmp/favourite-performance-media-');
  const users = Array.from({ length: 100 }, () => randomUUID());
  const movies = Array.from({ length: 1000 }, () => randomUUID());
  const password = 'qa-performance-test-only';
  const hashed = await hash(password);
  const mail = initialize ? undefined : await smtpCapture();
  try {
    await db.prisma.user.createMany({
      data: users.map((id, i) => ({
        id,
        email: `performance-${i}@example.test`,
        fullName: `QA ${i}`,
        password: hashed,
        role: i === 0 ? 'ADMIN' : 'USER',
      })),
    });
    await db.prisma.moviePoster.createMany({
      data: movies.map((id) => ({
        id,
        url: 'http://127.0.0.1:8096/qa/poster.svg',
      })),
    });
    await db.prisma.movie.createMany({
      data: movies.map((id, i) => ({
        id,
        title: `QA Тайтл ${String(i).padStart(4, '0')}`,
        titleNormalized: `qa тайтл ${String(i).padStart(4, '0')}`,
        description: 'Синтетический тайтл для проверки страниц и нагрузки',
        isSerial: i % 2 === 1,
        seasonCount: i % 2 ? 2 : null,
        episodeCount: i % 2 ? 12 : null,
        genres: [i % 2 ? 'COMEDY' : 'DRAMA'],
        countryCodes: [i % 2 ? 'US' : 'RU'],
        posterId: id,
        publishDate: new Date('2020-01-01'),
        createdById: users[0],
      })),
    });
    for (const [index, userId] of users.entries()) {
      await db.prisma.userMovie.createMany({
        data: movies.slice(0, 200).map((movieId, i) => ({
          userId,
          movieId,
          isFavorite: i % 3 === 0,
          personalRate: (i + index) % 11,
          watchStatus: i % 4 === 0 ? 'COMPLETED' : 'NOT_STARTED',
          addedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 200 - i)),
        })),
      });
    }
    await db.prisma.friendship.createMany({
      data: users
        .filter((_, i) => i % 2 === 0)
        .map((id, i) => ({
          requesterId: id,
          addresseeId: users[i * 2 + 1],
          type: 'FRIEND_REQUEST',
          status: 'ACCEPTED',
        })),
    });
    const config = new ConfigService({
      JWT_SECRET: 'qa-performance-test-only-key',
      JWT_ACCESS_TOKEN_TTL: '30m',
      JWT_REFRESH_TOKEN_TTL: '1h',
      COOKIE_DOMAIN: '127.0.0.1',
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://127.0.0.1:8096',
      MEDIA_STORAGE: 'local',
      MEDIA_LOCAL_DIR: mediaDir,
      MEDIA_PUBLIC_BASE_URL: 'http://127.0.0.1:8096/api/media',
      SMTP_HOST: mail ? '127.0.0.1' : '',
      SMTP_PORT: String(mail?.port ?? 587),
      SMTP_SECURE: 'false',
      SMTP_FROM: 'favorite@example.test',
      SMTP_USER: '',
      SMTP_PASS: '',
      FRONTEND_ORIGIN: 'http://127.0.0.1:8096',
    });
    const testing = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 200 }]),
        PrismaModule,
        MovieModule,
        UserModule,
        ActorModule,
        UserListModule,
        LeaderboardModule,
        MessageModule,
        AdminModule,
        FeedbackModule,
        PasswordRecoveryModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: HttpThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(db.prisma)
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(ImageProcessor)
      .useFactory({
        factory: () => {
          if (initialize) return new ImageProcessor();
          // UI QA запускает настоящий собранный worker. Перед запуском нужен backend build.
          const compiled = createRequire(__filename)(
            '../dist/src/media/image-processor.service.js',
          ) as { ImageProcessor: new () => ImageProcessor };
          return new compiled.ImageProcessor();
        },
      })
      .compile();
    const app = testing.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    // Gateway читает origin из env. Значение только тестовое, после close восстанавливается.
    const originalOrigin = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'http://127.0.0.1:8096';
    const jwt = app.get(JwtService);
    const tokens = users.map((id) =>
      jwt.sign({ id, authVersion: 0, type: 'access' }, { expiresIn: '30m' }),
    );
    if (initialize) await app.init();
    db.queryDurations.length = 0;
    return {
      db,
      app,
      users,
      movies,
      tokens,
      password,
      mail,
      close: async () => {
        await app.close();
        await mail?.close();
        const deadline = Date.now() + 5000;
        while (fixtureBusy()) {
          if (Date.now() > deadline)
            throw new Error('QA запросы не завершились перед очисткой БД');
          await delay(20);
        }
        if (originalOrigin === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = originalOrigin;
        await db.close();
        await rm(mediaDir, { recursive: true, force: true });
      },
    };
    function fixtureBusy(): boolean {
      return (
        db.pool.waitingCount > 0 || db.pool.totalCount !== db.pool.idleCount
      );
    }
  } catch (error) {
    await mail?.close();
    await db.close();
    await rm(mediaDir, { recursive: true, force: true });
    throw error;
  }
}
