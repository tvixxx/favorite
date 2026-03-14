import { Movie, MovieApiResponse } from "@/stores";

// Преобразует ответ API в FE модель Movie.
// Извлекает poster.url → imageUrl.
// Убирает null из genre (фронт использует undefined).
export function mapMovieFromApi(raw: MovieApiResponse): Movie {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    rate: raw.rate,
    isFavorite: raw.isFavorite,
    seeLater: raw.seeLater,
    isSerial: raw.isSerial,
    seasonCount: raw.seasonCount ?? undefined,
    episodeCount: raw.episodeCount ?? undefined,
    currentSeason: raw.currentSeason ?? undefined,
    currentEpisode: raw.currentEpisode ?? undefined,
    genre: raw.genre ?? undefined,
    date: raw.date,
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
