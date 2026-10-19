import {
  computed,
  ref,
  type ComputedRef,
  type Ref,
  type WritableComputedRef,
} from "vue";
import { message } from "ant-design-vue";
import { WatchStatus, useUserMoviesStore, type UserMovie } from "@/stores";
import { useDateTime } from "@/composable/useDateTime";
import { useEscapeKey } from "@/composable/useEscapeKey";
import {
  MAX_SEASONS,
  MAX_EPISODES,
  isOptionalInteger,
} from "@/utils/media-numbers";

type DateChip = { key: string; icon: string; label: string; active: boolean };

export interface MovieProgress {
  currentUserMovie: Ref<UserMovie | null>;
  movie: ComputedRef<UserMovie["movie"] | undefined>;
  isEditingProgress: Ref<boolean>;
  editSeason: Ref<number | undefined>;
  editEpisode: Ref<number | undefined>;
  isProgressSaving: Ref<boolean>;
  seasonProgress: ComputedRef<number>;
  episodeProgress: ComputedRef<number>;
  isSerialCompleted: ComputedRef<boolean>;
  currentWatchStatusLabel: ComputedRef<string>;
  dateChips: ComputedRef<DateChip[]>;
  canDecreaseSeason: ComputedRef<boolean>;
  canIncreaseSeason: ComputedRef<boolean>;
  canDecreaseEpisode: ComputedRef<boolean>;
  canIncreaseEpisode: ComputedRef<boolean>;
  watchStatusModel: WritableComputedRef<WatchStatus>;
  startEditProgress: () => void;
  cancelEditProgress: () => void;
  saveProgress: () => Promise<void>;
  decreaseSeason: () => Promise<void>;
  increaseSeason: () => Promise<void>;
  decreaseEpisode: () => Promise<void>;
  increaseEpisode: () => Promise<void>;
}

const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  [WatchStatus.NOT_STARTED]: "Не начато",
  [WatchStatus.WATCHING]: "Смотрю",
  [WatchStatus.COMPLETED]: "Просмотрено",
  [WatchStatus.DROPPED]: "Брошено",
};

