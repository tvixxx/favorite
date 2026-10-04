import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateMovieRequest } from './create-movie.dto';
import { Genre } from '../../generated/prisma/enums';
import { parseGenreFilters } from '../../common/utils/parse-query-filters';

describe('Контракт жанра научной фантастики', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const payload = (genre: string) => ({
    title: 'Светлячок',
    description: 'Описание сериала',
    countryCodes: ['US'],
    genres: ['ACTION', 'DRAMA', 'COMEDY', 'FANTASY', genre],
    actorIds: [],
    isSerial: true,
    seasonCount: 1,
    episodeCount: 14,
    collection: {
      personalRate: 7,
      watchStatus: 'COMPLETED',
      currentSeason: null,
      currentEpisode: null,
    },
  });

  it.each(['Sci_fi', 'Sci-fi'])(
    'принимает %s и передаёт Prisma каноническое значение',
    async (genre) => {
      expect(Genre.Sci_fi).toBe('Sci_fi');
      const result: unknown = await pipe.transform(payload(genre), {
        type: 'body',
        metatype: CreateMovieRequest,
      });
      expect(result).toMatchObject({
        genres: [
          Genre.ACTION,
          Genre.DRAMA,
          Genre.COMEDY,
          Genre.FANTASY,
          Genre.Sci_fi,
        ],
        collection: {
          personalRate: 7,
          watchStatus: 'COMPLETED',
        },
      });
    },
  );

  it('сохраняет строгую проверку неизвестных жанров', async () => {
    await expect(
      pipe.transform(payload('INVALID_GENRE'), {
        type: 'body',
        metatype: CreateMovieRequest,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['Sci_fi', 'Sci-fi'])(
    'не теряет фильтр %s для коллекции и каталога',
    (genre) => {
      expect(parseGenreFilters([genre])).toEqual([Genre.Sci_fi]);
    },
  );
});
