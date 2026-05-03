export function formatAverageRating(
  value: number | null | undefined
): string | null {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(value).toFixed(1);
}
