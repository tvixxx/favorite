<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { message } from "ant-design-vue";

import { useMainStore } from "@/state/state";
import { useUserListsStore, useUserMoviesStore } from "@/stores";
import { formatDate, formatYear } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";
import { FETCH_METHOD, useFetch } from "@/composable";

import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { WatchStatus, type UserMovie } from "@/stores";
import ReviewsWidget from "@/components/Reviews/ReviewsWidget.vue";
import type { UserListDetail, UserListSummary } from "@/stores/userLists/types";

const mainStore = useMainStore();
const userMoviesStore = useUserMoviesStore();
const userListsStore = useUserListsStore();
const router = useRouter();
const route = useRoute();

const detailBackFallback = computed((): RouteLocationRaw => {
  const raw = route.query.libActor;
  const actorId =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0]
        : "";
  if (actorId) {
    return { path: `/library/actors/${actorId}` };
  }

  return { path: "/library/collection" };
});

const currentMovieId = router.currentRoute.value.params.id as string | null;
const userId = computed(() => mainStore.userData?.id || "");

const isLoading = ref(false);
const isError = ref<string | null>(null);
const currentUserMovie = ref<UserMovie | null>(null);
const isListsModalVisible = ref(false);
const newListName = ref("");
const newListLabelsInput = ref("");
const isListActionLoading = ref(false);
const listIdsWithCurrentMovie = ref<Set<string>>(new Set());

onMounted(async () => {
  if (mainStore.isLoggedIn && userId.value && currentMovieId) {
    isLoading.value = true;
    isError.value = null;

    try {
      const userMovie = userMoviesStore.userMovies.find(
        (um) => um.movieId === currentMovieId
      );

      if (userMovie) {
        currentUserMovie.value = userMovie;
      } else {
        const loaded = await userMoviesStore.fetchUserMovieById(
          userId.value,
          currentMovieId
        );

        if (loaded) {
          currentUserMovie.value = loaded;
        } else {
          isError.value = "Фильм не найден в вашей коллекции";
        }
      }
    } catch {
      message.error("Не удалось загрузить фильм");
      isError.value = "Не удалось загрузить фильм";
    } finally {
      isLoading.value = false;
    }
  }
});

onBeforeUnmount(() => {
  currentUserMovie.value = null;
});

const isEditingProgress = ref<boolean>(false);
const editSeason = ref<number | undefined>(undefined);
const editEpisode = ref<number | undefined>(undefined);
const isProgressSaving = ref(false);

const WATCH_STATUS_OPTIONS: Array<{ value: WatchStatus; label: string }> = [
  { value: WatchStatus.NOT_STARTED, label: "Не начато" },
  { value: WatchStatus.WATCHING, label: "Смотрю" },
  { value: WatchStatus.COMPLETED, label: "Завершено" },
  { value: WatchStatus.DROPPED, label: "Брошено" },
];

const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  [WatchStatus.NOT_STARTED]: "Не начато",
  [WatchStatus.WATCHING]: "Смотрю",
  [WatchStatus.COMPLETED]: "Завершено",
  [WatchStatus.DROPPED]: "Брошено",
};

type ProgressPreset = {
  id: "start" | "complete" | "drop";
  label: string;
  status: WatchStatus;
};

const PROGRESS_PRESETS: ProgressPreset[] = [
  { id: "start", label: "Начал смотреть", status: WatchStatus.WATCHING },
  { id: "complete", label: "Досмотрел", status: WatchStatus.COMPLETED },
  { id: "drop", label: "Бросил", status: WatchStatus.DROPPED },
];

const movie = computed(() => currentUserMovie.value?.movie);
const posterSrc = computed(() => movie.value?.imageUrl || FALLBACK_IMAGE_URL);

const ratePercent = computed(() => ((currentUserMovie.value?.personalRate ?? 0) / 10) * 100);

const hasActors = computed(
  () => movie.value?.actors && movie.value.actors.length > 0
);

const availableUserLists = computed<UserListSummary[]>(() => {
  return userListsStore.sortedLists;
});

