export interface CatalogRecord {
  id: string;
  title: string;
  description: string;
  genres: readonly string[];
  countryCodes: readonly string[];
  publishDate: string | null;
  isSerial: boolean;
  seasonCount?: number | null;
  episodeCount?: number | null;
  poster: { url: string; assetId?: string | null } | null;
  _count: { actors: number };
}

export const catalogIssueLabels = {
  poster: "Без постера",
  date: "Без даты",
  actors: "Без актёров",
  description: "Без описания",
  genres: "Без жанров",
  countries: "Без страны",
  serial: "Проверить сезоны и эпизоды",
  "invalid-date": "Некорректная дата",
  "poster-url": "Некорректный адрес постера",
  duplicate: "Возможный дубль",
  "poster-unavailable": "Постер не загрузился",
  "poster-timeout": "Постер не проверен: таймаут",
} as const;
export type CatalogIssue = keyof typeof catalogIssueLabels;
export type PosterCheck = "loaded" | "unavailable" | "timeout";
export interface CatalogSummary {
  id: string;
  title: string;
  year: number | null;
  isSerial: boolean;
}
export interface CatalogFinding extends CatalogSummary {
  issues: CatalogIssue[];
  duplicates: CatalogSummary[];
  duplicateCount: number;
}

export function posterAddress(value: string): URL | null {
  try {
    const url = new URL(value, location.origin);

    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}

export function diagnoseCatalog(
  records: readonly CatalogRecord[],
  posters: Record<string, PosterCheck> = {}
): CatalogFinding[] {
  const summaries = records.map(
    (movie): CatalogSummary => ({
      id: movie.id,
      title: movie.title,
      isSerial: movie.isSerial,
      year:
        movie.publishDate && Number.isFinite(Date.parse(movie.publishDate))
          ? new Date(movie.publishDate).getUTCFullYear()
          : null,
    })
  );
  const key = (movie: CatalogSummary): string =>
    `${movie.isSerial}:${movie.title
      .normalize("NFKC")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]/gu, "")}`;
  const groups = new Map<string, Map<number | null, CatalogSummary[]>>();
  for (const movie of summaries) {
    const name = key(movie);
    const years =
      groups.get(name) ?? new Map<number | null, CatalogSummary[]>();
    const members = years.get(movie.year) ?? [];
    members.push(movie);
    years.set(movie.year, members);
    groups.set(name, years);
  }

  return records.flatMap((movie, index): CatalogFinding[] => {
    const summary = summaries[index];
    const issues: CatalogIssue[] = [];
    if (!movie.poster?.url.trim()) issues.push("poster");
    else if (!posterAddress(movie.poster.url)) issues.push("poster-url");
    if (!movie.publishDate) issues.push("date");
    else if (summary.year === null) issues.push("invalid-date");
    if (!movie._count.actors) issues.push("actors");
    if (!movie.description.trim()) issues.push("description");
    if (!movie.genres.length) issues.push("genres");
    if (!movie.countryCodes.length) issues.push("countries");
    const integerIn = (
      value: number | null | undefined,
      max: number
    ): boolean =>
      Number.isInteger(value) && Number(value) > 0 && Number(value) <= max;
    if (
      movie.isSerial
        ? !integerIn(movie.seasonCount, 1000) ||
          !integerIn(movie.episodeCount, 10000)
        : !!movie.seasonCount || !!movie.episodeCount
    )
      issues.push("serial");
    const years = groups.get(key(summary))!;
    const buckets =
      summary.year === null
        ? [...years.values()]
        : [years.get(summary.year) ?? [], years.get(null) ?? []];
    const duplicateCount = buckets.reduce(
      (count, members) => count + members.length,
      -1
    );
    const duplicates: CatalogSummary[] = [];
    for (const members of buckets) {
      for (const other of members) {
        if (other.id !== movie.id && duplicates.length < 5)
          duplicates.push(other);
        if (duplicates.length === 5) break;
      }

      if (duplicates.length === 5) break;
    }

    if (duplicateCount > 0) issues.push("duplicate");
    if (posters[movie.id] === "unavailable") issues.push("poster-unavailable");
    if (posters[movie.id] === "timeout") issues.push("poster-timeout");

    return issues.length
      ? [{ ...summary, issues, duplicates, duplicateCount }]
      : [];
  });
}

export function probePoster(
  url: string,
  signal: AbortSignal
): Promise<PosterCheck> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Проверка отменена", "AbortError"));

      return;
    }

    const image = new Image();
    let finished = false;
    const cleanup = (): void => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      image.src = "data:,";
    };

    const complete = (status: PosterCheck): void => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(status);
    };

    const abort = (): void => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new DOMException("Проверка отменена", "AbortError"));
    };

    const timer = setTimeout(() => complete("timeout"), 8000);
    image.referrerPolicy = "no-referrer";
    image.onload = () =>
      complete(image.naturalWidth > 0 ? "loaded" : "unavailable");
    image.onerror = () => complete("unavailable");
    signal.addEventListener("abort", abort, { once: true });
    image.src = url;
  });
}
