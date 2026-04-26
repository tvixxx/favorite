import { Genre } from "@/components/Genres/constants/genres.constants";
import type { Actor } from "@/stores";

export interface MoviePoster {
  url: string;
}

// Enum для статуса просмотра
export enum WatchStatus {
  NOT_STARTED = "NOT_STARTED",
  WATCHING = "WATCHING",
  COMPLETED = "COMPLETED",
  DROPPED = "DROPPED",
}

// API ответ для Movie (общие данные фильма)
export interface MovieApiResponse {
  id: string;
  title: string;
  description: string;
  genre: Genre | null;
  publishDate: string | null;
  isSerial: boolean;
  seasonCount?: number;
  episodeCount?: number;
  posterId: string | null;
  createdAt: string;
  updatedAt: string;
  poster: MoviePoster | null;
  actors?: Actor[];
  reviews?: Review[];
  _count?: {
    reviews: number;
    actors: number;
  };
}

// FE модель Movie (общие данные)
export interface Movie {
  id: string;
  title: string;
  description: string;
  genre?: Genre;
  publishDate: string | null;
  isSerial: boolean;
  seasonCount?: number;
  episodeCount?: number;
  imageUrl: string;
  createdAt: string;
  actorIds?: string[];
  actors?: Actor[];
  reviews?: Review[];
  _count?: {
    reviews: number;
    actors: number;
  };
}

// API ответ для UserMovie (персональные данные пользователя)
export interface UserMovieApiResponse {
  id: string;
  userId: string;
  movieId: string;
  isFavorite: boolean;
  seeLater: boolean;
  personalRate: number | null;
  watchStatus: WatchStatus;
  currentSeason: number | null;
  currentEpisode: number | null;
  addedAt: string;
  lastWatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  movie: MovieApiResponse;
}

// FE модель UserMovie (персональные данные)
export interface UserMovie {
  id: string;
  userId: string;
  movieId: string;
  isFavorite: boolean;
  seeLater: boolean;
  personalRate: number | null;
  watchStatus: WatchStatus;
  currentSeason: number | null;
  currentEpisode: number | null;
  addedAt: string;
  lastWatchedAt: string | null;
  completedAt: string | null;
  movie: Movie;
}

export interface Review {
  id: string;
  text: string;
  rate: number;
  userId: string;
  movieId: string;
}

export interface MoviesStats {
  allMovies: number;
  allFavorites: number;
  allSerials: number;
  allSeeLater: number;
}

export interface UserMoviesStats {
  totalMovies: number;
  totalFavorites: number;
  totalSeeLater: number;
  totalWatching: number;
  totalCompleted: number;
  totalSerials: number;
}

export interface MoviesFilters {
  genre?: Genre;
  publishDateFrom?: string;
  publishDateTo?: string;
}

export interface UserMoviesFilters {
  genre?: Genre;
  personalRateMin?: number;
  personalRateMax?: number;
  publishDateFrom?: string;
  publishDateTo?: string;
  isFavorite?: boolean;
  seeLater?: boolean;
  watchStatus?: WatchStatus;
}