const isMovieAlreadyInList = (listId: string): boolean => {
  return listIdsWithCurrentMovie.value.has(listId);
};

const toggleFavorite = async () => {
  if (!currentUserMovie.value) {
    return;
  }

  try {
    const newValue = !currentUserMovie.value.isFavorite;
    await userMoviesStore.updateUserMovie(userId.value, currentUserMovie.value.movieId, {
      isFavorite: newValue,
    });
    currentUserMovie.value = { ...currentUserMovie.value, isFavorite: newValue };
    message.success(
      newValue
        ? `"${movie.value?.title}" добавлен в избранное`
        : `"${movie.value?.title}" убран из избранного`
    );
  } catch {
    message.error("Не удалось обновить избранное");
  }
};

const toggleSeeLater = async () => {
  if (!currentUserMovie.value) {
    return;
  }

  const newValue = !currentUserMovie.value.seeLater;

  try {
    await userMoviesStore.updateUserMovie(userId.value, currentUserMovie.value.movieId, {
      seeLater: newValue,
    });
    currentUserMovie.value = { ...currentUserMovie.value, seeLater: newValue };

    message.success(
      newValue
        ? `${movie.value?.title} добавлен в «Смотреть позже»`
        : `${movie.value?.title} убран из «Смотреть позже»`
    );
  } catch {
    message.error("Не удалось обновить статус");
  }
};

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

const hasSerialProgress = computed(() => {
  return (
    movie.value?.isSerial &&
    (movie.value.seasonCount || movie.value.episodeCount)
  );
});

const isSerialCompleted = computed(() => {
  if (!currentUserMovie.value) {
    return false;
  }

  return currentUserMovie.value.watchStatus === WatchStatus.COMPLETED;
});

const currentWatchStatusLabel = computed(() => {
  const status = currentUserMovie.value?.watchStatus ?? WatchStatus.NOT_STARTED;

  return WATCH_STATUS_LABELS[status];
});

const activeProgressPresetId = computed<ProgressPreset["id"] | null>(() => {
  if (!currentUserMovie.value) {
    return null;
  }

  switch (currentUserMovie.value.watchStatus) {
    case WatchStatus.WATCHING:
      return "start";
    case WatchStatus.COMPLETED:
      return "complete";
    case WatchStatus.DROPPED:
      return "drop";
    default:
      return null;
  }
});

const startEditProgress = () => {
  editSeason.value = currentUserMovie.value?.currentSeason ?? undefined;
  editEpisode.value = currentUserMovie.value?.currentEpisode ?? undefined;
  isEditingProgress.value = true;
};

const cancelEditProgress = () => {
  isEditingProgress.value = false;
};

