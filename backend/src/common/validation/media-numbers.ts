import { ValidateBy } from 'class-validator';

export const MIN_MEDIA_YEAR = 1920;
export const MAX_SEASONS = 100;
export const MAX_EPISODES = 5000;

export function maxMediaYear(): number {
  return new Date().getUTCFullYear() + 5;
}

export function isMediaYear(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MEDIA_YEAR &&
    value <= maxMediaYear()
  );
}

export function IsMediaYear(): PropertyDecorator {
  return ValidateBy({
    name: 'mediaYear',
    validator: {
      validate: isMediaYear,
      defaultMessage: () =>
        `Год должен быть от ${MIN_MEDIA_YEAR} до ${maxMediaYear()}`,
    },
  });
}

export function IsMediaDate(): PropertyDecorator {
  return ValidateBy({
    name: 'mediaDate',
    validator: {
      validate: (value) =>
        typeof value === 'string' &&
        /^\d{4}-/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        isMediaYear(Number(value.slice(0, 4))),
      defaultMessage: () =>
        `Год выхода должен быть от ${MIN_MEDIA_YEAR} до ${maxMediaYear()}`,
    },
  });
}
