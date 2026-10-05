import sharp, { type Sharp } from 'sharp';
import { createRequire } from 'node:module';
import { MAX_IMAGE_PIXELS, type ImagePolicy } from './media-policy';

export interface TransformedImage {
  main: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
}

function isHeif(input: Buffer): boolean {
  return (
    input.toString('ascii', 4, 8) === 'ftyp' &&
    /heic|heix|hevc|hevx|mif1|msf1/.test(input.toString('ascii', 8, 64))
  );
}

async function decodeHeif(input: Buffer): Promise<Sharp> {
  const majorBrand = input.toString('ascii', 8, 12);

  if (
    ['msf1', 'hevc', 'hevx'].includes(majorBrand) ||
    input.toString('ascii', 8, 64).includes('msf1')
  ) {
    throw new Error('Анимированные изображения не поддерживаются');
  }

  const libheif = createRequire(__filename)(
    'libheif-js',
  ) as typeof import('libheif-js').default;
  const images = new libheif.HeifDecoder().decode(input);

  try {
    if (!images.length) {
      throw new Error('Не удалось прочитать HEIC/HEIF');
    }

    const image = images.find((item) => item.is_primary()) ?? images[0];
    const width = image.get_width();
    const height = image.get_height();

    if (width <= 0 || height <= 0 || width * height > MAX_IMAGE_PIXELS) {
      throw new Error('Слишком большое разрешение изображения');
    }

    const pixels = await new Promise<Uint8ClampedArray>((resolve, reject) => {
      image.display(
        { width, height, data: new Uint8ClampedArray(width * height * 4) },
        (result) => {
          if (result) {
            resolve(result.data);
          } else {
            reject(new Error('Не удалось прочитать HEIC/HEIF'));
          }
        },
      );
    });

    return sharp(Buffer.from(pixels), {
      raw: { width, height, channels: 4 },
      limitInputPixels: MAX_IMAGE_PIXELS,
    });
  } finally {
    for (const image of images) {
      image.free();
    }
  }
}

export async function transformImage(
  input: Buffer,
  policy: ImagePolicy,
): Promise<TransformedImage> {
  if (!input.length || input.length > policy.maxBytes) {
    throw new Error('Недопустимый размер изображения');
  }

  const pipeline = isHeif(input)
    ? await decodeHeif(input)
    : sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
  const metadata = await pipeline.metadata();

  if (
    !isHeif(input) &&
    !['jpeg', 'png', 'webp'].includes(metadata.format ?? '')
  ) {
    throw new Error('Поддерживаются JPEG, PNG, WebP и HEIC/HEIF');
  }

  let animatedPng = false;

  if (metadata.format === 'png') {
    for (let offset = 8; offset + 12 <= input.length; ) {
      if (input.toString('ascii', offset + 4, offset + 8) === 'acTL') {
        animatedPng = true;
      }

      offset += input.readUInt32BE(offset) + 12;
    }
  }

  if ((metadata.pages ?? 1) > 1 || animatedPng) {
    throw new Error('Анимированные изображения не поддерживаются');
  }

  const main = await pipeline
    .clone()
    .autoOrient()
    .resize(policy.mainSize, policy.mainSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await pipeline
    .clone()
    .autoOrient()
    .resize(policy.thumbnailSize, policy.thumbnailSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  return {
    main: main.data,
    thumbnail,
    width: main.info.width,
    height: main.info.height,
  };
}
