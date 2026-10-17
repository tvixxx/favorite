import { ZonedCalendar } from './timezone';

describe('Календарные границы часового пояса', () => {
  it.each([
    ['UTC', '2026-10-14T00:00:00.000Z'],
    ['Europe/Samara', '2026-10-13T20:00:00.000Z'],
    ['Asia/Kolkata', '2026-10-13T18:30:00.000Z'],
    ['Asia/Kathmandu', '2026-10-13T18:15:00.000Z'],
  ])(
    'вычисляет начало дня для %s без зависимости от пояса ОС',
    (zone, expected) => {
      expect(
        new ZonedCalendar(zone).startOfDay('2026-10-14').toISOString(),
      ).toBe(expected);
    },
  );
  it.each([
    ['2024-03-31', 23],
    ['2024-10-27', 25],
  ])('учитывает смену DST в Berlin %s: день длится %s часов', (date, hours) => {
    const calendar = new ZonedCalendar('Europe/Berlin');
    expect(
      (calendar.startOfDay(calendar.addDays(date, 1)).getTime() -
        calendar.startOfDay(date).getTime()) /
        3600000,
    ).toBe(hours);
  });
  it('находит первый доступный момент дня при переходе в полночь и корректно обрабатывает пропущенную дату', () => {
    const chile = new ZonedCalendar('America/Santiago');
    const start = chile.startOfDay('2024-09-08');
    expect(chile.dateKey(start)).toBe('2024-09-08');
    expect(chile.dateKey(new Date(start.getTime() - 1))).toBe('2024-09-07');
    const apia = new ZonedCalendar('Pacific/Apia');
    expect(apia.startOfDay('2011-12-30')).toEqual(
      apia.startOfDay('2011-12-31'),
    );
  });
  it('отклоняет неизвестный пояс и несуществующую календарную дату', () => {
    expect(() => new ZonedCalendar("UTC'); DROP TABLE users; --")).toThrow();
    expect(() => new ZonedCalendar('UTC').startOfDay('2026-02-31')).toThrow();
    expect(() => new ZonedCalendar('UTC').startOfDay('bad')).toThrow();
  });
});
