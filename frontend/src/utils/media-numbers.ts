export const MIN_MEDIA_YEAR = 1920;
export const MAX_SEASONS = 100;
export const MAX_EPISODES = 5000;

export function maxMediaYear(): number {
  return new Date().getUTCFullYear() + 5;
}

export function progressMax(
  total: number | null | undefined,
  maximum: number
): number {
  return typeof total === "number" && Number.isInteger(total) && total >= 0
    ? Math.min(total, maximum)
    : maximum;
}

export function isOptionalInteger(
  value: unknown,
  min: number,
  max: number
): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max)
  );
}

export function isMediaDate(value: string | null | undefined): boolean {
  return (
    !value ||
    (/^\d{4}-/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      isOptionalInteger(
        Number(value.slice(0, 4)),
        MIN_MEDIA_YEAR,
        maxMediaYear()
      ))
  );
}

export function numericDraftError(
  raw: string,
  rules: { min?: number; max?: number; minDigits?: number; maxDigits?: number }
): string {
  if (!raw) return "";
  if (!/^\d+$/.test(raw))
    return "Введите целое число без знаков и дробной части";
  if (/^0\d/.test(raw)) return "Введите число без нулей в начале";

  const minDigits = rules.minDigits ?? 1;
  const maxDigits =
    rules.maxDigits ??
    (rules.max === undefined ? undefined : String(rules.max).length);

  if (minDigits === maxDigits && raw.length !== minDigits)
    return `Введите число из ${minDigits} ${
      minDigits === 1 ? "цифры" : "цифр"
    }`;
  if (raw.length < minDigits) return `Введите не меньше ${minDigits} цифр`;
  if (maxDigits !== undefined && raw.length > maxDigits)
    return `Введите не больше ${maxDigits} цифр`;

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) return "Слишком большое число";
  if (
    (rules.min !== undefined && value < rules.min) ||
    (rules.max !== undefined && value > rules.max)
  ) {
    return rules.min !== undefined && rules.max !== undefined
      ? `Укажите число от ${rules.min} до ${rules.max}`
      : rules.max !== undefined
      ? `Укажите число не больше ${rules.max}`
      : `Укажите число не меньше ${rules.min}`;
  }

  return "";
}
