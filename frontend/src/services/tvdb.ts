import api from "./api";
import type { TvdbFormPreview } from "./tvdb-form";
import type { ContentKind } from "@/utils/content-kind";

export interface TvdbCandidate {
  id: string;
  type: "movie" | "series";
  title: string;
  titleEn: string | null;
  originalTitle: string;
  year: number | null;
  posterUrl: string | null;
  aliases: string[];
  localMovieId: string | null;
  inCollection: boolean;
}
export interface TvdbPreview extends TvdbCandidate, TvdbFormPreview {
  contentKind: ContentKind;
  unmappedGenres: string[];
  actors: { id: string; name: string }[];
  localMatches: {
    id: string;
    title: string;
    publishDate: string | null;
    isSerial: boolean;
    contentKind: ContentKind | null;
  }[];
}
export async function tvdbEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    return (
      (
        await api.get<{ enabled: boolean }>("/catalog/tvdb/capabilities", {
          signal,
        })
      ).data.enabled === true
    );
  } catch {
    return false;
  }
}

export async function searchTvdb(
  query: string,
  type: string,
  year: number | undefined,
  signal: AbortSignal
): Promise<TvdbCandidate[]> {
  return (
    await api.get<TvdbCandidate[]>("/catalog/tvdb/search", {
      params: { query, type: type || undefined, year },
      signal,
    })
  ).data;
}

export async function previewTvdb(
  candidate: TvdbCandidate,
  signal: AbortSignal
): Promise<TvdbPreview> {
  return (
    await api.get<TvdbPreview>("/catalog/tvdb/preview", {
      params: { id: candidate.id, type: candidate.type },
      signal,
    })
  ).data;
}

export async function importTvdb(
  payload: Record<string, unknown>,
  signal: AbortSignal
): Promise<{ movieId: string; alreadyInCollection: boolean }> {
  return (
    await api.post<{ movieId: string; alreadyInCollection: boolean }>(
      "/catalog/tvdb/import",
      payload,
      { signal }
    )
  ).data;
}
