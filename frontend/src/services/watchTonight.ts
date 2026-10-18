import api from "@/services/api";
import type {
  MovieApiResponse,
  UserMovieApiResponse,
} from "@/stores/movies/types";

export async function fetchWatchTonight(
  userId: string,
  signal: AbortSignal
): Promise<MovieApiResponse[]> {
  const movies: MovieApiResponse[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total: number | undefined;

  do {
    const params = new URLSearchParams({
      seeLater: "true",
      watchStatus: "NOT_STARTED",
      limit: "100",
      offset: String(offset),
    });
    const { data } = await api.get<{
      items: UserMovieApiResponse[];
      total: number;
    }>(`/users/${userId}/movies/page?${params}`, { signal });

    if (signal.aborted) throw new DOMException("Отменено", "AbortError");
    if (
      !Array.isArray(data.items) ||
      !Number.isSafeInteger(data.total) ||
      data.total < 0 ||
      (total !== undefined && total !== data.total)
    )
      throw new Error("Список изменился. Повторите подбор.");
    total = data.total;
    if (
      (!data.items.length && offset < total) ||
      offset + data.items.length > total
    )
      throw new Error("Неполный список");
    for (const row of data.items) {
      if (
        row.userId !== userId ||
        !row.movieId ||
        row.movie?.id !== row.movieId ||
        typeof row.movie.title !== "string" ||
        !Array.isArray(row.movie.genres) ||
        seen.has(row.movieId)
      )
        throw new Error("Некорректный список");
      seen.add(row.movieId);
      if (row.seeLater && row.watchStatus === "NOT_STARTED")
        movies.push(row.movie);
    }

    offset += data.items.length;
  } while (offset < total);

  return movies;
}
