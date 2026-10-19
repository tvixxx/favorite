import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { JwtGuard } from '../common/guards/auth.guard';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Multipart изображения', () => {
  it.each([undefined, 'false', 'true'])(
    'проверяет назначение и доступность скриншотов при флаге %s',
    async (flag) => {
      const media = {
        upload: jest.fn().mockResolvedValue({ id: 'asset-id' }),
        privateImage: jest.fn().mockResolvedValue(Buffer.from('private-image')),
      };
      const module = await Test.createTestingModule({
        controllers: [MediaController],
        providers: [
          { provide: MediaService, useValue: media },
          { provide: ConfigService, useValue: { get: () => flag } },
        ],
      })
        .overrideGuard(JwtGuard)
        .useValue({
          canActivate: (context: ExecutionContext) => {
            context.switchToHttp().getRequest<{ user: { id: string } }>().user =
              {
                id: 'user-id',
              };

            return true;
          },
        })
        .overrideGuard(ThrottlerGuard)
        .useValue({ canActivate: () => true })
        .compile();
      const app = module.createNestApplication();

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.listen(0, '127.0.0.1');

      try {
        await request(app.getHttpServer() as Server)
          .post('/uploads/images')
          .field('purpose', 'MOVIE_POSTER')
          .attach('file', Buffer.from('fixture-image'), 'poster.png')
          .expect(201);
        expect(media.upload).toHaveBeenCalledWith(
          Buffer.from('fixture-image'),
          'MOVIE_POSTER',
          'user-id',
        );
        await request(app.getHttpServer() as Server)
          .post('/uploads/images')
          .field('purpose', 'INVALID')
          .attach('file', Buffer.from('fixture-image'), 'poster.png')
          .expect(400);
        expect(media.upload).toHaveBeenCalledTimes(1);
        await request(app.getHttpServer() as Server)
          .post('/uploads/images')
          .field('purpose', 'FEEDBACK_SCREENSHOT')
          .attach('file', Buffer.from('fixture-image'), 'screenshot.png')
          .expect(flag === 'true' ? 201 : 503);
        await request(app.getHttpServer() as Server)
          .get('/uploads/images/00000000-0000-4000-8000-000000000002/full.webp')
          .expect(flag === 'true' ? 200 : 503);
        expect(media.upload).toHaveBeenCalledTimes(flag === 'true' ? 2 : 1);
        expect(media.privateImage).toHaveBeenCalledTimes(
          flag === 'true' ? 1 : 0,
        );
      } finally {
        await app.close();
      }
    },
  );
});
