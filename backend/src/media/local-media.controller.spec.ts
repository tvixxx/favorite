import { Test } from '@nestjs/testing';
import request from 'supertest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { LocalMediaController } from './media.controller';
import { MediaService } from './media.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Раздача готового локального изображения', () => {
  it('возвращает файл WebP по публичной ссылке', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'favourite-media-http-'));

    await mkdir(join(directory, '.media'));
    const file = join(directory, '.media', 'full.webp');

    await writeFile(file, Buffer.from('fixture-webp'));
    const module = await Test.createTestingModule({
      controllers: [LocalMediaController],
      providers: [
        {
          provide: MediaService,
          useValue: { localImage: jest.fn().mockResolvedValue(file) },
        },
      ],
    }).compile();
    const app = module.createNestApplication();

    await app.listen(0, '127.0.0.1');

    try {
      const response = await request(app.getHttpServer() as Server)
        .get('/media/images/00000000-0000-4000-8000-000000000001/full.webp')
        .expect(200);

      expect(response.headers['content-type']).toContain('image/webp');
      expect(response.body).toEqual(Buffer.from('fixture-webp'));
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
