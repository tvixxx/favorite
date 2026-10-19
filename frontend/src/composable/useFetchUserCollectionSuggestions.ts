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
  limit = 10
): Promise<UserMovie[]> {
  const q = query.trim();

  if (!userId || !q) {
    return [];
  }

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(Math.max(limit, 1), 25)),
    offset: "0",
  });
  const { data, status } = await useFetch<{ items: UserMovieApiResponse[] }>(
    `/users/${userId}/movies/page?${params.toString()}`,
    { method: FETCH_METHOD.get }
  );

  if (status !== 200 || !Array.isArray(data?.items)) {
    return [];
  }

  return mapUserMoviesFromApi(data.items);
}

/** Точное совпадение строки «title» с карточкой в коллекции (после поиска). */
export async function findUserMovieByQuotedTitle(
  userId: string,
  quotedTitle: string
): Promise<UserMovie | null> {
  const q = quotedTitle.trim();

  if (!userId || !q) {
    return null;
  }

  const list = await fetchUserCollectionSuggestions(userId, q, 25);

  const matches = list.filter(
    (um) => formatUserMovieShareTitle(um) === quotedTitle
  );

  return list.length < 25 && matches.length === 1 ? matches[0] : null;
}
