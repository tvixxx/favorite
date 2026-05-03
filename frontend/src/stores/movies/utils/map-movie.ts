import {
  Movie,
  MovieApiResponse,
  UserMovie,
  UserMovieApiResponse,
} from "@/stores";

export function mapMovieFromApi(raw: MovieApiResponse): Movie {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    isSerial: raw.isSerial,
    seasonCount: raw.seasonCount ?? undefined,
    episodeCount: raw.episodeCount ?? undefined,
    countryCodes: raw.countryCodes ?? [],
    genres: raw.genres ?? [],
    publishDate: raw.publishDate,
    imageUrl: raw.poster?.url ?? "",
    createdAt: raw.createdAt,
    actors: raw.actors,
    reviews: raw.reviews,
    _count: raw._count,
  };
}

// Маппит массив ответов API.
export function mapMoviesFromApi(raw: MovieApiResponse[]): Movie[] {
  return raw.map(mapMovieFromApi);
}

// Преобразует ответ API UserMovie в FE модель
export function mapUserMovieFromApi(raw: UserMovieApiResponse): UserMovie {
  return {
    id: raw.id,
    userId: raw.userId,
    movieId: raw.movieId,
    isFavorite: raw.isFavorite,
    seeLater: raw.seeLater,
    personalRate: raw.personalRate,
    watchStatus: raw.watchStatus,
    currentSeason: raw.currentSeason,
    currentEpisode: raw.currentEpisode,
    addedAt: raw.addedAt,
    lastWatchedAt: raw.lastWatchedAt,
    completedAt: raw.completedAt,
    movie: mapMovieFromApi(raw.movie),
  };
}

// Маппит массив UserMovie
export function mapUserMoviesFromApi(raw: UserMovieApiResponse[]): UserMovie[] {
  return raw.map(mapUserMovieFromApi);
}
