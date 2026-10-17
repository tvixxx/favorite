import { featuresDatabase } from './features-database';
import { TvdbImportService } from '../src/tvdb/tvdb-import.service';
import MovieService from '../src/movie/movie.service';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import { ContentKind, Genre } from '../src/generated/prisma/enums';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { TvdbProvider } from '../src/tvdb/tvdb-provider';
import type { TvdbPreview } from '../src/tvdb/tvdb.types';

it('сохраняет новые жанры и повторно использует актёров между полным и ограниченными составами', async () => {
  const db = await featuresDatabase();
  try {
    const user = await db.prisma.user.create({
      data: {
        email: 'genres-actors@example.test',
        fullName: 'Проверка',
        password: 'qa-only',
      },
    });
    const prisma = db.prisma as PrismaService;
    const collection = new UserMovieService(prisma);
    const movies = new MovieService(prisma, collection, {
      select: () => Promise.resolve({ url: null }),
    } as never);
    const source: TvdbPreview = {
      id: '90001',
      type: 'movie',
      title: 'Произведение',
      titleEn: null,
      originalTitle: '',
      aliases: [],
      year: 2020,
      description: 'Описание',
      descriptionLanguage: 'ru',
      countryCodes: ['US'],
      genres: Object.values(Genre),
      unmappedGenres: [],
      contentKind: ContentKind.GENERAL,
      isSerial: false,
      posterUrl: null,
      actors: Array.from({ length: 58 }, (_, i) => ({
        id: String(i + 1),
        name: `Актёр ${i + 1}`,
      })),
      seasonCount: null,
      episodeCount: null,
    };
    const provider = {
      assertAvailable() {},
      preview: (_type: string, id: string) =>
        Promise.resolve({ ...source, id, title: `Произведение ${id}` }),
    } as unknown as TvdbProvider;
    const service = new TvdbImportService(provider, prisma, movies, collection);
    for (const [id, actorLimit, expectedCount] of [
      ['90001', 58, 58],
      ['90002', undefined, 15],
      ['90003', 25, 25],
    ] as const) {
      const result = await service.importMovie(
        { id, type: 'movie', actorLimit },
        user,
      );
      const movie = await db.prisma.movie.findUniqueOrThrow({
        where: { id: result.movieId },
        include: { actors: true },
      });
      expect(movie.actors).toHaveLength(expectedCount);
      expect(movie.genres).toEqual(Object.values(Genre));
    }
    expect(await db.prisma.actor.count()).toBe(58);
    expect(await db.prisma.userMovie.count()).toBe(3);
  } finally {
    await db.close();
  }
});
