export interface Movie {
  id: number;
  title: string;
  date: Date | null;
  publishDate: Date | null;
  poster: string;
  description: string;
  rate: number;
  createdAt: Date;
  isFavorite: boolean; // Changed from 'favorite' to match backend schema
  favoriteId?: number | null; // Made optional since backend might not use this exact field
}
