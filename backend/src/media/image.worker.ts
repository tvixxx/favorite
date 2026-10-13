import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { transformImage } from './image-transform';
import type { ImagePolicy } from './media-policy';

const input = workerData as { bytes: Uint8Array; policy: ImagePolicy };

sharp.concurrency(1);
void transformImage(Buffer.from(input.bytes), input.policy).then(
  (result) => parentPort?.postMessage({ result }),
  (error: unknown) =>
    parentPort?.postMessage({
      error: error instanceof Error ? error.message : 'Изображение повреждено',
    }),
);
