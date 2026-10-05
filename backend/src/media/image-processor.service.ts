import {
  BadRequestException,
  HttpException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ImagePolicy } from './media-policy';
import type { TransformedImage } from './image-transform';

@Injectable()
export class ImageProcessor implements OnModuleDestroy {
  private active = false;
  private stopped = false;
  private currentWorker: Worker | null = null;
  private queue: Array<{
    input: Buffer;
    policy: ImagePolicy;
    resolve: (value: TransformedImage) => void;
    reject: (error: Error) => void;
  }> = [];

  public process(
    input: Buffer,
    policy: ImagePolicy,
  ): Promise<TransformedImage> {
    if (this.stopped) {
      return Promise.reject(
        new ServiceUnavailableException(
          'Обработка изображений останавливается',
        ),
      );
    }

    if (this.queue.length >= 2) {
      return Promise.reject(
        new HttpException(
          'Изображения сейчас обрабатываются. Повторите загрузку чуть позже.',
          429,
        ),
      );
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ input, policy, resolve, reject });
      this.next();
    });
  }

  private next(): void {
    if (this.active || this.stopped) {
      return;
    }

    const job = this.queue.shift();

    if (!job) {
      return;
    }

    this.active = true;
    let worker: Worker;

    try {
      worker = new Worker(join(__dirname, 'image.worker.js'), {
        workerData: { bytes: new Uint8Array(job.input), policy: job.policy },
        resourceLimits: { maxOldGenerationSizeMb: 192 },
      });
    } catch {
      this.active = false;
      job.reject(
        new ServiceUnavailableException(
          'Не удалось запустить обработку изображения',
        ),
      );
      this.next();

      return;
    }

    this.currentWorker = worker;
    const timeout = setTimeout(
      () =>
        finish(
          new BadRequestException(
            'Обработка заняла слишком много времени. Выберите меньшее изображение.',
          ),
        ),
      30_000,
    );
    let settled = false;
    const finish = (error?: Error, result?: TransformedImage): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      this.currentWorker = null;
      this.active = false;
      if (error) {
        job.reject(error);
      } else if (result) {
        job.resolve({
          ...result,
          main: Buffer.from(result.main),
          thumbnail: Buffer.from(result.thumbnail),
        });
      }

      this.next();
    };

    worker.once(
      'message',
      (message: { result?: TransformedImage; error?: string }) => {
        if (message.error) {
          finish(new BadRequestException(message.error));
        } else if (message.result) {
          finish(undefined, message.result);
        } else {
          finish(new BadRequestException('Не удалось обработать изображение'));
        }
      },
    );
    worker.once('error', () =>
      finish(new BadRequestException('Не удалось прочитать изображение')),
    );
    worker.once('exit', () => {
      if (!settled) {
        finish(
          new ServiceUnavailableException('Обработка изображения прервана'),
        );
      }
    });
  }

  public onModuleDestroy(): void {
    this.stopped = true;
    void this.currentWorker?.terminate();
    for (const job of this.queue) {
      job.reject(
        new ServiceUnavailableException(
          'Обработка изображений останавливается',
        ),
      );
    }

    this.queue = [];
  }
}
