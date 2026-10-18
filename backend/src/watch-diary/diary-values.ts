import { BadRequestException } from '@nestjs/common';
import { ZonedCalendar } from '../common/utils/timezone';
import { isPlainText } from '../common/validation/plain-text';

export interface DiaryValuesInput {
  viewedOn: string;
  scope: 'TITLE' | 'SEASON';
  season?: number | null;
  isRewatch: boolean;
  rating?: number | null;
  note?: string;
}

export interface DiaryValues {
  viewedOn: Date;
  scope: 'TITLE' | 'SEASON';
  season: number | null;
  isRewatch: boolean;
  rating: number | null;
  note: string;
}

export function normalizeDiaryValues(
  input: DiaryValuesInput,
  movie: { isSerial: boolean; seasonCount: number | null },
  timezone: string,
  now = new Date(),
): DiaryValues {
  const calendar = new ZonedCalendar(timezone);
  calendar.startOfDay(input.viewedOn);
  if (input.viewedOn > calendar.dateKey(now))
    throw new BadRequestException('Дата просмотра не может быть в будущем');
  if (
    !['TITLE', 'SEASON'].includes(input.scope) ||
    typeof input.isRewatch !== 'boolean'
  )
    throw new BadRequestException('Проверьте тип записи и отметку пересмотра');
  const season = input.season ?? null;
  if (input.scope === 'SEASON') {
    if (
      !movie.isSerial ||
      !Number.isInteger(season) ||
      season === null ||
      season < 1 ||
      season > Math.min(movie.seasonCount ?? 100, 100)
    )
      throw new BadRequestException('Укажите допустимый сезон сериала');
  } else if (season !== null) {
    throw new BadRequestException(
      'Для полного просмотра номер сезона не нужен',
    );
  }
  const rating = input.rating ?? null;
  if (
    rating !== null &&
    (!Number.isInteger(rating) || rating < 1 || rating > 10)
  )
    throw new BadRequestException('Оценка должна быть целым числом от 1 до 10');
  const note = input.note ?? '';
  if (!isPlainText(note, true) || note.length > 500)
    throw new BadRequestException(
      'Заметка должна содержать до 500 символов без управляющих знаков',
    );
  return {
    viewedOn: new Date(input.viewedOn + 'T00:00:00Z'),
    scope: input.scope,
    season,
    isRewatch: input.isRewatch,
    rating,
    note: note.trim(),
  };
}
