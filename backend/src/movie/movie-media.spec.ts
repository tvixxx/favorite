import MovieService from './movie.service';
import type { CreateMovieRequest } from './dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Создание фильма с загруженным постером', () => {
  it('привязывает медиа внутри транзакции создания фильма', async () => {
    const tx = {
      actor: { findMany: jest.fn().mockResolvedValue([]) },
      movie: { create: jest.fn().mockResolvedValue({ id: 'movie-id' }) },
    };
    const prisma = {
      movie: { findFirst: jest.fn().mockResolvedValue(null) },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const media = {
      select: jest.fn().mockResolvedValue({
        assetId: 'asset-id',
        url: 'https://media.example.test/full.webp',
        thumbnailUrl: 'https://media.example.test/thumbnail.webp',
      }),
    };
    const service = new MovieService(
      prisma as never,
      {} as never,
      media as never,
    );
    const dto = {
      title: 'QA media',
      actorIds: [],
      countryCodes: ['US'],
      genres: ['ACTION'],
      description: 'Описание',
      isSerial: false,
      posterAssetId: 'asset-id',
    } as unknown as CreateMovieRequest;

    await service.create(dto, { id: 'user-id', role: 'USER' });
    expect(media.select).toHaveBeenCalledWith(
      tx,
      { assetId: 'asset-id', url: undefined },
      'user-id',
      'MOVIE_POSTER',
    );
    expect(tx.movie.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          poster: {
            create: expect.objectContaining({
              url: 'https://media.example.test/full.webp',
              assetId: 'asset-id',
            }) as unknown,
          },
        }) as unknown,
      }),
    );
  });
});
