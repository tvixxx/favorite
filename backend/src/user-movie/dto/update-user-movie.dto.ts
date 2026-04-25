import { WatchStatus } from '../../generated/prisma/enums';

export class UpdateUserMovieDto {
  isFavorite?: boolean;
  seeLater?: boolean;
  personalRate?: number;
  watchStatus?: WatchStatus;
  currentSeason?: number;
  currentEpisode?: number;
  lastWatchedAt?: Date;
  completedAt?: Date;
}
