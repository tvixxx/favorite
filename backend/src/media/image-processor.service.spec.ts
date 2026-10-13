import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { ImageProcessor } from './image-processor.service';
import { MEDIA_POLICIES } from './media-policy';

jest.mock('node:worker_threads', () => ({ Worker: jest.fn() }));

it('не блокирует следующие изображения, если worker не запустился', async () => {
  const worker = Object.assign(new EventEmitter(), {
    terminate: jest.fn().mockResolvedValue(0),
  });

  jest
    .mocked(Worker)
    .mockImplementationOnce(() => {
      throw new Error('worker startup');
    })
    .mockImplementationOnce(() => worker as never);
  const processor = new ImageProcessor();

  await expect(
    processor.process(Buffer.from('first'), MEDIA_POLICIES.MOVIE_POSTER),
  ).rejects.toThrow();
  const next = processor.process(
    Buffer.from('next'),
    MEDIA_POLICIES.MOVIE_POSTER,
  );

  worker.emit('message', {
    result: {
      main: Buffer.from('main'),
      thumbnail: Buffer.from('thumb'),
      width: 1,
      height: 1,
    },
  });
  await expect(next).resolves.toMatchObject({ width: 1, height: 1 });
  processor.onModuleDestroy();
});
