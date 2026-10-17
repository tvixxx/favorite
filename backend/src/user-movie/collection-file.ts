import { BadRequestException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { ContentKind, WatchStatus } from '../generated/prisma/enums';
import {
  MIN_MEDIA_YEAR,
  maxMediaYear,
  isMediaYear,
  MAX_SEASONS,
  MAX_EPISODES,
} from '../common/validation/media-numbers';

export const MAX_IMPORT_BYTES = 32 * 1024;
export const MAX_IMPORT_ROWS = 200;
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const MAX_SNAPSHOT_ROWS = 1000;
const fields = [
  'title',
  'isSerial',
  'year',
  'watchStatus',
  'isFavorite',
  'seeLater',
  'personalRate',
  'contentKind',
];
const required = ['title', 'isSerial', 'watchStatus'];
export const snapshotFields = [
  ...fields,
  'currentSeason',
  'currentEpisode',
  'addedAt',
  'lastWatchedAt',
  'startedAt',
  'completedAt',
  'droppedAt',
];
const dateFields = [
  'addedAt',
  'lastWatchedAt',
  'startedAt',
  'completedAt',
  'droppedAt',
];
export interface CollectionEntry {
  title: string;
  isSerial: boolean;
  year?: number | null;
  contentKind?: ContentKind | null;
  watchStatus: WatchStatus;
  isFavorite: boolean;
  seeLater: boolean;
  personalRate: number | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
  addedAt?: string;
  lastWatchedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  droppedAt?: string | null;
}
function invalid(message: string): never {
  throw new BadRequestException(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function csvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (ch === '"' && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else cell += ch;
      continue;
    }
    if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (ch !== ',') {
        rows.push(row);
        row = [];
        if (ch === '\r' && content[i + 1] === '\n') i++;
        if (rows.length > MAX_SNAPSHOT_ROWS + 1)
          invalid(`Не более ${MAX_SNAPSHOT_ROWS} записей за один импорт`);
      }
    } else if (ch === '"' && cell === '' && !closed) quoted = true;
    else if (ch === '"' || closed)
      invalid(`Повреждён CSV рядом с записью ${rows.length}`);
    else cell += ch;
  }
  if (quoted) invalid('В CSV не закрыты кавычки');
  if (cell !== '' || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
function csvObjects(content: string): { version: number; rows: unknown[] } {
  const [header, ...rows] = csvRows(content);
  const version = header?.includes('formatVersion') ? 2 : 1;
  const allowed = version === 2 ? ['formatVersion', ...snapshotFields] : fields;
  const mandatory = version === 2 ? allowed : required;
  if (
    !header ||
    new Set(header).size !== header.length ||
    header.some((key) => !allowed.includes(key)) ||
    mandatory.some((key) => !header.includes(key))
  )
    invalid(
      'CSV: ожидаются уникальные заголовки title,isSerial,watchStatus и разрешённые необязательные поля',
    );
  return {
    version,
    rows: rows.map((values, index) => {
      if (values.length !== header.length)
        invalid(`Запись ${index + 1}: число колонок отличается от заголовка`);
      return Object.fromEntries(
        header.flatMap<[string, string | number | boolean | null]>(
          (key, column) => {
            const value = values[column];
            if (key === 'formatVersion') {
              if (value !== '2')
                invalid(`Запись ${index + 1}: неверная версия CSV`);
              return [];
            }
            if (version === 2 && key === 'title') {
              if (!value.startsWith("'"))
                invalid(
                  `Запись ${index + 1}: title в CSV v2 должен начинаться с защитного апострофа`,
                );
              return [[key, value.slice(1)]];
            }
            if (
              version === 2 &&
              value === '' &&
              ![
                'title',
                'isSerial',
                'watchStatus',
                'isFavorite',
                'seeLater',
                'addedAt',
              ].includes(key)
            )
              return [[key, null]];
            if (value === '' && !required.includes(key)) return [];
            if (['isSerial', 'isFavorite', 'seeLater'].includes(key)) {
              if (value !== 'true' && value !== 'false')
                invalid(
                  `Запись ${index + 1}: ${key} принимает только true или false`,
                );
              return [[key, value === 'true']];
            }
            if (
              [
                'year',
                'personalRate',
                'currentSeason',
                'currentEpisode',
              ].includes(key)
            ) {
              if (!/^(0|[1-9]\d*)$/.test(value))
                invalid(`Запись ${index + 1}: ${key} должно быть целым числом`);
              return [[key, Number(value)]];
            }
            return [[key, value]];
          },
        ),
      );
    }),
  };
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    isISO8601(value, { strict: true, strictSeparator: true }) &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function snapshot(
  row: Record<string, unknown>,
  index: number,
  enforceMediaLimits: boolean,
): CollectionEntry {
  const fail = (key: string): never =>
    invalid(`Запись ${index + 1}: проверьте поле ${key}`);
  if (
    Object.keys(row).some((key) => !snapshotFields.includes(key)) ||
    snapshotFields.some(
      (key) => !Object.prototype.hasOwnProperty.call(row, key),
    )
  )
    fail('структура');
  if (
    typeof row.title !== 'string' ||
    !row.title.trim() ||
    row.title.length > 300 ||
    [...row.title].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    fail('title');
  for (const key of ['isSerial', 'isFavorite', 'seeLater'])
    if (typeof row[key] !== 'boolean') fail(key);
  if (!Object.values(WatchStatus).includes(row.watchStatus as WatchStatus))
    fail('watchStatus');
  if (
    row.contentKind !== null &&
    !Object.values(ContentKind).includes(row.contentKind as ContentKind)
  )
    fail('contentKind');
  for (const [key, min, max] of [
    [
      'year',
      enforceMediaLimits ? MIN_MEDIA_YEAR : 1,
      enforceMediaLimits ? maxMediaYear() : 9999,
    ],
    ['personalRate', 0, 10],
    ['currentSeason', 0, enforceMediaLimits ? MAX_SEASONS : 2147483647],
    ['currentEpisode', 0, enforceMediaLimits ? MAX_EPISODES : 2147483647],
  ] as const) {
    const value = row[key];
    if (
      value !== null &&
      (typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < min ||
        value > max)
    )
      fail(key);
  }
  if (
    !row.isSerial &&
    (Number(row.currentSeason) > 0 || Number(row.currentEpisode) > 0)
  )
    fail('прогресс доступен только сериалам');
  const normalized = { ...row };
  for (const key of dateFields) {
    if (row[key] === null && key !== 'addedAt') continue;
    if (!timestamp(row[key])) fail(key);
    normalized[key] = new Date(row[key] as string).toISOString();
  }
  return normalized as unknown as CollectionEntry;
}

export function parseCollectionFile(
  format: 'csv' | 'json',
  content: string,
  enforceMediaLimits = true,
): CollectionEntry[] {
  if (
    typeof content !== 'string' ||
    Buffer.byteLength(content, 'utf8') > MAX_SNAPSHOT_BYTES
  )
    invalid('Файл должен быть текстовым и не больше 2 МиБ');
  const text = content.replace(/^\ufeff/, '');
  let rows: unknown;
  let version = 1;
  if (format === 'json') {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      invalid('Некорректный JSON');
    }
    if (
      !object(data) ||
      ![1, 2].includes(data.version as number) ||
      Object.keys(data).some(
        (key) =>
          !(
            data.version === 2
              ? ['version', 'movies', 'exportedAt']
              : ['version', 'movies']
          ).includes(key),
      )
    )
      invalid('Ожидается JSON версии 1 или 2 с массивом movies');
    version = data.version as number;
    if (data.exportedAt !== undefined && !timestamp(data.exportedAt))
      invalid('Неверная дата exportedAt');
    rows = data.movies;
  } else if (format === 'csv') ({ version, rows } = csvObjects(text));
  else invalid('Поддерживаются только CSV и JSON');
  const limit = version === 2 ? MAX_SNAPSHOT_ROWS : MAX_IMPORT_ROWS;
  if (version === 1 && Buffer.byteLength(content, 'utf8') > MAX_IMPORT_BYTES)
    invalid('Файл версии 1 должен быть не больше 32 КБ');
  if (
    !Array.isArray(rows) ||
    (version === 1 && !rows.length) ||
    rows.length > limit
  )
    invalid(`Файл должен содержать не более ${limit} записей`);
  return rows.map((row: unknown, index) => {
    if (version === 2) {
      if (!object(row)) invalid(`Запись ${index + 1}: неверная структура`);
      return snapshot(row, index, enforceMediaLimits);
    }
    const fail = (field: string): never =>
      invalid(`Запись ${index + 1}: проверьте поле ${field}`);
    if (!object(row) || Object.keys(row).some((key) => !fields.includes(key)))
      return fail('структура или лишние поля');
    if (
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      row.title.length > 300 ||
      [...row.title].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      fail('title');
    if (typeof row.isSerial !== 'boolean') fail('isSerial');
    if (
      row.contentKind !== undefined &&
      !Object.values(ContentKind).includes(row.contentKind as ContentKind)
    )
      fail('contentKind');
    if (!Object.values(WatchStatus).includes(row.watchStatus as WatchStatus))
      fail('watchStatus');
    if (
      row.year !== undefined &&
      ((enforceMediaLimits && !isMediaYear(row.year)) ||
        !Number.isInteger(row.year) ||
        Number(row.year) < 1 ||
        Number(row.year) > 9999)
    )
      fail('year');
    for (const key of ['isFavorite', 'seeLater'])
      if (row[key] !== undefined && typeof row[key] !== 'boolean') fail(key);
    if (
      row.personalRate !== undefined &&
      (!Number.isInteger(row.personalRate) ||
        Number(row.personalRate) < 0 ||
        Number(row.personalRate) > 10)
    )
      fail('personalRate');
    return {
      title: (row.title as string).trim(),
      isSerial: row.isSerial as boolean,
      year: row.year as number | undefined,
      ...(row.contentKind !== undefined
        ? { contentKind: row.contentKind as ContentKind }
        : {}),
      watchStatus: row.watchStatus as WatchStatus,
      isFavorite: (row.isFavorite as boolean | undefined) ?? false,
      seeLater: (row.seeLater as boolean | undefined) ?? false,
      personalRate: (row.personalRate as number | undefined) ?? 0,
    };
  });
}

export function serializeCollectionFile(
  format: 'json' | 'csv',
  movies: CollectionEntry[],
  exportedAt: string,
): string {
  const json = JSON.stringify({ version: 2, exportedAt, movies }, null, 2);
  // Старые записи можно выгрузить без потерь, новые границы применяются при импорте.
  parseCollectionFile('json', json, false);
  if (format === 'json') return json;
  const quote = (value: string | number | boolean | null | undefined): string =>
    '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const csv =
    '\ufeff' +
    ['formatVersion', ...snapshotFields].map(quote).join(',') +
    '\r\n' +
    movies
      .map((movie) =>
        [
          '2',
          ...snapshotFields.map((key) =>
            key === 'title'
              ? "'" + movie.title
              : movie[key as keyof CollectionEntry],
          ),
        ]
          .map(quote)
          .join(','),
      )
      .join('\r\n') +
    '\r\n';
  parseCollectionFile('csv', csv, false);
  return csv;
}
