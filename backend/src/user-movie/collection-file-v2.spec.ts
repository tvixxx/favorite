import {
  parseCollectionFile,
  serializeCollectionFile,
} from './collection-file';

const entry = {
  title: '=Фильм, "пример"',
  isSerial: true,
  year: 2020,
  contentKind: null,
  watchStatus: 'COMPLETED',
  isFavorite: true,
  seeLater: false,
  personalRate: null,
  currentSeason: 4,
  currentEpisode: 27,
  addedAt: '2020-01-02T03:04:05.000Z',
  startedAt: null,
  completedAt: '2020-02-03T04:05:06+04:00',
  lastWatchedAt: null,
  droppedAt: null,
};

describe('Перенос коллекции v2 без изменения данных', () => {
  it.each(['json', 'csv'] as const)(
    'сохраняет возможность выгрузить старые данные вне новых границ в %s',
    (format) => {
      const legacy = {
        ...entry,
        year: 1900,
        currentSeason: 101,
        currentEpisode: 5001,
      };
      const content = serializeCollectionFile(
        format,
        [legacy as never],
        '2026-10-17T00:00:00Z',
      );
      expect(content).toContain('1900');
      expect(() => parseCollectionFile(format, content)).toThrow();
    },
  );
  it('принимает nullable поля, прогресс и даты с явной зоной', () => {
    const rows = parseCollectionFile(
      'json',
      JSON.stringify({ version: 2, movies: [entry] }),
    );
    expect(rows[0]).toEqual({
      ...entry,
      completedAt: '2020-02-03T00:05:06.000Z',
    });
  });

  it('принимает больше старого лимита только в v2', () => {
    const movies = Array.from({ length: 201 }, () => entry);
    expect(
      parseCollectionFile('json', JSON.stringify({ version: 2, movies })),
    ).toHaveLength(201);
    expect(() =>
      parseCollectionFile('json', JSON.stringify({ version: 1, movies })),
    ).toThrow();
  });

  it.each([
    { completedAt: '2024-02-30T00:00:00Z' },
    { addedAt: null },
    { startedAt: '2024-01-02T03:04:05' },
    { currentEpisode: -1 },
    { currentSeason: 1.5 },
    { currentSeason: 101 },
    { currentEpisode: 5001 },
    { year: 1919 },
    { year: new Date().getUTCFullYear() + 6 },
    { personalRate: '8' },
    { extra: true },
    { isSerial: false, currentEpisode: 3 },
  ])('отклоняет неверный снимок до записи %#', (change) => {
    expect(() =>
      parseCollectionFile(
        'json',
        JSON.stringify({ version: 2, movies: [{ ...entry, ...change }] }),
      ),
    ).toThrow();
  });
});
