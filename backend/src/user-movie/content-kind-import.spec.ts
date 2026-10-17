import { JwtService } from '@nestjs/jwt';
import { CollectionImportService } from './collection-import.service';
import { parseCollectionFile } from './collection-file';
import { PrismaService } from '../prisma/prisma.service';
import { UserMovieService } from './user-movie.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function setup(catalog: Record<string, unknown>[]) {
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ authVersion: 0, blockedAt: null }),
    },
    movie: {
      findMany: jest.fn().mockResolvedValue(
        catalog.map((row) => ({
          title: 'Маяк',
          titleNormalized: 'маяк',
          isSerial: false,
          contentKind: null,
          publishDate: new Date('2020-01-01'),
          updatedAt: new Date('2026-10-15'),
          ...row,
        })),
      ),
    },
    userMovie: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new CollectionImportService(
    prisma,
    {} as UserMovieService,
    {
      signAsync: jest.fn().mockResolvedValue('proof'),
    } as unknown as JwtService,
  );
}
function file(entry: Record<string, unknown> = {}) {
  return {
    format: 'json' as const,
    content: JSON.stringify({
      version: 1,
      movies: [
        { title: 'Маяк', isSerial: false, watchStatus: 'COMPLETED', ...entry },
      ],
    }),
  };
}

describe('Импорт при одноимённых произведениях и старых категориях', () => {
  it('сохраняет поддержку прежнего файла без категории', () => {
    expect(parseCollectionFile('json', file().content)[0]).toMatchObject({
      title: 'Маяк',
      isSerial: false,
      watchStatus: 'COMPLETED',
    });
  });
  it('разрешает явную категорию в новом файле', () => {
    expect(
      parseCollectionFile('json', file({ contentKind: 'ANIME' }).content)[0],
    ).toMatchObject({ contentKind: 'ANIME' });
  });
  it('не разрешает неизвестную категорию из файла', () => {
    expect(() =>
      parseCollectionFile(
        'json',
        file({ contentKind: 'UNKNOWN_KIND' }).content,
      ),
    ).toThrow();
  });
  it('выбирает фильм по формату, независимо от порядка найденных карточек', async () => {
    const result = await setup([
      { id: 'film' },
      { id: 'series', isSerial: true },
    ]).check({ id: 'user' }, file());
    expect(result).toMatchObject({
      valid: true,
      rows: [{ movieId: 'film', status: 'ready' }],
    });
  });
  it('сопоставляет старый файл с ремейком по указанному году', async () => {
    const result = await setup([
      { id: 'new', publishDate: new Date('2024-01-01') },
      { id: 'old' },
    ]).check({ id: 'user' }, file({ year: 2024 }));
    expect(result).toMatchObject({ valid: true, rows: [{ movieId: 'new' }] });
  });
  it('останавливает неоднозначный импорт вместо выбора последней карточки', async () => {
    const result = await setup([{ id: 'one' }, { id: 'two' }]).check(
      { id: 'user' },
      file(),
    );
    expect(result).toMatchObject({
      valid: false,
      proof: null,
      errors: 1,
      rows: [{ movieId: null, status: 'error' }],
    });
  });
  it('использует явно выбранную карточку из допустимых кандидатов', async () => {
    const result = await setup([{ id: 'one' }, { id: 'two' }]).check(
      { id: 'user' },
      { ...file(), ...{ matches: [{ row: 1, movieId: 'one' }] } },
    );
    expect(result).toMatchObject({ valid: true, rows: [{ movieId: 'one' }] });
  });
  it('не разрешает подменить сопоставление произвольным ID', async () => {
    const result = await setup([{ id: 'one' }]).check(
      { id: 'user' },
      { ...file(), ...{ matches: [{ row: 1, movieId: 'other' }] } },
    );
    expect(result).toMatchObject({ valid: false, proof: null });
  });
  it('не объявляет неуточнённую старую категорию совпадением с явным аниме', async () => {
    const result = await setup([{ id: 'legacy' }]).check(
      { id: 'user' },
      file({ contentKind: 'ANIME' }),
    );
    expect(result).toMatchObject({ valid: false, proof: null });
  });
});
