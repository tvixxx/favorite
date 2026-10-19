import type { DiaryValuesInput } from './diary-values';

export interface CreateDiaryInput extends DiaryValuesInput {
  movieId: string;
  requestId: string;
  allowDuplicate?: boolean;
  syncStatus?: boolean;
  syncRating?: boolean;
}
export interface UpdateDiaryInput extends DiaryValuesInput {
  revision: number;
  allowDuplicate?: boolean;
}
export interface DiaryQuery {
  limit: number;
  offset: number;
  q?: string;
  from?: string;
  to?: string;
  movieId?: string;
  isRewatch?: boolean;
  sort?: 'newest' | 'oldest';
}
export interface DiaryEntryResponse {
  id: string;
  viewedOn: string;
  scope: 'TITLE' | 'SEASON';
  season: number | null;
  isRewatch: boolean;
  rating: number | null;
  note: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  inCollection: boolean;
  movie: {
    id: string;
    title: string;
    titleEn: string | null;
    isSerial: boolean;
    seasonCount: number | null;
    contentKind: string | null;
    publishDate: string | null;
    imageUrl: string | null;
  };
}
export interface DiaryPage {
  items: DiaryEntryResponse[];
  total: number;
  stats: { entries: number; titles: number; rewatches: number };
  today: string;
}
export interface DiarySaveResult {
  status: 'saved' | 'duplicate';
  entry: DiaryEntryResponse;
  collectionUpdated: boolean;
}