const saveProgress = async () => {
  if (!currentUserMovie.value) {
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
      },
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

const updateWatchStatus = async (nextStatus: WatchStatus) => {
  if (!currentUserMovie.value) {
    return;
  }

  isProgressSaving.value = true;

  try {
    const updated = await userMoviesStore.updateUserMovie(
      userId.value,
      currentUserMovie.value.movieId,
      {
        watchStatus: nextStatus,
      },
    );

    currentUserMovie.value = updated;
    message.success("Статус обновлён");
  } catch {
    message.error("Не удалось обновить статус просмотра");
  } finally {
    isProgressSaving.value = false;
  }
};

const onWatchStatusChange = (nextStatus: WatchStatus) => {
  void updateWatchStatus(nextStatus);
};

const applyProgressPreset = async (preset: ProgressPreset) => {
  if (!currentUserMovie.value) {
    return;
  }

  const payload: {
    watchStatus: WatchStatus;
    currentSeason?: number;
    currentEpisode?: number;
    lastWatchedAt?: string;
  } = {
    watchStatus: preset.status,
  };

  if (preset.status === WatchStatus.WATCHING) {
    const hasSeasonProgress = (currentUserMovie.value.currentSeason ?? 0) > 0;
    const hasEpisodeProgress = (currentUserMovie.value.currentEpisode ?? 0) > 0;

    if (!hasSeasonProgress && movie.value?.seasonCount) {
      payload.currentSeason = 1;
    }

    if (!hasEpisodeProgress && movie.value?.episodeCount) {
      payload.currentEpisode = 1;
    }
  }

  if (preset.status === WatchStatus.COMPLETED) {
    if (movie.value?.seasonCount) {
      payload.currentSeason = movie.value.seasonCount;
    }

    if (movie.value?.episodeCount) {
      payload.currentEpisode = movie.value.episodeCount;
    }
  }

  if (preset.status === WatchStatus.DROPPED) {
    payload.lastWatchedAt = new Date().toISOString();
  }

  const hasChanges =
    currentUserMovie.value.watchStatus !== payload.watchStatus ||
    payload.currentSeason !== undefined ||
    payload.currentEpisode !== undefined ||
    payload.lastWatchedAt !== undefined;

  if (!hasChanges) {
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
    message.error("Не удалось применить пресет статуса");
  } finally {
    isProgressSaving.value = false;
  }
};

const canDecreaseSeason = computed(() => {
  return (currentUserMovie.value?.currentSeason ?? 0) > 0;
});

const canIncreaseSeason = computed(() => {
  if (!movie.value?.seasonCount) {
    return false;
  }

  return (currentUserMovie.value?.currentSeason ?? 0) < movie.value.seasonCount;
});

const canDecreaseEpisode = computed(() => {
  return (currentUserMovie.value?.currentEpisode ?? 0) > 0;
});

const canIncreaseEpisode = computed(() => {
  if (!movie.value?.episodeCount) {
    return false;
  }

  return (currentUserMovie.value?.currentEpisode ?? 0) < movie.value.episodeCount;
});

const updateSerialProgress = async (
  payload: { currentSeason?: number; currentEpisode?: number },
  successMessage: string,
  errorMessage: string
) => {
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

const decreaseSeason = async () => {
  if (!canDecreaseSeason.value) {
    return;
  }

  const nextSeason = Math.max((currentUserMovie.value?.currentSeason ?? 0) - 1, 0);

  await updateSerialProgress(
    { currentSeason: nextSeason },
    "Сезон обновлён",
    "Не удалось обновить сезон"
  );
};

const increaseSeason = async () => {
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

const decreaseEpisode = async () => {
  if (!canDecreaseEpisode.value) {
    return;
  }

  const nextEpisode = Math.max((currentUserMovie.value?.currentEpisode ?? 0) - 1, 0);

  await updateSerialProgress(
    { currentEpisode: nextEpisode },
    "Эпизод обновлён",
    "Не удалось обновить эпизод"
  );
};

const increaseEpisode = async () => {
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

const parseListLabels = (raw: string): string[] => {
  const unique = new Set<string>();

  for (const chunk of raw.split(",")) {
    const normalized = chunk.trim();

    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};

const formatTitlesCount = (count: number): string => {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} тайтл`;
  }

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} тайтла`;
  }

  return `${count} тайтлов`;
};

const openListsModal = async () => {
  if (!userId.value) {
    return;
  }

  isListsModalVisible.value = true;

  try {
    await userListsStore.fetchLists(userId.value);
    await refreshMoviePresenceInLists();
  } catch {
    message.error(userListsStore.isError || "Не удалось загрузить списки");
  }
};

const refreshMoviePresenceInLists = async () => {
  if (!userId.value || !currentUserMovie.value) {
    listIdsWithCurrentMovie.value = new Set();

    return;
  }

  const nextPresence = new Set<string>();

  await Promise.all(
    availableUserLists.value.map(async (list) => {
      try {
        const response = await useFetch<UserListDetail>(
          `/users/${userId.value}/lists/${list.id}`,
          {
            method: FETCH_METHOD.get,
          }
        );

        if (response.status !== 200) {
          return;
        }

        const containsMovie = response.data.items.some(
          (item) => item.movieId === currentUserMovie.value?.movieId
        );

        if (containsMovie) {
          nextPresence.add(list.id);
        }
      } catch {
        /* ignore one broken list fetch and continue others */
      }
    })
  );

  listIdsWithCurrentMovie.value = nextPresence;
};

const createListFromModal = async () => {
  if (!userId.value || !newListName.value.trim()) {
    message.warning("Введите название списка");

    return;
  }

  isListActionLoading.value = true;

  try {
    const created = await userListsStore.createList(userId.value, {
      name: newListName.value.trim(),
      labels: parseListLabels(newListLabelsInput.value),
    });

    newListName.value = "";
    newListLabelsInput.value = "";
    await refreshMoviePresenceInLists();
    message.success(`Список «${created.name}» создан`);
  } catch (error: unknown) {
    const text = getApiResponseMessage(error);
    message.error(text || "Не удалось создать список");
  } finally {
    isListActionLoading.value = false;
  }
};

const addMovieToList = async (listId: string) => {
  if (!userId.value || !currentUserMovie.value) {
    return;
  }

  isListActionLoading.value = true;

  try {
    await userListsStore.addMovieToList(
      userId.value,
      listId,
      currentUserMovie.value.movieId
    );
    listIdsWithCurrentMovie.value = new Set([
      ...listIdsWithCurrentMovie.value,
      listId,
    ]);
    await userListsStore.fetchLists(userId.value);
    message.success("Тайтл добавлен в список");
  } catch (error: unknown) {
    if (isApiConflictError(error)) {
      listIdsWithCurrentMovie.value = new Set([
        ...listIdsWithCurrentMovie.value,
        listId,
      ]);
      message.warning("Тайтл уже есть в этом списке");

      return;
    }

    const text = getApiResponseMessage(error);
    message.error(text || "Не удалось добавить фильм в список");
  } finally {
    isListActionLoading.value = false;
  }
};
</script>

<template>
  <div class="movie-detail">
    <HeroHeader
      :title="movie?.title ?? 'Детали фильма'"
      subtitle="Подробная информация о фильме"
      badge-text="Фильм"
      icon-name="mdi:filmstrip"
    />

    <div class="movie-detail__content">
      <AppBackButton :fallback="detailBackFallback" />

      <ListError
        v-if="isError"
        :is-error="isError"
        :repeat-fn="() => router.go(0)"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="isLoading"
        :center="true"
        loading-text="Загружаем фильм..."
        size="large"
      />

      <template v-else-if="currentUserMovie && movie">
        <div class="detail-card">
          <div class="detail-card__poster">
            <img
              :src="posterSrc"
              :alt="`${movie.title} постер`"
              class="detail-card__poster-img"
            />
          </div>

          <div class="detail-card__info">
            <div class="detail-card__header">
              <h1 class="detail-card__title">{{ movie.title }}</h1>
              <button
                class="detail-card__favorite"
                :class="{ 'detail-card__favorite_active': currentUserMovie.isFavorite }"
                @click="toggleFavorite"
              >
                <BaseIcon
                  :name="currentUserMovie.isFavorite ? 'mdi:heart' : 'mdi:heart-outline'"
                  :width="24"
                  :height="24"
                />
              </button>
            </div>

            <div class="detail-card__tags">
              <span
                v-for="g in movie.genres ?? []"
                :key="g"
                class="detail-card__tag"
              >
                {{ GenreLabels[g] ?? g }}
              </span>
              <span v-if="movie.publishDate" class="detail-card__tag">
                {{ formatYear(movie.publishDate) }}
              </span>
              <span v-if="!movie.isSerial" class="detail-card__tag">
                Фильм
              </span>
              <span
                v-if="movie.isSerial"
                class="detail-card__tag detail-card__tag_accent"
              >
                Сериал
              </span>
              <span
                v-if="currentUserMovie.seeLater"
                class="detail-card__tag detail-card__tag_warning"
              >
                <BaseIcon name="mdi:clock-outline" :width="14" :height="14" />
                Смотреть позже
              </span>
            </div>

            <div class="detail-card__rating">
              <div class="detail-card__rating-score">
                <span class="detail-card__rating-value">
                  {{ currentUserMovie.personalRate || 0 }}
                </span>
                <span class="detail-card__rating-max">/10</span>
              </div>
              <div class="detail-card__rating-bar">
                <div
                  class="detail-card__rating-fill"
                  :style="{ width: `${ratePercent}%` }"
                />
              </div>
            </div>

            <div class="detail-card__meta">
              <div v-if="currentUserMovie.addedAt" class="detail-card__meta-item">
                <BaseIcon name="mdi:eye" :width="18" :height="18" />
                <span class="detail-card__meta-label">Дата добавления</span>
                <span class="detail-card__meta-value">
                  {{ formatDate(currentUserMovie.addedAt) }}
                </span>
              </div>

              <div v-if="movie.publishDate" class="detail-card__meta-item">
                <BaseIcon name="mdi:calendar" :width="18" :height="18" />
                <span class="detail-card__meta-label">Дата выхода</span>
                <span class="detail-card__meta-value">
                  {{ formatYear(movie.publishDate) }}
                </span>
              </div>

              <div
                v-if="movie.countryCodes?.length"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:earth" :width="18" :height="18" />
                <span class="detail-card__meta-label">Страны производства</span>
                <span class="detail-card__meta-value">
                  {{ countriesLabelsRu(movie.countryCodes) }}
                </span>
              </div>

              <div
                v-if="movie.isSerial && movie.seasonCount"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:television" :width="18" :height="18" />
                <span class="detail-card__meta-label">Сезонов</span>
                <span class="detail-card__meta-value">
                  {{ movie.seasonCount }}
                </span>
              </div>

              <div
                v-if="movie.isSerial && movie.episodeCount"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:playlist-play" :width="18" :height="18" />
                <span class="detail-card__meta-label">Эпизодов</span>
                <span class="detail-card__meta-value">
                  {{ movie.episodeCount }}
                </span>
              </div>

              <div
                class="detail-card__meta-item detail-card__meta-item_interactive"
                @click.stop
              >
                <BaseIcon name="mdi:clock-outline" :width="18" :height="18" />
                <span class="detail-card__meta-label">Смотреть позже</span>
                <a-switch
                  :checked="currentUserMovie.seeLater"
                  size="small"
                  class="detail-card__meta-switch"
                  @change="toggleSeeLater"
                />
              </div>

              <div
                v-if="currentMovieId && movie"
                class="detail-card__meta-item detail-card__meta-item_interactive detail-card__meta-item_share"
                @click.stop
              >
                <MovieShareButton
                  :movie-id="currentMovieId"
                  :movie-title="movie.title"
                />
              </div>

              <div
                v-if="currentMovieId && movie"
                class="detail-card__meta-item detail-card__meta-item_interactive"
                @click.stop
              >
                <a-button
                  type="default"
                  size="small"
                  class="detail-card__meta-list-btn"
                  @click="openListsModal"
                >
                  <BaseIcon name="mdi:playlist-plus" :width="16" :height="16" />
                  В список
                </a-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="movie.description" class="detail-section">
          <h2 class="detail-section__title">
            <BaseIcon name="mdi:text" :width="22" :height="22" />
            Описание
          </h2>
          <p class="detail-section__text">{{ movie.description }}</p>
        </div>

        <div v-if="hasActors" class="detail-section">
          <h2 class="detail-section__title">
            <BaseIcon name="mdi:account-group" :width="22" :height="22" />
            Актёры
          </h2>
          <div class="actors-list">
            <div
              v-for="actor in movie.actors"
              :key="actor.id"
              class="actors-list__item"
            >
              <div class="actors-list__avatar">
                <BaseIcon name="mdi:account" :width="20" :height="20" />
              </div>
              <span class="actors-list__name">{{ actor.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasSerialProgress" class="detail-section">
          <div class="detail-section__header">
            <h2 class="detail-section__title">
              <BaseIcon name="mdi:progress-clock" :width="22" :height="22" />
              Прогресс просмотра
            </h2>
            <a-button
              v-if="!isEditingProgress"
              type="text"
              size="small"
              class="detail-section__edit-btn"
              @click="startEditProgress"
            >
              <BaseIcon name="mdi:pencil" :width="16" :height="16" />
              <span>Изменить</span>
            </a-button>
          </div>

          <div v-if="isSerialCompleted" class="serial-progress__completed">
            <BaseIcon name="mdi:check-circle" :width="20" :height="20" />
            <span>Сериал просмотрен полностью!</span>
          </div>

          <div class="serial-progress__status-row">
            <div class="serial-progress__status-info">
              <span class="serial-progress__status-label">Статус</span>
              <span class="serial-progress__status-value">
                {{ currentWatchStatusLabel }}
              </span>
            </div>
            <a-segmented
              :value="currentUserMovie.watchStatus"
              :options="WATCH_STATUS_OPTIONS"
              size="middle"
              class="serial-progress__status-select"
              :disabled="isProgressSaving"
              @change="onWatchStatusChange"
            />
          </div>

          <div class="serial-progress__presets">
            <a-button
              v-for="preset in PROGRESS_PRESETS"
              :key="preset.id"
              size="small"
              class="serial-progress__preset-btn"
              :class="{
                'serial-progress__preset-btn_active':
                  activeProgressPresetId === preset.id,
              }"
              :disabled="isProgressSaving"
              @click="applyProgressPreset(preset)"
            >
              {{ preset.label }}
            </a-button>
          </div>

          <div v-if="!isEditingProgress" class="serial-progress">
            <div v-if="movie.seasonCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Сезоны</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentSeason ?? 0 }} / {{ movie.seasonCount }}
                </span>
              </div>
              <a-progress
                :percent="seasonProgress"
                :show-info="false"
                :class="{
                  'serial-progress__bar_complete': seasonProgress === 100,
                }"
                size="small"
              />
            </div>

            <div v-if="movie.episodeCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Эпизоды</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentEpisode ?? 0 }} / {{ movie.episodeCount }}
                </span>
              </div>
              <a-progress
                :percent="episodeProgress"
                :show-info="false"
                :class="{
                  'serial-progress__bar_complete': episodeProgress === 100,
                }"
                size="small"
              />
            </div>

            <div class="serial-progress__quick-actions">
              <div v-if="movie.seasonCount" class="serial-progress__quick-group">
                <span class="serial-progress__quick-label">Сезон</span>
                <div class="serial-progress__quick-controls">
                  <a-button
                    size="small"
                    :disabled="isProgressSaving || !canDecreaseSeason"
                    @click="decreaseSeason"
                  >
                    -1
                  </a-button>
                  <a-button
                    size="small"
                    :disabled="isProgressSaving || !canIncreaseSeason"
                    @click="increaseSeason"
                  >
                    +1
                  </a-button>
                </div>
              </div>
              <div v-if="movie.episodeCount" class="serial-progress__quick-group">
                <span class="serial-progress__quick-label">Эпизод</span>
                <div class="serial-progress__quick-controls">
                  <a-button
                    size="small"
                    :disabled="isProgressSaving || !canDecreaseEpisode"
                    @click="decreaseEpisode"
                  >
                    -1
                  </a-button>
                  <a-button
                    size="small"
                    :disabled="isProgressSaving || !canIncreaseEpisode"
                    @click="increaseEpisode"
                  >
                    +1
                  </a-button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="serial-progress serial-progress_editing">
            <div v-if="movie.seasonCount" class="serial-progress__edit-item">
              <label class="serial-progress__edit-label">
                На каком сезоне
              </label>
              <a-input-number
                v-model:value="editSeason"
                :min="0"
                :max="movie.seasonCount"
                :precision="0"
                size="large"
                style="width: 100%"
              />
            </div>

            <div v-if="movie.episodeCount" class="serial-progress__edit-item">
              <label class="serial-progress__edit-label">
                На какой серии
              </label>
              <a-input-number
                v-model:value="editEpisode"
                :min="0"
                :max="movie.episodeCount"
                :precision="0"
                size="large"
                style="width: 100%"
              />
            </div>

            <div class="serial-progress__edit-actions">
              <a-button @click="cancelEditProgress"> Отмена </a-button>
              <a-button
                type="primary"
                :loading="isProgressSaving"
                @click="saveProgress"
              >
                <BaseIcon name="mdi:check" :width="16" :height="16" />
                Сохранить
              </a-button>
            </div>
          </div>
        </div>

        <div
          v-if="currentMovieId"
          class="movie-detail__review-widget review-widget"
        >
          <ReviewsWidget :movie-id="currentMovieId" />
        </div>
      </template>
    </div>
  </div>

  <BaseModal v-model="isListsModalVisible" layout="detail">
    <template #title>Добавить в пользовательский список</template>

    <template #body>
      <div class="lists-modal">
        <div class="lists-modal__create">
          <a-input
            v-model:value="newListName"
            placeholder="Название списка"
            :maxlength="80"
            size="large"
          />
          <a-input
            v-model:value="newListLabelsInput"
            placeholder="Метки через запятую (например: уютно, с друзьями)"
            :maxlength="140"
            size="large"
          />
          <a-button
            type="primary"
            :loading="isListActionLoading"
            @click="createListFromModal"
          >
            Создать список
          </a-button>
        </div>

        <ListLoading
          v-if="userListsStore.isLoading"
          :center="true"
          loading-text="Загружаем списки..."
          size="large"
        />

        <div v-else-if="availableUserLists.length" class="lists-modal__list">
          <div
            v-for="list in availableUserLists"
            :key="list.id"
            class="lists-modal__list-item"
          >
            <div class="lists-modal__list-main">
              <div class="lists-modal__list-title">{{ list.name }}</div>
              <div class="lists-modal__list-meta">
                {{ formatTitlesCount(list._count.items) }}
              </div>
              <div v-if="list.labels.length" class="lists-modal__labels">
                <span
                  v-for="label in list.labels"
                  :key="`${list.id}-${label}`"
                  class="lists-modal__label"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <a-button
              v-if="!isMovieAlreadyInList(list.id)"
              size="small"
              :loading="isListActionLoading"
              @click="addMovieToList(list.id)"
            >
              Добавить
            </a-button>
          </div>
        </div>

        <div v-else class="lists-modal__empty">
          Пока нет списков. Создайте первый выше.
        </div>
      </div>
    </template>

    <template #footer>
      <a-button @click="isListsModalVisible = false">Закрыть</a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;

.movie-detail {
  @include pageShell(4rem);

  &__content {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 1rem;
  }

}

.detail-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);

  @include mediaTablet {
    flex-direction: row;
  }

  &__poster {
    flex-shrink: 0;
    width: 100%;
    height: 360px;
    background: var(--bg-secondary);
    overflow: hidden;

    @include mediaTablet {
      width: 300px;
      height: auto;
      min-height: 450px;
    }

    @include mediaDesktopXS {
      width: 340px;
    }
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  &__info {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    @include mediaTablet {
      padding: 2rem;
      gap: 1.5rem;
    }
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  &__title {
    font-size: clamp(1.5rem, 4vw, 2.25rem);
    font-weight: 800;
    margin: 0;
    line-height: 1.2;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__favorite {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s ease;

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
      transform: scale(1.1);
    }

    &_active {
      border-color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
      color: var(--ant-color-primary);
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__tag {
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);

    &_accent {
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
      color: var(--ant-color-primary);
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 30%,
        transparent
      );
    }
  }

  &__rating {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__rating-score {
    display: flex;
    align-items: baseline;
    gap: 2px;
    flex-shrink: 0;
  }

  &__rating-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--ant-color-primary);
    line-height: 1;
  }

  &__rating-max {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__rating-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  &__rating-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--ant-color-primary),
      color-mix(in srgb, var(--ant-color-primary) 60%, var(--bg-secondary))
    );
    border-radius: 4px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 1rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--text-secondary);

    svg {
      flex-shrink: 0;
      color: var(--ant-color-primary);
    }

    &_interactive {
      padding: 6px 0;
      border-radius: 8px;
      transition: background 0.2s ease;
    }
  }

  &__meta-switch {
    margin-left: auto;
  }

  &__meta-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__meta-value {
    font-weight: 600;
    color: var(--text-primary);
    margin-left: auto;
  }

  &__meta-list-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__tag_warning {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: color-mix(
      in srgb,
      var(--color-warning, #faad14) 10%,
      var(--bg-primary)
    );
    color: var(--color-warning, #faad14);
    border-color: color-mix(
      in srgb,
      var(--color-warning, #faad14) 30%,
      transparent
    );
  }
}

.lists-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__create {
    display: grid;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid color-mix(in srgb, var(--border-color) 65%, transparent);
  }

  &__list {
    display: grid;
    gap: 0.75rem;
  }

  &__list-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 75%, transparent);
  }

  &__list-main {
    display: grid;
    gap: 0.25rem;
  }

  &__list-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__list-meta {
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  &__labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--ant-color-primary) 35%, transparent);
    background: color-mix(in srgb, var(--ant-color-primary) 10%, var(--bg-primary));
    color: var(--ant-color-primary);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.15rem 0.55rem;
    line-height: 1.3;
  }

  &__empty {
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px dashed var(--border-color);
    color: var(--text-secondary);
  }
}

