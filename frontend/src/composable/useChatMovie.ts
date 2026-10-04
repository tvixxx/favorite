import { ref, watch, type Ref } from "vue";
import { useFetch, FETCH_METHOD } from "@/composable";
import { MOVIES_ENDPOINTS } from "@/constants";
import { mapMovieFromApi } from "@/stores/movies/utils/map-movie";
import type { Movie } from "@/stores/movies/types";
import type { MovieApiResponse } from "@/stores/movies/types/movies.types";
import { isAxiosError } from "axios";

// Кэш фильмов, расшаренных в чате: один запрос на уникальный id за сессию.
const cache = new Map<string, Movie | null>();
const inflight = new Map<string, Promise<Movie | null>>();
const CACHE_LIMIT = 200;

function remember(id: string, movie: Movie | null): void {
  cache.set(id, movie);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

async function loadMovie(id: string): Promise<Movie | null> {
  if (cache.has(id)) {
    return cache.get(id) ?? null;
  }

  const existing = inflight.get(id);
  if (existing) {
    return existing;
  }

  const request = (async (): Promise<Movie | null> => {
    try {
      const { data, status } = await useFetch<MovieApiResponse>(
        `${MOVIES_ENDPOINTS}/${id}`,
        { method: FETCH_METHOD.get },
      );

      const movie = status === 200 ? mapMovieFromApi(data) : null;
      if (status === 200 || status === 404) remember(id, movie);

      return movie;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) remember(id, null);

      return null;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, request);

  return request;
}

/** Реактивно тянет (с кэшем) фильм по id из ссылки шеринга. */
export function useChatMovie(
  id: Ref<string | null | undefined>,
): Ref<Movie | null> {
  const movie = ref<Movie | null>(null);

  watch(
    id,
    async (current, _previous, onCleanup) => {
      let active = true;
      onCleanup(() => { active = false; });
      if (!current) {
        movie.value = null;

        return;
      }

      if (cache.has(current)) {
        movie.value = cache.get(current) ?? null;

        return;
      }

      movie.value = null;
      const loaded = await loadMovie(current);
      if (active) movie.value = loaded;
    },
    { immediate: true },
  );

  return movie;
}
