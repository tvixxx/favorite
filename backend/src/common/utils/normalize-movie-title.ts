export function normalizeMovieTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}
