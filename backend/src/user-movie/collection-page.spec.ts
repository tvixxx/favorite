import { UserMovieService } from './user-movie.service';
import { CollectionQueryDto } from './dto/collection-query.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Prisma } from '../generated/prisma/client';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Серверные страницы личной коллекции', () => {
  it('применяет поиск и личные фильтры до получения страницы и общего числа', async () => {
    const findMany = jest
      .fn<Promise<never[]>, [Prisma.UserMovieFindManyArgs]>()
      .mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(41);
    const service = new UserMovieService({
      userMovie: { findMany, count },
      $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
    } as never);
    const query = plainToInstance(CollectionQueryDto, {
      q: '  Матрица  ',
      isFavorite: 'true',
      countryCode: 'RU',
      limit: '20',
      offset: '20',
    });
    expect(await validate(query)).toHaveLength(0);
    const result = await service.pageByUser('owner', query);
    expect(result).toMatchObject({
      total: 41,
      limit: 20,
      offset: 20,
      items: [],
    });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        userId: 'owner',
        isFavorite: true,
      },
      take: 20,
      skip: 20,
      orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
    });
    expect(findMany.mock.calls[0][0]).toHaveProperty(
      'where.movie.AND',
      expect.any(Array),
    );
    expect(count).toHaveBeenCalledWith({
      where: findMany.mock.calls[0][0].where,
    });
  });
  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: '1.5' },
    { offset: '-1' },
    { q: 'x'.repeat(201) },
  ])('отклоняет небезопасные границы запроса %p', async (input) => {
    expect(
      (await validate(plainToInstance(CollectionQueryDto, input))).length,
    ).toBeGreaterThan(0);
  });
  it('не трактует подставленный объект как допустимый фильтр', () => {
    expect(() =>
      plainToInstance(CollectionQueryDto, {
        isFavorite: { in: [true, false] },
      }),
    ).toThrow();
    expect(() =>
      plainToInstance(CollectionQueryDto, { genres: { $ne: null } }),
    ).toThrow();
  });
});
