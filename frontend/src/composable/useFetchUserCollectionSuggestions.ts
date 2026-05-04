import { FETCH_METHOD, useFetch } from "@/composable";
import { mapUserMoviesFromApi } from "@/stores/movies/utils/map-movie";
import type {
  UserMovie,
  UserMovieApiResponse,
} from "@/stores/movies/types/movies.types";
import { formatUserMovieShareTitle } from "@/utils/movieShareTitle";

/**
 * Поиск по коллекции пользователя для чата (не трогает userMoviesStore.searchQuery).
 */
export async function fetchUserCollectionSuggestions(
  userId: string,
  query: string,
  limit = 10,
): Promise<UserMovie[]> {
  const q = query.trim();
  if (!userId || !q) {
    return [];
  }
  const params = new URLSearchParams({ q });
  const { data, status } = await useFetch<UserMovieApiResponse[]>(
    `/users/${userId}/movies/search?${params.toString()}`,
    { method: FETCH_METHOD.get },
  );
  if (status !== 200 || !Array.isArray(data)) {
    return [];
  }
  return mapUserMoviesFromApi(data).slice(0, limit);
}

/** Точное совпадение строки «title» с карточкой в коллекции (после поиска). */
export async function findUserMovieByQuotedTitle(
  userId: string,
  quotedTitle: string,
): Promise<UserMovie | null> {
  const q = quotedTitle.trim();
  if (!userId || !q) return null;
  const list = await fetchUserCollectionSuggestions(userId, q, 25);
  return (
    list.find((um) => formatUserMovieShareTitle(um) === quotedTitle) ?? null
  );
}
