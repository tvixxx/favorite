import { normalizeDiaryValues } from './diary-values';

const film = { isSerial: false, seasonCount: null };
const serial = { isSerial: true, seasonCount: 3 };
const now = new Date('2026-10-17T22:30:00Z');
const input = {
  viewedOn: '2026-10-17',
  scope: 'TITLE' as const,
  isRewatch: false,
};

describe('Правила записи дневника', () => {
  it('сохраняет календарную дату без сдвига, необязательные значения и обычную пунктуацию', () => {
    expect(
      normalizeDiaryValues(
        {
          ...input,
          rating: 9,
          note: '  Пересмотр — "ещё лучше", O’Connor <3\nНовая строка.  ',
        },
        film,
        'UTC',
        now,
      ),
    ).toMatchObject({
      viewedOn: new Date('2026-10-17T00:00:00Z'),
      scope: 'TITLE',
      season: null,
      isRewatch: false,
      rating: 9,
      note: 'Пересмотр — "ещё лучше", O’Connor <3\nНовая строка.',
    });
  });
  it('допускает первый известный пересмотр без предыдущих записей', () => {
    expect(
      normalizeDiaryValues({ ...input, isRewatch: true }, film, 'UTC', now),
    ).toMatchObject({ isRewatch: true, rating: null, note: '' });
  });
  it('проверяет будущее по профилю, а не по часовому поясу сервера', () => {
    expect(
      normalizeDiaryValues(
        { ...input, viewedOn: '2026-10-18' },
        film,
        'Europe/Samara',
        now,
      ).viewedOn.toISOString(),
    ).toBe('2026-10-18T00:00:00.000Z');
    expect(() =>
      normalizeDiaryValues(
        { ...input, viewedOn: '2026-10-18' },
        film,
        'UTC',
        now,
      ),
    ).toThrow('будущем');
  });
  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-1-02',
    '2026-10-17T00:00:00Z',
    '0000-01-01',
  ])('отклоняет некорректную календарную дату %s', (viewedOn) => {
    expect(() =>
      normalizeDiaryValues({ ...input, viewedOn }, film, 'UTC', now),
    ).toThrow();
  });
  it('принимает сезон сериала и не выдумывает номера при полном просмотре', () => {
    expect(
      normalizeDiaryValues(
        { ...input, scope: 'SEASON', season: 2 },
        serial,
        'UTC',
        now,
      ),
    ).toMatchObject({ scope: 'SEASON', season: 2 });
    expect(normalizeDiaryValues(input, serial, 'UTC', now).season).toBeNull();
  });
  it.each([0, 4, 101, 1.5, '003'])(
    'отклоняет неверный или неизвестный сезон %s',
    (season) => {
      expect(() =>
        normalizeDiaryValues(
          { ...input, scope: 'SEASON', season } as never,
          serial,
          'UTC',
          now,
        ),
      ).toThrow();
    },
  );
  it('не разрешает сезон для фильма и номер сезона для полного просмотра', () => {
    expect(() =>
      normalizeDiaryValues(
        { ...input, scope: 'SEASON', season: 1 },
        film,
        'UTC',
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeDiaryValues({ ...input, season: 1 }, serial, 'UTC', now),
    ).toThrow();
  });
  it.each([0, 11, 1.5, '9', true])('отклоняет неверную оценку %s', (rating) => {
    expect(() =>
      normalizeDiaryValues({ ...input, rating } as never, film, 'UTC', now),
    ).toThrow();
  });
  it('ограничивает личную заметку и управляющие символы', () => {
    expect(() =>
      normalizeDiaryValues(
        { ...input, note: 'x'.repeat(501) },
        film,
        'UTC',
        now,
      ),
    ).toThrow();
    expect(() =>
      normalizeDiaryValues(
        { ...input, note: 'строка\u0000' },
        film,
        'UTC',
        now,
      ),
    ).toThrow();
  });
});
