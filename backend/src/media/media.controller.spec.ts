import { Test } from '@nestjs/testing';
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import type { Server } from 'node:http';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { JwtGuard } from '../common/guards/auth.guard';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Multipart изображения', () => {
  it('принимает один файл и его назначение без лишних частей', async () => {
    const media = { upload: jest.fn().mockResolvedValue({ id: 'asset-id' }) };
    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: media }],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ user: { id: string } }>().user = {
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
    await app.init();

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
    } finally {
      await app.close();
    }
  });
});
