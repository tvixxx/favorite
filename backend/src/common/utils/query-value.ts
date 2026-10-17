import { BadRequestException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { isPlainText } from '../validation/plain-text';

export function queryString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`Параметр ${name} должен быть строкой`);
  }

  if (!isPlainText(value))
    throw new BadRequestException(
      `Параметр ${name} содержит недопустимые управляющие символы`,
    );

  return value;
}

export function queryNumber(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number | undefined {
  const raw = queryString(value, name);

  if (raw === undefined) {
    return undefined;
  }

  const parsed = Number(raw);

  if (!raw.trim() || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(`Недопустимое значение ${name}`);
  }

  return parsed;
}

export function queryInteger(
  value: unknown,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = queryNumber(value, name, min, max) ?? fallback;

  if (!Number.isSafeInteger(parsed)) {
    throw new BadRequestException(`Параметр ${name} должен быть целым числом`);
  }

  return parsed;
}

export function queryBoolean(
  value: unknown,
  name: string,
): boolean | undefined {
  const raw = queryString(value, name);

  if (raw === undefined) {
    return undefined;
  }

  if (raw !== 'true' && raw !== 'false') {
    throw new BadRequestException(
      `Параметр ${name} должен быть true или false`,
    );
  }

  return raw === 'true';
}

export function queryDate(value: unknown, name: string): string | undefined {
  const raw = queryString(value, name);

  if (
    raw !== undefined &&
    (!isISO8601(raw, { strict: true }) || !Number.isFinite(Date.parse(raw)))
  ) {
    throw new BadRequestException(`Неверная дата ${name}`);
  }

  return raw;
}

export function queryEnum<T extends string>(
  value: unknown,
  name: string,
  values: T[],
): T | undefined {
  const raw = queryString(value, name);

  if (raw === undefined) {
    return undefined;
  }

  const found = values.find((candidate) => candidate === raw);

  if (found === undefined) {
    throw new BadRequestException(`Недопустимое значение ${name}`);
  }

  return found;
}
