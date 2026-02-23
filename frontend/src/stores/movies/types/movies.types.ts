export interface Movie {
  id: string;
  title: string;
  date: Date | null;
  publishDate: Date | null;
  imageUrl: string;
  description: string;
  rate: number;
  createdAt: Date;
  isFavorite: boolean;
  seeLater: boolean;
  isSerial: boolean;
  actorIds?: string[];
  actors?: string[];
}

export interface MoviesStats {
  allMovies: number;
  allFavorites: number;
  allSerials: number;
  allSeeLater: number;
}
