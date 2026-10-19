import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  type INestApplication,
  type ExecutionContext,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { JwtGuard } from '../common/guards/auth.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('HTTP границы обратной связи', () => {
  let app: INestApplication<Server>;
  const id = '00000000-0000-4000-8000-000000000002';
  const feedback = {
    create: jest.fn().mockResolvedValue({ id }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    updateStatus: jest.fn().mockResolvedValue({ id, status: 'DONE' }),
  };

  let flag: string | undefined;

  beforeEach(async () => {
    flag = 'true';
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        { provide: FeedbackService, useValue: feedback },
        { provide: ConfigService, useValue: { get: () => flag } },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: { authorization?: string };
            user?: { id: string; role: string };
          }>();
          const role = req.headers.authorization;

          if (!role) {
            throw new UnauthorizedException();
          }

          req.user = { id: 'session-user', role };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => app.close());

  it.each([undefined, 'false', 'TRUE', '1'])(
    'закрывает обращения при выключенном или некорректном флаге %s даже администратору',
    async (value) => {
      flag = value;
      await request(app.getHttpServer())
        .get('/feedback/capabilities')
        .expect('Cache-Control', 'no-store')
        .expect(200, { feedback: false });
      await request(app.getHttpServer())
        .post('/feedback')
        .set('Authorization', 'ADMIN')
        .send({ type: 'BUG', message: 'Текст обращения' })
        .expect(503);
      await request(app.getHttpServer())
        .get('/feedback')
        .set('Authorization', 'ADMIN')
        .expect(503);
      await request(app.getHttpServer())
        .patch(`/feedback/${id}/status`)
        .set('Authorization', 'ADMIN')
        .send({ status: 'DONE' })
        .expect(503);
      expect(feedback.create).not.toHaveBeenCalled();
      expect(feedback.findAll).not.toHaveBeenCalled();
      expect(feedback.updateStatus).not.toHaveBeenCalled();
    },
  );

  it('сообщает о включённой обратной связи без авторизации', async () => {
    await request(app.getHttpServer())
      .get('/feedback/capabilities')
      .expect('Cache-Control', 'no-store')
      .expect(200, { feedback: true });
  });

  it('принимает запросы на собственном IPv4 loopback без автоматической перепривязки', async () => {
    const server = app.getHttpServer();

    expect(server.address()).toMatchObject({
      address: '127.0.0.1',
      family: 'IPv4',
    });
    const address = server.address();

    await request(server)
      .get('/feedback')
      .set('Authorization', 'ADMIN')
      .expect(200);
    await request(server)
      .get('/feedback')
      .set('Authorization', 'ADMIN')
      .expect(200);
    expect(server.address()).toEqual(address);
  });

  it('не принимает обращения и не раскрывает очередь гостю', async () => {
    await request(app.getHttpServer())
      .post('/feedback')
      .send({ type: 'BUG', message: 'Текст обращения' })
      .expect(401);
    await request(app.getHttpServer()).get('/feedback').expect(401);
    await request(app.getHttpServer())
      .patch(`/feedback/${id}/status`)
      .send({ status: 'DONE' })
      .expect(401);
  });

  it('принимает сообщение пользователя, но запрещает ему читать и менять очередь', async () => {
    await request(app.getHttpServer())
      .post('/feedback')
      .set('Authorization', 'USER')
      .send({ type: 'BUG', message: '  Текст обращения  ' })
      .expect(201, { id });
    expect(feedback.create).toHaveBeenCalledWith(
      'session-user',
      expect.objectContaining({ message: 'Текст обращения' }),
    );
    await request(app.getHttpServer())
      .get('/feedback')
      .set('Authorization', 'USER')
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/feedback/${id}/status`)
      .set('Authorization', 'USER')
      .send({ status: 'DONE' })
      .expect(403);
    expect(feedback.updateStatus).not.toHaveBeenCalled();
  });

  it('отклоняет подмену автора и недопустимый статус', async () => {
    await request(app.getHttpServer())
      .post('/feedback')
      .set('Authorization', 'USER')
      .send({ type: 'BUG', message: 'Текст обращения', userId: 'another' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/feedback/${id}/status`)
      .set('Authorization', 'ADMIN')
      .send({ status: 'UNKNOWN' })
      .expect(400);
    expect(feedback.create).not.toHaveBeenCalled();
    expect(feedback.updateStatus).not.toHaveBeenCalled();
  });

  it('отклоняет неверный идентификатор до изменения обращения', async () => {
    await request(app.getHttpServer())
      .patch('/feedback/not-a-uuid/status')
      .set('Authorization', 'ADMIN')
      .send({ status: 'DONE' })
      .expect(400);
    expect(feedback.updateStatus).not.toHaveBeenCalled();
  });

  it('даёт администратору очередь и сохраняет его решение', async () => {
    await request(app.getHttpServer())
      .get('/feedback?type=BUG&status=NEW')
      .set('Authorization', 'ADMIN')
      .expect(200, { items: [], total: 0 });
    await request(app.getHttpServer())
      .patch(`/feedback/${id}/status`)
      .set('Authorization', 'ADMIN')
      .send({ status: 'DONE' })
      .expect(200, { id, status: 'DONE' });
  });
});
