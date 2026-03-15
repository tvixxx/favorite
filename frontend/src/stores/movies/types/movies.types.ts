import { Genre } from "@/components/Genres/constants/genres.constants";
import type { Actor } from "@/stores";

export interface MoviePoster {
  url: string;
}

// API ответ — что приходит с бекегда.
// Используется только в маппере, не для компонентов.
export interface MovieApiResponse {
  id: string;
  title: string;
  description: string;
  rate: number;
  isFavorite: boolean;
  seeLater: boolean;
  isSerial: boolean;
  seasonCount?: number;
  episodeCount?: number;
  currentSeason?: number;
  currentEpisode?: number;
  genre: Genre | null;
  date: string | null;
  publishDate: string | null;
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

// FE модель данных
export interface Movie {
  id: string;
  title: string;
  description: string;
  rate: number;
  isFavorite: boolean;
  seeLater: boolean;
  isSerial: boolean;
  seasonCount?: number;
  episodeCount?: number;
  currentSeason?: number;
  currentEpisode?: number;
  genre?: Genre;
  date: string | null;
  publishDate: string | null;
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

export interface Review {
  id: string;
  text: string;
  rate: number;
  movieId: string;
}

export interface MoviesStats {
  allMovies: number;
  allFavorites: number;
  allSerials: number;
  allSeeLater: number;
}

export interface MoviesFilters {
  genre?: Genre;
  rateMin?: number;
  rateMax?: number;
  dateFrom?: string;
  dateTo?: string;
  publishDateFrom?: string;
  publishDateTo?: string;
  seeLater?: boolean;
}
