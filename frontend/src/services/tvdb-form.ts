import { MAX_EPISODES, MAX_SEASONS } from "@/utils/media-numbers";

export interface TvdbFormPreview {
  id: string;
  type: "movie" | "series";
  title: string;
  description: string;
  descriptionLanguage: "ru" | "en";
  countryCodes: string[];
  genres: string[];
  contentKind: string;
  isSerial: boolean;
  seasonCount: number | null;
  episodeCount: number | null;
}
export interface TvdbCollection {
  watchStatus?: string;
  seeLater?: boolean;
  currentEpisode?: number;
  currentSeason?: number;
}
export function prepareTvdbImport(
  preview: TvdbFormPreview,
  edits: Partial<TvdbFormPreview>,
  collection: TvdbCollection,
  existingMovieId?: string
): Record<string, unknown> {
  const personal = {
    watchStatus: "NOT_STARTED",
    seeLater: true,
    ...collection,
  };
  const identity = { id: preview.id, type: preview.type, collection: personal };

  if (existingMovieId) return { ...identity, existingMovieId };

  const value = { ...preview, ...edits };

  if (!value.title.trim())
    throw new Error("Введите название для русского интерфейса");
  if (!value.description.trim()) throw new Error("Введите описание");
  if (!value.genres.length) throw new Error("Выберите хотя бы один жанр");
  if (
    personal.watchStatus === "NOT_STARTED" &&
    ((personal.currentEpisode ?? 0) > 0 || (personal.currentSeason ?? 0) > 0)
  )
    throw new Error("Выберите статус просмотра для указанного прогресса");
  for (const [progress, cap, max] of [
    [personal.currentEpisode, preview.episodeCount, MAX_EPISODES],
    [personal.currentSeason, preview.seasonCount, MAX_SEASONS],
  ] as const) {
    if (
      progress !== undefined &&
      (!Number.isInteger(progress) ||
        progress < 0 ||
        progress > max ||
        (!preview.isSerial && progress > 0) ||
        (cap !== null && progress > cap))
    )
      throw new Error("Недопустимый прогресс просмотра");
  }

  return {
    ...identity,
    title: value.title.trim(),
    description: value.description.trim(),
    descriptionLanguage: value.descriptionLanguage,
    countryCodes: value.countryCodes,
    genres: value.genres,
    contentKind: value.contentKind,
  };
}
