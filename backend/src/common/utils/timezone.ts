import { BadRequestException } from '@nestjs/common';

export const TIMEZONES = Object.freeze([
  'UTC',
  ...Intl.supportedValuesOf('timeZone'),
]);
const supported = new Set(TIMEZONES);

export class ZonedCalendar {
  public readonly zone: string;
  private readonly dateFormat: Intl.DateTimeFormat;
  private readonly timeFormat: Intl.DateTimeFormat;
  constructor(zone = 'UTC') {
    // Также принимаем IANA-алиасы, которые канонизирует тот же Intl runtime.
    let canonical: string;
    try {
      canonical = new Intl.DateTimeFormat('en', {
        timeZone: zone,
      }).resolvedOptions().timeZone;
    } catch {
      throw new BadRequestException('Неизвестный часовой пояс');
    }
    if (!supported.has(zone) && !supported.has(canonical))
      throw new BadRequestException('Неизвестный часовой пояс');
    this.zone = canonical;
    this.dateFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone: canonical,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    this.timeFormat = new Intl.DateTimeFormat('en-CA', {
      timeZone: canonical,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  }
  private parts(
    date: Date,
    formatter: Intl.DateTimeFormat,
  ): Record<string, string> {
    return Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value]),
    );
  }
  public dateKey(date: Date): string {
    const p = this.parts(date, this.dateFormat);
    return `${p.year.padStart(4, '0')}-${p.month}-${p.day}`;
  }
  private nominal(day: string): number {
    const value = Date.parse(day + 'T00:00:00Z');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(value) ||
      new Date(value).toISOString().slice(0, 10) !== day ||
      day < '0001-01-01'
    )
      throw new BadRequestException('Некорректная календарная дата');
    return value;
  }
  public addDays(day: string, amount: number): string {
    return new Date(this.nominal(day) + amount * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  public startOfDay(day: string): Date {
    const nominal = this.nominal(day);
    let candidate = nominal;
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = this.parts(new Date(candidate), this.timeFormat);
      const local = Date.parse(
        `${p.year.padStart(4, '0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
      );
      const next = candidate + nominal - local;
      if (next === candidate) {
        if (this.dateKey(new Date(candidate - 1)) < day)
          return new Date(candidate);
        break;
      }
      candidate = next;
    }
    // Редкие смены в полночь: выбираем первый доступный момент календарного дня.
    let low = nominal - 36 * 3600000,
      high = nominal + 36 * 3600000;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.dateKey(new Date(middle)) < day) low = middle + 1;
      else high = middle;
    }
    return new Date(low);
  }
}
