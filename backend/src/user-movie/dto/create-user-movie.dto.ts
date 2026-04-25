import { WatchStatus } from '../../generated/prisma/enums';

export class CreateUserMovieDto {
  userId: string;
  movieId: string;
  isFavorite?: boolean;
  seeLater?: boolean;
  personalRate?: number;
  watchStatus?: WatchStatus;
  currentSeason?: number;
  currentEpisode?: number;
}
