export function catalogPublishDate(
  year: number | null,
  original: string | null
): string | null {
  if (original && new Date(original).getUTCFullYear() === year) {
    return original;
  }

  return year ? `${year}-01-01T00:00:00.000Z` : null;
}
