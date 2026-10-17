import MovieService from './movie.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Изменение актёрского состава', () => {
  it('передаёт в Prisma корректную дату для ISO даты без времени', async () => {
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      movie: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'movie',
          title: 'Фильм',
          isSerial: false,
          publishDate: null,
          createdById: 'user',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update,
      },
    };
    const service = new MovieService(
      {
        $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      } as never,
      {} as never,
      {} as never,
    );

    await service.patch(
      'movie',
      { publishDate: '2020-01-01' },
      { id: 'user', role: 'USER' },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { publishDate: new Date('2020-01-01') },
      }),
    );
  });
  it.each([{ ids: ['new'] }, { ids: [] }])(
    'заменяет состав переданным набором %p',
    async ({ ids }) => {
      let cast = ['old'];
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        movie: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'movie',
            title: 'Фильм',
            isSerial: false,
            publishDate: null,
            createdById: 'user',
          }),
          update: ({
            data,
          }: {
            data: {
              actors?: {
                set?: Array<{ id: string }>;
                connect?: Array<{ id: string }>;
              };
            };
          }) => {
            if (data.actors?.set) {
              cast = data.actors.set.map((actor) => actor.id);
            } else if (data.actors?.connect) {
              cast.push(...data.actors.connect.map((actor) => actor.id));
            }

            return Promise.resolve();
          },
        },
        actor: {
          findMany: jest.fn().mockResolvedValue(ids.map((id) => ({ id }))),
        },
      };
      const service = new MovieService(
        {
          $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        } as never,
        {} as never,
        {} as never,
      );

      await expect(
        service.patch('movie', { actorIds: ids }, { id: 'user', role: 'USER' }),
      ).resolves.toBe(true);
      expect(cast).toEqual(ids);
    },
  );
});