export function useMovieProgress(
  currentUserMovie: Ref<UserMovie | null>,
  userId: Ref<string>
): MovieProgress {
  const userMoviesStore = useUserMoviesStore();
  const { formatInstant, dateKey } = useDateTime();
  const movie = computed(() => currentUserMovie.value?.movie);
  const isEditingProgress = ref(false);
  const editSeason = ref<number | undefined>();
  const editEpisode = ref<number | undefined>();
  const isProgressSaving = ref(false);

  const formatChipDate = (raw: string): string => {
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const sameYear =
      dateKey(date)?.slice(0, 4) === dateKey(new Date())?.slice(0, 4);

    return formatInstant(date, {
      day: "numeric",
      month: "long",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  };

  const dateChips = computed<DateChip[]>(() => {
    const um = currentUserMovie.value;

    if (!um || um.watchStatus === WatchStatus.NOT_STARTED) {
      return [];
    }

    const chips: DateChip[] = [];

    if (um.startedAt) {
      chips.push({
        key: "started",
        icon: "ph:play-circle",
        label: `Начал ${formatChipDate(um.startedAt)}`,
        active: um.watchStatus === WatchStatus.WATCHING,
      });
    }

    if (um.watchStatus === WatchStatus.COMPLETED && um.completedAt) {
      chips.push({
        key: "completed",
        icon: "ph:flag-checkered",
        label: `Досмотрел ${formatChipDate(um.completedAt)}`,
        active: true,
      });
    }

    if (um.watchStatus === WatchStatus.DROPPED && um.droppedAt) {
      chips.push({
        key: "dropped",
        icon: "ph:x-circle",
        label: `Бросил ${formatChipDate(um.droppedAt)}`,
        active: true,
      });
    }

    return chips;
  });

  const seasonProgress = computed(() => {
    if (!movie.value?.seasonCount || !currentUserMovie.value?.currentSeason) {
      return 0;
    }

    return Math.round(
      (currentUserMovie.value.currentSeason / movie.value.seasonCount) * 100
    );
  });

  const episodeProgress = computed(() => {
    if (!movie.value?.episodeCount || !currentUserMovie.value?.currentEpisode) {
      return 0;
    }

    return Math.round(
      (currentUserMovie.value.currentEpisode / movie.value.episodeCount) * 100
    );
  });

  const isSerialCompleted = computed(() => {
    if (!currentUserMovie.value) {
      return false;
    }

    return currentUserMovie.value.watchStatus === WatchStatus.COMPLETED;
  });

  const currentWatchStatusLabel = computed(() => {
    const status =
      currentUserMovie.value?.watchStatus ?? WatchStatus.NOT_STARTED;

    return WATCH_STATUS_LABELS[status];
  });

  const startEditProgress = (): void => {
    editSeason.value = currentUserMovie.value?.currentSeason ?? undefined;
    editEpisode.value = currentUserMovie.value?.currentEpisode ?? undefined;
    isEditingProgress.value = true;
  };

  const cancelEditProgress = (): void => {
    isEditingProgress.value = false;
  };

  useEscapeKey(isEditingProgress, cancelEditProgress);

  const saveProgress = async (): Promise<void> => {
    if (!currentUserMovie.value) {
      return;
    }

    if (
      !isOptionalInteger(
        editSeason.value,
        0,
        Math.min(movie.value?.seasonCount ?? MAX_SEASONS, MAX_SEASONS)
      ) ||
      !isOptionalInteger(
        editEpisode.value,
        0,
        Math.min(movie.value?.episodeCount ?? MAX_EPISODES, MAX_EPISODES)
      )
    ) {
      message.error("Проверьте прогресс сезонов и серий");

      return;
    }

    isProgressSaving.value = true;

    try {
      const updated = await userMoviesStore.updateUserMovie(
        userId.value,
        currentUserMovie.value.movieId,
        {
          currentSeason: editSeason.value,
          currentEpisode: editEpisode.value,
        }
      );

      currentUserMovie.value = updated;

      isEditingProgress.value = false;
      message.success("Прогресс обновлён");
    } catch {
      message.error("Не удалось обновить прогресс");
    } finally {
      isProgressSaving.value = false;
    }
  };

  const changeWatchStatus = async (nextStatus: WatchStatus): Promise<void> => {
    if (!currentUserMovie.value) {
      return;
    }

    const payload: {
      watchStatus: WatchStatus;
      currentSeason?: number;
      currentEpisode?: number;
      lastWatchedAt?: string;
    } = {
      watchStatus: nextStatus,
    };

    if (nextStatus === WatchStatus.WATCHING) {
      const hasSeasonProgress = (currentUserMovie.value.currentSeason ?? 0) > 0;
      const hasEpisodeProgress =
        (currentUserMovie.value.currentEpisode ?? 0) > 0;

      if (!hasSeasonProgress && movie.value?.seasonCount) {
        payload.currentSeason = 1;
      }

      if (!hasEpisodeProgress && movie.value?.episodeCount) {
        payload.currentEpisode = 1;
      }
    }

    if (nextStatus === WatchStatus.COMPLETED) {
      if (movie.value?.seasonCount) {
        payload.currentSeason = movie.value.seasonCount;
      }

      if (movie.value?.episodeCount) {
        payload.currentEpisode = movie.value.episodeCount;
      }
    }

    if (nextStatus === WatchStatus.DROPPED) {
      payload.lastWatchedAt = new Date().toISOString();
    }

    if (currentUserMovie.value.watchStatus === nextStatus) {
      return;
    }

    isProgressSaving.value = true;

    try {
      const updated = await userMoviesStore.updateUserMovie(
        userId.value,
        currentUserMovie.value.movieId,
        payload
      );

      currentUserMovie.value = updated;
      message.success("Статус обновлён");
    } catch {
      message.error("Не удалось обновить статус просмотра");
    } finally {
      isProgressSaving.value = false;
    }
  };

  const watchStatusModel = computed<WatchStatus>({
    get: () => currentUserMovie.value?.watchStatus ?? WatchStatus.NOT_STARTED,
    set: (next) => void changeWatchStatus(next),
  });

  const canDecreaseSeason = computed(() => {
    return (currentUserMovie.value?.currentSeason ?? 0) > 0;
  });

  const canIncreaseSeason = computed(() => {
    if (!movie.value?.seasonCount) {
      return false;
    }

    return (
      (currentUserMovie.value?.currentSeason ?? 0) <
      Math.min(movie.value.seasonCount, MAX_SEASONS)
    );
  });

  const canDecreaseEpisode = computed(() => {
    return (currentUserMovie.value?.currentEpisode ?? 0) > 0;
  });

  const canIncreaseEpisode = computed(() => {
    if (!movie.value?.episodeCount) {
      return false;
    }

    return (
      (currentUserMovie.value?.currentEpisode ?? 0) <
      Math.min(movie.value.episodeCount, MAX_EPISODES)
    );
  });

  const updateSerialProgress = async (
    payload: { currentSeason?: number; currentEpisode?: number },
    successMessage: string,
    errorMessage: string
  ): Promise<void> => {
    if (!currentUserMovie.value) {
      return;
    }

    isProgressSaving.value = true;

    try {
      const updated = await userMoviesStore.updateUserMovie(
        userId.value,
        currentUserMovie.value.movieId,
        payload
      );

      currentUserMovie.value = updated;
      message.success(successMessage);
    } catch {
      message.error(errorMessage);
    } finally {
      isProgressSaving.value = false;
    }
  };

  const decreaseSeason = async (): Promise<void> => {
    if (!canDecreaseSeason.value) {
      return;
    }

    const nextSeason = Math.max(
      (currentUserMovie.value?.currentSeason ?? 0) - 1,
      0
    );

    await updateSerialProgress(
      { currentSeason: nextSeason },
      "Сезон обновлён",
      "Не удалось обновить сезон"
    );
  };

  const increaseSeason = async (): Promise<void> => {
    if (!canIncreaseSeason.value || !movie.value?.seasonCount) {
      return;
    }

    const nextSeason = Math.min(
      (currentUserMovie.value?.currentSeason ?? 0) + 1,
      movie.value.seasonCount
    );

    await updateSerialProgress(
      { currentSeason: nextSeason },
      "Сезон обновлён",
      "Не удалось обновить сезон"
    );
  };

  const decreaseEpisode = async (): Promise<void> => {
    if (!canDecreaseEpisode.value) {
      return;
    }

    const nextEpisode = Math.max(
      (currentUserMovie.value?.currentEpisode ?? 0) - 1,
      0
    );

    await updateSerialProgress(
      { currentEpisode: nextEpisode },
      "Эпизод обновлён",
      "Не удалось обновить эпизод"
    );
  };

  const increaseEpisode = async (): Promise<void> => {
    if (!canIncreaseEpisode.value || !movie.value?.episodeCount) {
      return;
    }

    const nextEpisode = Math.min(
      (currentUserMovie.value?.currentEpisode ?? 0) + 1,
      movie.value.episodeCount
    );

    await updateSerialProgress(
      { currentEpisode: nextEpisode },
      "Эпизод обновлён",
      "Не удалось обновить эпизод"
    );
  };

  return {
    currentUserMovie,
    movie,
    isEditingProgress,
    editSeason,
    editEpisode,
    isProgressSaving,
    seasonProgress,
    episodeProgress,
    isSerialCompleted,
    currentWatchStatusLabel,
    dateChips,
    canDecreaseSeason,
    canIncreaseSeason,
    canDecreaseEpisode,
    canIncreaseEpisode,
    watchStatusModel,
    startEditProgress,
    cancelEditProgress,
    saveProgress,
    decreaseSeason,
    increaseSeason,
    decreaseEpisode,
    increaseEpisode,
  };
}
