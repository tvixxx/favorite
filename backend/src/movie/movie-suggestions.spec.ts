import MovieService from './movie.service';
import { MovieController } from './movie.controller';
import { BadRequestException } from '@nestjs/common';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../media/media.service', () => ({ MediaService: class {} }));

describe('Ограниченные подсказки каталога', () => {
  it('проверяет принадлежность по всей коллекции пользователя и возвращает только нужные поля', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'one',
        title: 'Первый',
        isSerial: false,
        contentKind: 'ANIME',
        publishDate: null,
        userMovies: [{ id: 'link' }],
      },
      {
        id: 'two',
        title: 'Второй',
        isSerial: true,
        publishDate: null,
        userMovies: [],
      },
    ]);
    const service = new MovieService(
      { movie: { findMany } } as never,
      {} as never,
      {} as never,
    );
    expect(await service.suggestions('owner', '  Фильм ', 10)).toEqual([
      {
        id: 'one',
        title: 'Первый',
        isSerial: false,
        contentKind: 'ANIME',
        publishDate: null,
        inCollection: true,
      },
      {
        id: 'two',
        title: 'Второй',
        isSerial: true,
        publishDate: null,
        inCollection: false,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: {
          OR: [
            { title: { contains: 'Фильм', mode: 'insensitive' } },
            { titleEn: { contains: 'Фильм', mode: 'insensitive' } },
            { originalTitle: { contains: 'Фильм', mode: 'insensitive' } },
            { titleAliases: { has: 'фильм' } },
          ],
        },
        select: {
          id: true,
          title: true,
          isSerial: true,
          contentKind: true,
          publishDate: true,
          userMovies: {
            where: { userId: 'owner' },
            take: 1,
            select: { id: true },
          },
        },
      }),
    );
  });
  it('не запрашивает каталог для слишком короткого ввода и отклоняет чрезмерный', async () => {
    const findMany = jest.fn();
    const service = new MovieService(
      { movie: { findMany } } as never,
      {} as never,
      {} as never,
    );
    expect(await service.suggestions('owner', ' ')).toEqual([]);
    await expect(
      service.suggestions('owner', 'x'.repeat(201)),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('отклоняет объект вместо q и недопустимые размеры страницы', () => {
    const controller = new MovieController({} as never);
    for (const limit of ['0', '26', '1.5', ['10', '20']])
      expect(() =>
        controller.suggestions({ id: 'owner' } as never, 'Фильм', limit),
      ).toThrow(BadRequestException);
    expect(() =>
      controller.suggestions({ id: 'owner' } as never, { $ne: null }),
    ).toThrow(BadRequestException);
  });
});
