import type { Router } from "vue-router";
import { buildMovieDetailAbsoluteUrl } from "@/utils/movieShareLink";

export type MovieChip = { movieId: string; title: string };

export function dedupeMovieChipsById(pool: MovieChip[]): MovieChip[] {
  const byId = new Map<string, MovieChip>();
  for (const c of pool) {
    if (!byId.has(c.movieId)) byId.set(c.movieId, c);
  }
  return [...byId.values()];
}

/**
 * Оставляет не более одного чипа на movieId: порядок — первое появление «title» в тексте.
 */
export function alignChipsToQuotedTitles(
  text: string,
  pool: MovieChip[],
): MovieChip[] {
  const dedupedPool = dedupeMovieChipsById(pool);
  const result: MovieChip[] = [];
  const seenMovieIds = new Set<string>();
  const re = /«([^»]+)»/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const title = m[1];
    const chip = dedupedPool.find((c) => c.title === title);
    if (chip && !seenMovieIds.has(chip.movieId)) {
      result.push(chip);
      seenMovieIds.add(chip.movieId);
    }
  }
  return result;
}

/**
 * Подставляет URL у каждого «title», если для строки есть чип (одинаковый фильм — одна ссылка).
 */
export function expandMessageWithMovieUrls(
  text: string,
  chips: MovieChip[],
  router: Router,
): string {
  const byTitle = new Map<string, MovieChip>();
  for (const c of dedupeMovieChipsById(chips)) {
    if (!byTitle.has(c.title)) byTitle.set(c.title, c);
  }
  return text.replace(/«([^»]+)»/g, (full, titleInner: string) => {
    const chip = byTitle.get(titleInner);
    if (!chip) return full;
    const url = buildMovieDetailAbsoluteUrl(router, chip.movieId);
    return `«${chip.title}» ${url}`;
  });
}

const MOVIE_PAIR_IN_TEXT =
  /«([^»]+)»\s+(https?:\/\/[^\s<>"']+)/g;

/**
 * Убирает из текста URL после «title», возвращает очищенный текст и movieId из /detail/:id.
 */
export function stripMovieUrlsFromText(text: string): {
  cleaned: string;
  extracted: MovieChip[];
} {
  const extracted: MovieChip[] = [];
  const cleaned = text.replace(
    MOVIE_PAIR_IN_TEXT,
    (whole: string, title: string, urlStr: string) => {
      try {
        const u = new URL(urlStr, window.location.origin);
        const m = u.pathname.match(/^\/detail\/([^/]+)\/?$/);
        if (m && !extracted.some((e) => e.movieId === m[1])) {
          extracted.push({ movieId: m[1], title });
        }
      } catch {
        /* ignore */
      }
      return `«${title}»`;
    },
  );
  return { cleaned, extracted };
}
