import sharp from 'sharp';
import { transformImage } from './image-transform';
import { MEDIA_POLICIES } from './media-policy';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('Обработка изображения', () => {
  it('преобразует основное изображение HEIC с дополнительными изображениями', async () => {
    const input = await readFile(join(__dirname, 'fixtures/example.heic'));
    const result = await transformImage(input, MEDIA_POLICIES.MOVIE_POSTER);

    expect(await sharp(result.main).metadata()).toMatchObject({
      format: 'webp',
      width: 1200,
      height: 801,
    });
    expect(result.main.length).toBeGreaterThan(1000);
  });
  it('уменьшает постер, создаёт миниатюру и удаляет EXIF', async () => {
    const input = await sharp({
      create: { width: 1600, height: 2400, channels: 3, background: '#2453ad' },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const result = await transformImage(input, MEDIA_POLICIES.MOVIE_POSTER);
    const main = await sharp(result.main).metadata();
    const thumbnail = await sharp(result.thumbnail).metadata();

    expect(main).toMatchObject({ format: 'webp', width: 800, height: 1200 });
    expect(thumbnail).toMatchObject({
      format: 'webp',
      width: 240,
      height: 360,
    });
    expect(main.exif).toBeUndefined();
  });

  it('не увеличивает маленькую картинку', async () => {
    const input = await sharp({
      create: { width: 80, height: 100, channels: 4, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const result = await transformImage(input, MEDIA_POLICIES.USER_AVATAR);

    expect(await sharp(result.main).metadata()).toMatchObject({
      width: 80,
      height: 100,
      format: 'webp',
    });
  });

  it('учитывает ориентацию фотографии', async () => {
    const input = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#2453ad' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await transformImage(input, MEDIA_POLICIES.MOVIE_POSTER);

    expect(await sharp(result.main).metadata()).toMatchObject({
      width: 80,
      height: 120,
    });
  });

  it('отклоняет SVG и повреждённый файл вместо доверия расширению', async () => {
    await expect(
      transformImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        MEDIA_POLICIES.MOVIE_POSTER,
      ),
    ).rejects.toThrow();
    await expect(
      transformImage(Buffer.from('not an image'), MEDIA_POLICIES.USER_AVATAR),
    ).rejects.toThrow();
  });

  it('проверяет лимит размера до декодирования', async () => {
    await expect(
      transformImage(
        Buffer.alloc(MEDIA_POLICIES.USER_AVATAR.maxBytes + 1),
        MEDIA_POLICIES.USER_AVATAR,
      ),
    ).rejects.toThrow('размер');
  });
});
