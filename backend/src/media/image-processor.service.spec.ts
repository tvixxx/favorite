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

it('завершает активную работу и очередь при остановке, даже если worker ещё не прислал exit', async () => {
  const worker = Object.assign(new EventEmitter(), {
    terminate: jest.fn().mockResolvedValue(0),
  });

  jest.mocked(Worker).mockImplementationOnce(() => worker as never);
  const processor = new ImageProcessor();
  const pending = Promise.allSettled([
    processor.process(Buffer.from('first'), MEDIA_POLICIES.MOVIE_POSTER),
    processor.process(Buffer.from('second'), MEDIA_POLICIES.MOVIE_POSTER),
  ]);

  processor.onModuleDestroy();
  expect(await pending).toMatchObject([
    { status: 'rejected', reason: { status: 503 } },
    { status: 'rejected', reason: { status: 503 } },
  ]);
  worker.emit('exit', 0);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  await expect(
    processor.process(Buffer.from('third'), MEDIA_POLICIES.MOVIE_POSTER),
  ).rejects.toMatchObject({ status: 503 });
});
