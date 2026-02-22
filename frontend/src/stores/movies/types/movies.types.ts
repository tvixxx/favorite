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
  actorIds?: string[];
  actors?: string[];
}
