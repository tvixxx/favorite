import api from "./api";
import type {
  DiaryQuery,
  DiaryPage,
  DiaryValues,
  DiarySaveResult,
  DiaryMovie,
} from "./watch-diary";
import type {
  Movie,
  UserMovieApiResponse,
} from "@/stores/movies/types/movies.types";
import { mapUserMovieFromApi } from "@/stores/movies/utils/map-movie";

export function toDiaryMovie(movie: Movie): DiaryMovie {
  return {
    id: movie.id,
    title: movie.title,
    titleEn: movie.titleEn ?? null,
    isSerial: movie.isSerial,
    seasonCount: movie.seasonCount ?? null,
    contentKind: movie.contentKind ?? null,
    publishDate: movie.publishDate ?? null,
    imageUrl: movie.imageUrl ?? null,
  };
}

export async function listDiary(
  userId: string,
  query: DiaryQuery,
  signal: AbortSignal
): Promise<DiaryPage> {
  return (
    await api.get<DiaryPage>(`/users/${userId}/watch-diary`, {
      params: query,
      signal,
    })
  ).data;
}

export async function createDiary(
  userId: string,
  payload: DiaryValues & {
    movieId: string;
    requestId: string;
    allowDuplicate: boolean;
  },
  signal: AbortSignal
): Promise<DiarySaveResult> {
  return (
    await api.post<DiarySaveResult>(`/users/${userId}/watch-diary`, payload, {
      signal,
    })
  ).data;
}

export async function updateDiary(
  userId: string,
  id: string,
  payload: Omit<DiaryValues, "syncStatus" | "syncRating"> & {
    revision: number;
    allowDuplicate: boolean;
  },
  signal: AbortSignal
): Promise<DiarySaveResult> {
  return (
    await api.patch<DiarySaveResult>(
      `/users/${userId}/watch-diary/${id}`,
      payload,
      { signal }
    )
  ).data;
}

export async function removeDiary(
  userId: string,
  id: string,
  revision: number,
  signal: AbortSignal
): Promise<void> {
  await api.delete(`/users/${userId}/watch-diary/${id}`, {
    params: { revision },
    signal,
  });
}

export async function diaryMovies(
  userId: string,
  q: string,
  signal: AbortSignal
): Promise<DiaryMovie[]> {
  const { data } = await api.get<{ items: UserMovieApiResponse[] }>(
    `/users/${userId}/movies/page`,
    { params: { q: q || undefined, limit: 20, offset: 0 }, signal }
  );

  return data.items.map((item) =>
    toDiaryMovie(mapUserMovieFromApi(item).movie)
  );
}
