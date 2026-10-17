import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => app.close());

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ message: 'Hello World!1' });
  });

  it.each(['form', 'json'])(
    'не отражает HTML через демонстрационный POST /: %s',
    (format) => {
      const title = '<img src=x onerror=alert(1)>';

      return request(app.getHttpServer())
        .post('/')
        .type(format)
        .send({ title })
        .expect('Content-Type', /json/)
        .expect(404)
        .expect((response) => {
          expect(response.text).not.toContain(title);
        });
    },
  );
});
