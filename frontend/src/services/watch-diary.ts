import type { ContentKind } from "@/utils/content-kind";

export interface DiaryMovie {
  id: string;
  title: string;
  titleEn: string | null;
  isSerial: boolean;
  seasonCount: number | null;
  contentKind: ContentKind | null;
  publishDate: string | null;
  imageUrl: string | null;
}
export interface DiaryDraft {
  viewedOn: string;
  scope: "TITLE" | "SEASON";
  season: number | undefined;
  isRewatch: boolean;
  rating: number | null;
  note: string;
  syncStatus: boolean;
  syncRating: boolean;
}
export interface DiaryValues {
  viewedOn: string;
  scope: "TITLE" | "SEASON";
  season: number | null;
  isRewatch: boolean;
  rating: number | null;
  note: string;
  syncStatus: boolean;
  syncRating: boolean;
}
export interface DiaryEntry {
  id: string;
  viewedOn: string;
  scope: "TITLE" | "SEASON";
  season: number | null;
  isRewatch: boolean;
  rating: number | null;
  note: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  inCollection: boolean;
  movie: DiaryMovie;
}
export interface DiaryStats {
  entries: number;
  titles: number;
  rewatches: number;
}
export interface DiaryPage {
  items: DiaryEntry[];
  total: number;
  stats: DiaryStats;
  today: string;
}
export interface DiarySaveResult {
  status: "saved" | "duplicate";
  entry: DiaryEntry;
  collectionUpdated: boolean;
}
export interface DiaryQuery {
  limit: number;
  offset: number;
  from?: string;
  to?: string;
  q?: string;
  movieId?: string;
  isRewatch?: boolean;
}

export function validDiaryDate(value: string): boolean {
  const date = new Date(value + "T00:00:00Z");

  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "0001-01-01" &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function prepareDiaryValues(
  draft: DiaryDraft,
  movie: DiaryMovie,
  today: string
): DiaryValues {
  if (!validDiaryDate(draft.viewedOn))
    throw new Error("Укажите существующую дату просмотра");
  if (draft.viewedOn > today)
    throw new Error("Дата просмотра не может быть в будущем");
  if (
    draft.scope === "SEASON" &&
    (!movie.isSerial ||
      !Number.isInteger(draft.season) ||
      !draft.season ||
      draft.season < 1 ||
      draft.season > Math.min(movie.seasonCount ?? 100, 100))
  )
    throw new Error("Укажите допустимый сезон сериала");
  if (draft.scope === "SEASON" && draft.syncStatus)
    throw new Error("Просмотр сезона не завершает весь сериал");
  if (
    draft.rating !== null &&
    (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 10)
  )
    throw new Error("Укажите оценку от 1 до 10");
  if (draft.syncRating && draft.rating === null)
    throw new Error("Укажите оценку для обновления коллекции");
  if (
    draft.note.length > 500 ||
    [...draft.note].some((char) => {
      const code = char.charCodeAt(0);

      return (
        (code < 32 && ![9, 10, 13].includes(code)) ||
        (code >= 127 && code <= 159)
      );
    })
  )
    throw new Error(
      "Заметка должна содержать до 500 символов без управляющих знаков"
    );

  return {
    viewedOn: draft.viewedOn,
    scope: draft.scope,
    season: draft.scope === "SEASON" ? draft.season! : null,
    isRewatch: draft.isRewatch,
    rating: draft.rating,
    note: draft.note.trim(),
    syncStatus: draft.syncStatus,
    syncRating: draft.syncRating,
  };
}

export function diaryMonthRange(month: string): { from?: string; to?: string } {
  if (!month) return {};
  if (!/^\d{4}-\d{2}$/.test(month) || !validDiaryDate(month + "-01"))
    throw new Error("Некорректный месяц");

  const end = new Date(month + "-01T00:00:00Z");

  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);

  return { from: month + "-01", to: end.toISOString().slice(0, 10) };
}
