import { ValidationPipe } from '@nestjs/common';
import { CollectionQueryDto } from '../user-movie/dto/collection-query.dto';
import { CreateMovieRequest, PatchMovieDto } from './dto';
import { CheckCollectionImportDto } from '../user-movie/collection-import.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
describe('Валидация категории и совместимость старых запросов', () => {
  it('принимает категорию вместе с прежним фильтром фильмов', async () => {
    await expect(
      pipe.transform(
        { contentKind: 'ANIME', isSerial: 'false' },
        { type: 'query', metatype: CollectionQueryDto },
      ),
    ).resolves.toMatchObject({ contentKind: 'ANIME', isSerial: false });
  });
  it('отклоняет неизвестную категорию фильтра', async () => {
    await expect(
      pipe.transform(
        { contentKind: 'OTHER' },
        { type: 'query', metatype: CollectionQueryDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('сохраняет запрос старого клиента без категории', async () => {
    const dto = {
      title: 'Фильм',
      description: 'Описание',
      countryCodes: ['CN'],
      genres: ['DRAMA'],
      actorIds: [],
      isSerial: false,
    };
    await expect(
      pipe.transform(dto, { type: 'body', metatype: CreateMovieRequest }),
    ).resolves.toMatchObject(dto);
    await expect(
      pipe.transform(
        { ...dto, contentKind: null },
        { type: 'body', metatype: CreateMovieRequest },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('отклоняет null вместо сопоставления строк импорта', async () => {
    await expect(
      pipe.transform(
        { format: 'json', content: '{}', matches: null },
        { type: 'body', metatype: CheckCollectionImportDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('отклоняет null вместо категории при частичном изменении', async () => {
    await expect(
      pipe.transform(
        { contentKind: null },
        { type: 'body', metatype: PatchMovieDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