.detail-section {
  margin-top: 1.5rem;
  background: var(--bg-primary);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;

    .detail-section__title {
      margin-bottom: 0;
    }
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1rem 0;

    svg {
      color: var(--ant-color-primary);
    }
  }

  &__text {
    font-size: 1.05rem;
    line-height: 1.8;
    color: var(--text-secondary);
    margin: 0;
    white-space: pre-line;
  }

  &__edit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
}

.detail-section + .movie-detail__review-widget {
  margin-top: 1.5rem;
}

.actors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 50px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--ant-color-primary);
      box-shadow: 0 2px 8px
        color-mix(in srgb, var(--ant-color-primary) 15%, transparent);
    }
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 15%,
      var(--bg-primary)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ant-color-primary);
  }

  &__name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }
}

.serial-progress {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__completed {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-success) 10%, var(--bg-primary));
    border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
    color: var(--color-success);
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0.85rem;
    border-radius: 14px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 75%, transparent);
  }

  &__status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem;
    border-radius: 14px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 80%, transparent);
    margin-bottom: 0.75rem;
  }

  &__status-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding-left: 0.15rem;
  }

  &__status-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__status-value {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__status-select {
    min-width: 280px;
    max-width: 100%;

    :deep(.ant-segmented) {
      background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 4px;
    }

    :deep(.ant-segmented-item) {
      border-radius: 8px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    :deep(.ant-segmented-item-selected) {
      color: var(--text-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 14%,
        var(--bg-primary)
      );
      box-shadow: none;
    }
  }

  &__presets {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
    margin-bottom: 0.85rem;
    padding-left: 0.1rem;
  }

  &__preset-btn {
    border-radius: 999px;
    border-color: var(--border-color);
    color: var(--text-secondary);

    &_active {
      color: var(--ant-color-primary);
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 40%,
        transparent
      );
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
    }
  }

  &__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__label-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 10%,
      var(--bg-primary)
    );
    padding: 2px 10px;
    border-radius: 12px;
  }

  &__bar_complete {
    :deep(.ant-progress-bg) {
      background-color: var(--color-success) !important;
    }
  }

  &__quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  &__quick-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  &__quick-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__quick-controls {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  &_editing {
    gap: 1rem;
  }

  &__edit-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__edit-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);

    :deep(.ant-btn-primary) {
      display: flex;
      align-items: center;
    }
  }

  @include mediaTablet {
    &__status-row {
      gap: 1.25rem;
    }
  }

  @media (max-width: 640px) {
    &__status-row {
      flex-direction: column;
      align-items: stretch;
    }

    &__status-select {
      min-width: 100%;
    }
  }
}
</style>
