function parseDate(date: Date | string | null): Date | null {
  if (!date) return null;
  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const formatDate = (date: Date | string | null) => {
  const parsed = parseDate(date);
  if (!parsed) {
    return "не указано";
  }

  return parsed.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatYear = (date: Date | string | null) => {
  const parsed = parseDate(date);
  if (!parsed) {
    return "не указано";
  }

  return parsed.toLocaleDateString("ru-RU", {
    year: "numeric",
  });
};

export const formatDateTime = (date: Date | string | null) => {
  const parsed = parseDate(date);
  if (!parsed) {
    return "не указано";
  }

  return parsed.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
