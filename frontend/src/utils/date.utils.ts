function parseDate(date: Date | string | null): Date | null {
  if (!date) return null;

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  timezone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "ru-RU"
) {
  const zone =
    typeof timezone === "string" && timezone.length <= 80 ? timezone : "UTC";
  const key = JSON.stringify([zone, locale, options]);
  let current = formatters.get(key);

  if (!current) {
    try {
      current = new Intl.DateTimeFormat(locale, { ...options, timeZone: zone });
    } catch {
      current = new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: "UTC",
      });
    }

    if (formatters.size >= 64)
      formatters.delete(formatters.keys().next().value!);
    formatters.set(key, current);
  }

  return current;
}

export function formatInstant(
  date: Date | string | null,
  timezone = "UTC",
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  const parsed = parseDate(date);

  return parsed ? formatter(timezone, options).format(parsed) : "не указано";
}

export function calendarDateKey(
  date: Date | string | null,
  timezone = "UTC"
): string | null {
  const parsed = parseDate(date);

  if (!parsed) return null;

  const parts = Object.fromEntries(
    formatter(
      timezone,
      {
        calendar: "iso8601",
        numberingSystem: "latn",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
      "en-CA"
    )
      .formatToParts(parsed)
      .map((part) => [part.type, part.value])
  );

  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
}

export const formatDate = (date: Date | string | null, timezone = "UTC") => {
  const parsed = parseDate(date);

  if (!parsed) {
    return "не указано";
  }

  return formatter(timezone, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
};

export const formatYear = (date: Date | string | null) => {
  const parsed = parseDate(date);

  if (!parsed) {
    return "не указано";
  }

  return formatter("UTC", {
    year: "numeric",
  }).format(parsed);
};

export const formatDateTime = (
  date: Date | string | null,
  timezone = "UTC"
) => {
  const parsed = parseDate(date);

  if (!parsed) {
    return "не указано";
  }

  return formatter(timezone, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};
