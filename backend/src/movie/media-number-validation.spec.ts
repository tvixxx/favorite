import { ValidationPipe } from '@nestjs/common';
import { CreateMovieRequest, PatchMovieDto } from './dto';
import { CreateUserMovieBodyDto } from '../user-movie/dto/create-user-movie.dto';
import { UpdateUserMovieDto } from '../user-movie/dto/update-user-movie.dto';
import { TvdbCollectionDto, TvdbSearchDto } from '../tvdb/tvdb.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const movie = {
  title: 'Сериал',
  description: 'Описание',
  genres: ['DRAMA'],
  countryCodes: ['US'],
  actorIds: [],
  isSerial: true,
};
const movieId = '00000000-0000-4000-8000-000000000001';

describe('Единые ограничения года и прогресса', () => {
  afterEach(() => jest.useRealTimers());
  it('проверяет текущий год плюс пять на каждом запросе без перезапуска приложения', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-31T23:59:59Z'));
    const request = { query: 'Сериал', year: '2032' };
    await expect(
      pipe.transform(request, { type: 'query', metatype: TvdbSearchDto }),
    ).rejects.toMatchObject({ status: 400 });
    jest.setSystemTime(new Date('2027-01-01T00:00:00Z'));
    await expect(
      pipe.transform(request, { type: 'query', metatype: TvdbSearchDto }),
    ).resolves.toMatchObject({ year: 2032 });
  });
  it('применяет границы года к поиску, созданию и изменению карточки', async () => {
    const max = new Date().getUTCFullYear() + 5;
    for (const year of [1919, max + 1]) {
      await expect(
        pipe.transform(
          { query: 'Сериал', year },
          { type: 'query', metatype: TvdbSearchDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pipe.transform(
          { ...movie, publishDate: `${year}-01-01T00:00:00Z` },
          { type: 'body', metatype: CreateMovieRequest },
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pipe.transform(
          { publishDate: `${year}-01-01T00:00:00Z` },
          { type: 'body', metatype: PatchMovieDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    for (const year of [1920, max]) {
      await expect(
        pipe.transform(
          { ...movie, publishDate: `${year}-01-01T00:00:00Z` },
          { type: 'body', metatype: CreateMovieRequest },
        ),
      ).resolves.toMatchObject({ publishDate: `${year}-01-01T00:00:00Z` });
    }
  });
  it('ограничивает общие количества и прогресс во всех входных запросах', async () => {
    for (const [field, maximum] of [
      ['seasonCount', 100],
      ['episodeCount', 5000],
    ] as const) {
      await expect(
        pipe.transform(
          { ...movie, [field]: maximum },
          { type: 'body', metatype: CreateMovieRequest },
        ),
      ).resolves.toMatchObject({ [field]: maximum });
      await expect(
        pipe.transform(
          { ...movie, [field]: maximum + 1 },
          { type: 'body', metatype: CreateMovieRequest },
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    for (const metatype of [
      CreateUserMovieBodyDto,
      UpdateUserMovieDto,
      TvdbCollectionDto,
    ]) {
      const identity = metatype === CreateUserMovieBodyDto ? { movieId } : {};
      await expect(
        pipe.transform(
          { ...identity, currentSeason: 100, currentEpisode: 5000 },
          { type: 'body', metatype },
        ),
      ).resolves.toMatchObject({ currentSeason: 100, currentEpisode: 5000 });
      for (const change of [
        { currentSeason: 101 },
        { currentEpisode: 5001 },
        { currentEpisode: 1.5 },
      ]) {
        await expect(
          pipe.transform(
            { ...identity, ...change },
            { type: 'body', metatype },
          ),
        ).rejects.toMatchObject({ status: 400 });
      }
    }
  });
});
