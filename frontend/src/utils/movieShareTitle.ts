import type { Movie } from "@/stores/movies/types/movies.types";
import type { UserMovie } from "@/stores/movies/types/movies.types";

/** Как в карточках и при отправке «…» в чат */
export function formatMovieShareTitleFromMovie(movie: Movie): string {
  const t = movie.title;
  return movie.isSerial ? `${t} (сериал)` : t;
}

export function formatUserMovieShareTitle(um: UserMovie): string {
  return formatMovieShareTitleFromMovie(um.movie);
}
