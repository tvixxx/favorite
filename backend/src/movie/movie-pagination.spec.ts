import { BadRequestException } from '@nestjs/common';
import { MovieController } from './movie.controller';
import MovieService from './movie.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Страницы каталога', () => {
  function setup() {
    const movie = {
      findMany: jest
        .fn<
          Promise<Array<{ id: string; poster: null }>>,
          [Prisma.MovieFindManyArgs]
        >()
        .mockResolvedValue([{ id: 'second', poster: null }]),
      count: jest.fn().mockResolvedValue(5),
    };
    const review = {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ movieId: 'second', _avg: { rate: 8 } }]),
    };
    const prisma = {
      movie,
      review,
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };
    const service = new MovieService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
    );

    return { movie, review, controller: new MovieController(service) };
  }

  it('возвращает порцию, общее число совпадений и рейтинг только выбранных фильмов', async () => {
    const { controller, movie, review } = setup();
    const result = await controller.findPage(
      'дюна',
      undefined,
      'US',
      undefined,
      undefined,
      'actor',
      '2',
      '2',
    );

    expect(result).toEqual({
      items: [{ id: 'second', poster: null, averageRating: 8 }],
      total: 5,
      limit: 2,
      offset: 2,
    });
    const query = movie.findMany.mock.calls[0][0];

    expect(query).toMatchObject({
      take: 2,
      skip: 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(JSON.stringify(query.where)).toContain('дюна');
    expect(JSON.stringify(query.where)).toContain('US');
    expect(JSON.stringify(query.where)).toContain('actor');
    expect(movie.count).toHaveBeenCalledWith({ where: query.where });
    expect(review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { movieId: { in: ['second'] }, hiddenAt: null },
      }),
    );
  });

  it('возвращает пустую порцию за последней страницей без потери общего числа', async () => {
    const { controller, movie, review } = setup();

    movie.findMany.mockResolvedValue([]);

    expect(
      await controller.findPage(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '20',
        '40',
      ),
    ).toEqual({
      items: [],
      total: 5,
      limit: 20,
      offset: 40,
    });
    expect(review.groupBy).not.toHaveBeenCalled();
  });

  it.each([
    ['0', '0'],
    ['101', '0'],
    ['1.5', '0'],
    ['20', '-1'],
    ['20', '1.5'],
    [['20', '30'], '0'],
  ])(
    'отклоняет некорректные размеры порции %p и смещения %p до запроса к базе',
    (limit, offset) => {
      const { controller, movie } = setup();

      expect(() =>
        controller.findPage(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          limit,
          offset,
        ),
      ).toThrow(BadRequestException);
      expect(movie.findMany).not.toHaveBeenCalled();
    },
  );
});
