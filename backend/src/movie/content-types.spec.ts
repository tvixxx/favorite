import MovieService from './movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import { Genre } from '../generated/prisma/enums';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const owner = { id: 'owner', role: 'USER' } as const;
const admin = { id: 'admin', role: 'ADMIN' } as const;
const request = {
  title: 'Маяк',
  description: 'Описание',
  countryCodes: ['CN'],
  genres: [Genre.DRAMA],
  actorIds: [],
  isSerial: false,
  publishDate: '2020-01-01',
};

function setup(existing: Record<string, unknown>[] = []) {
  const records = existing.map((row) => ({
    id: 'existing',
    title: 'Маяк',
    titleNormalized: 'маяк',
    isSerial: false,
    contentKind: null,
    publishDate: new Date('2020-01-01'),
    createdById: owner.id,
    updatedAt: new Date(),
    poster: null,
    ...row,
  }));
  const audits: unknown[] = [];
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    movie: {
      findFirst: jest.fn(() => Promise.resolve(records[0] ?? null)),
      findMany: jest.fn(() => Promise.resolve(records)),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(records.find((row) => row.id === where.id)),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: 'created' };
        records.push(row as (typeof records)[number]);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = records.find((item) => item.id === where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
    actor: { findMany: jest.fn().mockResolvedValue([]) },
    userMovie: { findFirst: jest.fn().mockResolvedValue(null) },
    adminAuditLog: {
      create: jest.fn(({ data }: { data: unknown }) => {
        audits.push(data);
        return Promise.resolve(data);
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
  } as unknown as PrismaService;
  return {
    records,
    audits,
    service: new MovieService(prisma, new UserMovieService(prisma), {
      select: jest.fn(),
      release: jest.fn(),
    } as never),
  };
}

describe('Категория произведения и безопасное различение совпадений', () => {
  it('сохраняет аниме из Китая вместе с прежним признаком фильма', async () => {
    const { service } = setup();
    const result = await service.create(
      { ...request, contentKind: 'ANIME' },
      owner,
    );
    expect(result).toMatchObject({
      contentKind: 'ANIME',
      isSerial: false,
      countryCodes: ['CN'],
    });
  });

  it('разрешает одноимённый фильм другого известного года', async () => {
    const { service, records } = setup([{}]);
    await service.create({ ...request, publishDate: '2024-01-01' }, owner);
    expect(records.map((row) => row.id)).toEqual(['existing', 'created']);
  });

  it('разрешает одноимённый сериал, сохраняя фильм', async () => {
    const { service, records } = setup([{}]);
    await service.create({ ...request, isSerial: true }, owner);
    expect(records.map((row) => row.isSerial)).toEqual([false, true]);
  });

  it('не считает другую категорию доказательством другого произведения', async () => {
    const { service, records } = setup([{}]);
    await expect(
      service.create({ ...request, contentKind: 'ANIME' }, owner),
    ).rejects.toMatchObject({ status: 409 });
    expect(records).toHaveLength(1);
  });

  it('не считает неизвестный год отличием от существующей карточки', async () => {
    const { service, records } = setup([{ publishDate: null }]);
    await expect(service.create(request, owner)).rejects.toMatchObject({
      status: 409,
    });
    expect(records).toHaveLength(1);
  });

  it('позволяет администратору подтвердить разные произведения с пояснением', async () => {
    const { service, records, audits } = setup([{}]);
    await service.create(
      {
        ...request,
        distinctReason:
          'Другое произведение, проверены режиссёр и состав актёров',
      },
      admin,
    );
    expect(records).toHaveLength(2);
    expect(JSON.stringify(audits)).toContain('проверены режиссёр');
  });

  it('не позволяет обычному пользователю обойти совпадение пояснением', async () => {
    const { service, records } = setup([{}]);
    await expect(
      service.create(
        { ...request, distinctReason: 'Это точно другой фильм' },
        owner,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(records).toHaveLength(1);
  });

  it('уточняет категорию старого сериала без замены ID и параметров серий', async () => {
    const { service, records } = setup([
      { isSerial: true, seasonCount: 2, episodeCount: 24 },
    ]);
    await service.patch('existing', { contentKind: 'ANIME' }, owner);
    expect(records[0]).toMatchObject({
      id: 'existing',
      contentKind: 'ANIME',
      isSerial: true,
      seasonCount: 2,
      episodeCount: 24,
    });
  });

  it('сохраняет категорию при редактировании старым клиентом без нового поля', async () => {
    const { service, records } = setup([{ contentKind: 'ANIME' }]);
    await service.patch('existing', { description: 'Новое описание' }, owner);
    expect(records[0]).toMatchObject({
      contentKind: 'ANIME',
      description: 'Новое описание',
      id: 'existing',
    });
  });
});
