import { BadRequestException } from '@nestjs/common';
import { WatchStatus } from '../generated/prisma/enums';

export const MAX_IMPORT_BYTES = 32 * 1024;
export const MAX_IMPORT_ROWS = 200;
const fields = [
  'title',
  'isSerial',
  'year',
  'watchStatus',
  'isFavorite',
  'seeLater',
  'personalRate',
];
const required = ['title', 'isSerial', 'watchStatus'];
export interface CollectionEntry {
  title: string;
  isSerial: boolean;
  year?: number;
  watchStatus: WatchStatus;
  isFavorite: boolean;
  seeLater: boolean;
  personalRate: number;
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
        if (rows.length > MAX_IMPORT_ROWS + 1)
          invalid(`Не более ${MAX_IMPORT_ROWS} записей за один импорт`);
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
function csvObjects(content: string): unknown[] {
  const [header, ...rows] = csvRows(content);
  if (
    !header ||
    new Set(header).size !== header.length ||
    header.some((key) => !fields.includes(key)) ||
    required.some((key) => !header.includes(key))
  )
    invalid(
      'CSV: ожидаются уникальные заголовки title,isSerial,watchStatus и разрешённые необязательные поля',
    );
  return rows.map((values, index) => {
    if (values.length !== header.length)
      invalid(`Запись ${index + 1}: число колонок отличается от заголовка`);
    return Object.fromEntries(
      header.flatMap<[string, string | number | boolean]>((key, column) => {
        const value = values[column];
        if (value === '' && !required.includes(key)) return [];
        if (['isSerial', 'isFavorite', 'seeLater'].includes(key)) {
          if (value !== 'true' && value !== 'false')
            invalid(
              `Запись ${index + 1}: ${key} принимает только true или false`,
            );
          return [[key, value === 'true']];
        }
        if (['year', 'personalRate'].includes(key)) {
          if (!/^\d+$/.test(value))
            invalid(`Запись ${index + 1}: ${key} должно быть целым числом`);
          return [[key, Number(value)]];
        }
        return [[key, value]];
      }),
    );
  });
}

export function parseCollectionFile(
  format: 'csv' | 'json',
  content: string,
): CollectionEntry[] {
  if (
    typeof content !== 'string' ||
    Buffer.byteLength(content, 'utf8') > MAX_IMPORT_BYTES
  )
    invalid('Файл должен быть текстовым и не больше 32 КБ');
  const text = content.replace(/^\ufeff/, '');
  let rows: unknown;
  if (format === 'json') {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      invalid('Некорректный JSON');
    }
    if (
      !object(data) ||
      data.version !== 1 ||
      Object.keys(data).some((key) => !['version', 'movies'].includes(key))
    )
      invalid('Ожидается JSON {version:1,movies:[...]}');
    rows = data.movies;
  } else if (format === 'csv') rows = csvObjects(text);
  else invalid('Поддерживаются только CSV и JSON');
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_IMPORT_ROWS)
    invalid(`Файл должен содержать от 1 до ${MAX_IMPORT_ROWS} записей`);
  return rows.map((row: unknown, index) => {
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
    if (!Object.values(WatchStatus).includes(row.watchStatus as WatchStatus))
      fail('watchStatus');
    if (
      row.year !== undefined &&
      (!Number.isInteger(row.year) ||
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
      watchStatus: row.watchStatus as WatchStatus,
      isFavorite: (row.isFavorite as boolean | undefined) ?? false,
      seeLater: (row.seeLater as boolean | undefined) ?? false,
      personalRate: (row.personalRate as number | undefined) ?? 0,
    };
  });
}
