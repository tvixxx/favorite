import { ContentKind, Genre } from '../generated/prisma/enums';

export type TvdbType = 'movie' | 'series';
export interface TvdbCandidate {
  id: string;
  type: TvdbType;
  title: string;
  titleEn: string | null;
  originalTitle: string;
  aliases: string[];
  year: number | null;
  posterUrl: string | null;
}
export interface TvdbPreview extends TvdbCandidate {
  description: string;
  descriptionLanguage: 'ru' | 'en';
  countryCodes: string[];
  genres: Genre[];
  unmappedGenres: string[];
  contentKind: ContentKind;
  isSerial: boolean;
  actors: Array<{ id: string; name: string }>;
  seasonCount: number | null;
  episodeCount: number | null;
}
