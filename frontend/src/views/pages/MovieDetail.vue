<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useRoute, useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { message } from "ant-design-vue";

import { useMainStore } from "@/state/state";
import { useUserListsStore, useUserMoviesStore } from "@/stores";
import { formatDate, formatYear, PLURAL, pluralize } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { DEFAULT_LIST_COLOR, LIST_COLOR_SWATCHES } from "@/constants/listColors";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";
import { MOVIES_ENDPOINTS } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { useEscapeKey } from "@/composable";
import { FETCH_METHOD, useFetch } from "@/composable";

import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import DetailSkeleton from "@/components/Skeleton/DetailSkeleton.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import { WatchStatus, type UserMovie } from "@/stores";
import ReviewsWidget from "@/components/Reviews/ReviewsWidget.vue";
import { useReviews } from "@/composable/useReviews";
import WatchStatusSelect from "@/components/WatchStatusSelect/WatchStatusSelect.vue";
import RateMovieModal from "@/components/RateMovieModal/RateMovieModal.vue";
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

// Хлебные крошки (эталон): родительский раздел — откуда пришли
const crumbParentLabel = computed(() =>
  route.query.libActor ? "Актёры" : "Моя коллекция",
);

const goToCrumbParent = (): void => {
  router.push(detailBackFallback.value);
};

const goToActor = (actorId: string): void => {
  router.push({ name: "library-actor", params: { actorId } });
};

// «Лора Хэддок» → «ЛХ» (на мобиле актёры показываются чипами с инициалами)
const actorInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

// Мобильная детальная разбита на три экрана с липкими табами (эталон):
// правки прогресса/отзыва не требуют скролла через всю страницу
const isMobile = useMediaQuery("(max-width: 767.98px)");

type DetailTab = "overview" | "progress" | "reviews";

const activeTab = ref<DetailTab>("overview");

// Счётчик на табе «Отзывы» — из общего состояния виджета отзывов
const { totalReviews: reviewsTotal } = useReviews();

// У фильмов нет блока прогресса — таб не показываем
const detailTabs = computed<Array<{ key: DetailTab; label: string; count: number }>>(
  () => {
    const tabs: Array<{ key: DetailTab; label: string; count: number }> = [
      { key: "overview", label: "Обзор", count: 0 },
    ];

    if (hasSerialProgress.value) {
      tabs.push({ key: "progress", label: "Прогресс", count: 0 });
    }

    tabs.push({ key: "reviews", label: "Отзывы", count: reviewsTotal.value });

    return tabs;
  },
);

// Если активный таб недоступен (фильм без прогресса) — падаем на «Обзор»
const effectiveTab = computed<DetailTab>(() =>
  detailTabs.value.some((tab) => tab.key === activeTab.value)
    ? activeTab.value
    : "overview",
);

const showTab = (tab: DetailTab): boolean =>
  !isMobile.value || effectiveTab.value === tab;

// «Похожее из вашей коллекции» — непросмотренные тайтлы того же жанра.
// Блок не рендерим, если совпадений нет (пустое состояние тут не нужно)
interface SimilarMovie {
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: string | null;
  posterUrl: string | null;
}

const similarMovies = ref<SimilarMovie[]>([]);

const loadSimilar = async (movieId: string): Promise<void> => {
  try {
    const { data, status } = await useFetch<SimilarMovie[]>(
      `${MOVIES_ENDPOINTS}/${movieId}/similar?limit=4`,
      { method: FETCH_METHOD.get },
    );

    similarMovies.value = isSuccessStatus(status) ? (data ?? []) : [];
  } catch {
    // Блок необязательный — молча оставляем пустым
    similarMovies.value = [];
  }
};

const openSimilar = (movieId: string): void => {
  router.push({ name: "detail", params: { id: movieId } });
};

const isRateModalVisible = ref(false);

// Модалка сохранила оценку — обновляем панель без перезагрузки
const onRateSaved = (rate: number): void => {
  if (currentUserMovie.value) {
    currentUserMovie.value = {
      ...currentUserMovie.value,
      personalRate: rate,
    };
  }
};

// Реактивный id: с блоком «Похожее» можно уйти на другой фильм, оставаясь
// в том же компоненте — иначе контент не перезагружался бы
const currentMovieId = computed<string | null>(() => {
  const raw = route.params.id;

  return typeof raw === "string" && raw ? raw : null;
});
const userId = computed(() => mainStore.userData?.id || "");

const isLoading = ref(false);
const showSkeleton = useMinLoading(() => isLoading.value);
const isError = ref<string | null>(null);
const currentUserMovie = ref<UserMovie | null>(null);
const isListsModalVisible = ref(false);
const newListName = ref("");
const newListLabelsInput = ref("");
const newListColor = ref<string>(DEFAULT_LIST_COLOR);
const isListActionLoading = ref(false);
const listIdsWithCurrentMovie = ref<Set<string>>(new Set());

const loadDetail = async (): Promise<void> => {
  const movieId = currentMovieId.value;

  if (!mainStore.isLoggedIn || !userId.value || !movieId) {
    return;
  }

  isError.value = null;

  // Если фильм уже в загруженной коллекции — показываем сразу, без скелетона.
  // Но в списке нет averageRating, поэтому деталь всё равно догружаем.
  const cached = userMoviesStore.userMovies.find(
    (um) => um.movieId === movieId
  );

  if (cached) {
    currentUserMovie.value = cached;
  }

  isLoading.value = !cached;

  try {
    const loaded = await userMoviesStore.fetchUserMovieById(
      userId.value,
      movieId
    );

    if (loaded) {
      currentUserMovie.value = loaded;
    } else if (!cached) {
      isError.value = "Фильм не найден в вашей коллекции";
    }
  } catch {
    if (!cached) {
      message.error("Не удалось загрузить фильм");
      isError.value = "Не удалось загрузить фильм";
    }
  } finally {
    isLoading.value = false;
  }

  void loadSimilar(movieId);
};

onMounted(loadDetail);

onBeforeUnmount(() => {
  currentUserMovie.value = null;
});

const isEditingProgress = ref<boolean>(false);
const editSeason = ref<number | undefined>(undefined);
const editEpisode = ref<number | undefined>(undefined);
const isProgressSaving = ref(false);

// Переход на другой фильм без размонтирования компонента
watch(currentMovieId, (next, prev) => {
  if (!next || next === prev) {
    return;
  }

  currentUserMovie.value = null;
  similarMovies.value = [];
  activeTab.value = "overview";
  isEditingProgress.value = false;
  void loadDetail();
});

// «Просмотрено» — как на остальных экранах (профиль, фильтры, Медиатека)
const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  [WatchStatus.NOT_STARTED]: "Не начато",
  [WatchStatus.WATCHING]: "Смотрю",
  [WatchStatus.COMPLETED]: "Просмотрено",
  [WatchStatus.DROPPED]: "Брошено",
};

const movie = computed(() => currentUserMovie.value?.movie);
const posterSrc = computed(() => movie.value?.imageUrl || FALLBACK_IMAGE_URL);

// Плитка «Средняя» в панели: средний балл по отзывам (приходит с бэка)
const hasAverageRating = computed(
  () => movie.value?.averageRating !== null && movie.value?.averageRating !== undefined,
);

// Полоса рейтинга в мобильном hero
const averageRatingPercent = computed(() => {
  const avg = movie.value?.averageRating;

  if (avg === null || avg === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(100, avg * 10));
});

const averageRatingLabel = computed(() => {
  const avg = movie.value?.averageRating;

  if (avg === null || avg === undefined) {
    return "нет";
  }

  return avg.toFixed(1).replace(".", ",");
});

/**
 * Чипы дат (эталон): «Начал» — при «смотрю» и дальше, «Досмотрел» — только
 * у просмотренных, «Бросил» — только у брошенных. При «не начато» чипов нет.
 * Активный чип — синий, пройденный этап — серый.
 */
type DateChip = {
  key: string;
  icon: string;
  label: string;
  active: boolean;
};

// В чипах дата компактная — «12 мая» (эталон); год добавляем, только если не текущий
const formatChipDate = (raw: string): string => {
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString("ru-RU", {
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

// Подпись в футере панели: «2 сезона, 14 серий»
const seasonsEpisodesLabel = computed(() => {
  const parts: string[] = [];

  if (movie.value?.seasonCount) {
    parts.push(pluralize(movie.value.seasonCount, PLURAL.season));
  }

  if (movie.value?.episodeCount) {
    parts.push(pluralize(movie.value.episodeCount, PLURAL.episode));
  }

  return parts.join(", ");
});

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

const startEditProgress = () => {
  editSeason.value = currentUserMovie.value?.currentSeason ?? undefined;
  editEpisode.value = currentUserMovie.value?.currentEpisode ?? undefined;
  isEditingProgress.value = true;
};

const cancelEditProgress = () => {
  isEditingProgress.value = false;
};

// Esc отменяет правку — как закрытие модалки
useEscapeKey(isEditingProgress, cancelEditProgress);

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

/**
 * Смена статуса просмотра из селекта в панели фильма (эталон 1c):
 * выбор статуса сразу пересчитывает прогресс сезонов/серий.
 */
const changeWatchStatus = async (nextStatus: WatchStatus) => {
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
    const hasEpisodeProgress = (currentUserMovie.value.currentEpisode ?? 0) > 0;

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

// v-model селекта: значение читаем из userMovie, запись — через changeWatchStatus
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

const formatTitlesCount = (count: number): string =>
  pluralize(count, PLURAL.title);

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
      color: newListColor.value,
      labels: parseListLabels(newListLabelsInput.value),
    });

    newListName.value = "";
    newListLabelsInput.value = "";
    newListColor.value = DEFAULT_LIST_COLOR;
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
    <div class="movie-detail__content">
      <!-- Хлебные крошки вместо кнопки «Назад» (эталон) -->
      <nav class="detail-crumbs" aria-label="Навигация">
        <button type="button" class="detail-crumbs__link" @click="goToCrumbParent">
          {{ crumbParentLabel }}
        </button>
        <BaseIcon
          class="detail-crumbs__sep"
          name="ph:caret-right"
          :width="12"
          :height="12"
        />
        <span class="detail-crumbs__current" :title="movie?.title ?? 'Детали'">
          {{ movie?.title ?? "Детали" }}
        </span>
      </nav>

      <StateBlock
        v-if="isError"
        v-bind="STATE_PRESETS.detailError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: () => router.go(0),
          },
          {
            label: 'Назад',
            icon: 'ph:arrow-left',
            kind: 'ghost',
            onClick: () => router.back(),
          },
        ]"
      />

      <DetailSkeleton v-else-if="showSkeleton" layout="page" />

      <template v-else-if="currentUserMovie && movie">
        <!-- Мобильный hero (эталон): постер на весь экран, поверх — навигация,
             чипы года/типа и название; ниже рейтинг и быстрые действия -->
        <template v-if="isMobile">
          <div class="detail-hero">
            <img class="detail-hero__bg" :src="posterSrc" :alt="movie.title" />
            <div class="detail-hero__scrim"></div>

            <button
              type="button"
              class="detail-hero__nav"
              aria-label="Назад"
              @click="goToCrumbParent"
            >
              <BaseIcon name="ph:arrow-left" :width="19" :height="19" />
            </button>

            <button
              type="button"
              class="detail-hero__nav detail-hero__nav_right"
              :class="{ 'detail-hero__nav_on': currentUserMovie.isFavorite }"
              :aria-label="
                currentUserMovie.isFavorite
                  ? 'Убрать из избранного'
                  : 'Добавить в избранное'
              "
              @click="toggleFavorite"
            >
              <BaseIcon
                :name="currentUserMovie.isFavorite ? 'ph:heart-fill' : 'ph:heart'"
                :width="18"
                :height="18"
              />
            </button>

            <div class="detail-hero__bottom">
              <div class="detail-hero__chips">
                <span v-if="movie.publishDate" class="detail-hero__chip">
                  {{ formatYear(movie.publishDate) }}
                </span>
                <span class="detail-hero__chip">
                  {{ movie.isSerial ? "сериал" : "фильм" }}
                </span>
              </div>
              <h1 class="detail-hero__title">{{ movie.title }}</h1>
            </div>
          </div>

          <div class="detail-mobile-bar">
            <div class="detail-mobile-rate">
              <span class="detail-mobile-rate__num">
                {{ hasAverageRating ? averageRatingLabel : "—" }}
              </span>
              <span class="detail-mobile-rate__max">/10</span>
              <span class="detail-mobile-rate__track">
                <span
                  class="detail-mobile-rate__fill"
                  :style="{ width: `${averageRatingPercent}%` }"
                />
              </span>
            </div>

            <div class="detail-mobile-status">
              <span class="detail-mobile-status__label">Статус</span>
              <WatchStatusSelect
                v-model="watchStatusModel"
                :disabled="isProgressSaving"
              />
            </div>

            <div class="detail-mobile-actions">
              <MovieShareButton
                v-if="currentMovieId"
                :movie-id="currentMovieId"
                :movie-title="movie.title"
              />
              <button
                type="button"
                class="detail-mobile-actions__icon"
                :class="{
                  'detail-mobile-actions__icon_on': currentUserMovie.seeLater,
                }"
                aria-label="Смотреть позже"
                :aria-pressed="currentUserMovie.seeLater"
                @click="toggleSeeLater"
              >
                <BaseIcon name="ph:clock" :width="20" :height="20" />
              </button>
            </div>
          </div>
        </template>

        <div class="detail-grid">
        <div class="detail-main">
        <!-- Мобильные табы (эталон): контент детальной разбит на три экрана -->
        <div v-if="isMobile" class="detail-tabs" role="tablist">
          <button
            v-for="tab in detailTabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="detail-tabs__btn"
            :class="{ 'detail-tabs__btn--on': activeTab === tab.key }"
            :aria-selected="activeTab === tab.key"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span v-if="tab.count" class="detail-tabs__count">
              {{ tab.count }}
            </span>
          </button>
        </div>

        <div v-show="showTab('overview')" class="detail-tabpanel">
        <div
          v-if="movie.description || movie.genres?.length"
          class="detail-section"
        >
          <h2 class="detail-section__title">
            <BaseIcon name="ph:text-align-left" :width="22" :height="22" />
            Описание
          </h2>
          <p v-if="movie.description" class="detail-section__text">
            {{ movie.description }}
          </p>
          <!-- Жанры: в панели их нет (эталон — метастрока год·тип·страны) -->
          <div v-if="movie.genres?.length" class="detail-genres">
            <span v-for="g in movie.genres" :key="g" class="detail-genres__chip">
              {{ GenreLabels[g] ?? g }}
            </span>
          </div>
        </div>

        <div v-if="hasActors" class="detail-section">
          <h2 class="detail-section__title">
            <BaseIcon name="ph:users-three" :width="22" :height="22" />
            Актёры
          </h2>
          <!-- Карточки актёров (эталон): аватар + имя + переход к фильмографии -->
          <div class="actors-grid">
            <button
              v-for="actor in movie.actors"
              :key="actor.id"
              type="button"
              class="actor-card"
              @click="goToActor(actor.id)"
            >
              <span class="actor-card__avatar">
                <BaseIcon
                  class="actor-card__avatar-icon"
                  name="ph:user"
                  :width="21"
                  :height="21"
                />
                <span class="actor-card__initials">
                  {{ actorInitials(actor.name) }}
                </span>
              </span>
              <span class="actor-card__info">
                <span class="actor-card__name">{{ actor.name }}</span>
                <span class="actor-card__role">в главной роли</span>
              </span>
              <BaseIcon
                class="actor-card__caret"
                name="ph:caret-right"
                :width="15"
                :height="15"
              />
            </button>
          </div>
        </div>

        <div v-if="isMobile" class="detail-section detail-info">
          <div v-if="movie.countryCodes?.length" class="detail-info__row">
            <span class="detail-info__label">
              <BaseIcon name="ph:globe" :width="18" :height="18" />
              Страны
            </span>
            <b class="detail-info__value">
              {{ countriesLabelsRu(movie.countryCodes) }}
            </b>
          </div>

          <div v-if="movie.isSerial && movie.seasonCount" class="detail-info__row">
            <span class="detail-info__label">
              <BaseIcon name="ph:monitor" :width="18" :height="18" />
              Сезонов
            </span>
            <b class="detail-info__value">{{ movie.seasonCount }}</b>
          </div>

          <div v-if="movie.isSerial && movie.episodeCount" class="detail-info__row">
            <span class="detail-info__label">
              <BaseIcon name="ph:playlist" :width="18" :height="18" />
              Эпизодов
            </span>
            <b class="detail-info__value">{{ movie.episodeCount }}</b>
          </div>

          <div v-if="currentUserMovie.addedAt" class="detail-info__row">
            <span class="detail-info__label">
              <BaseIcon name="ph:eye" :width="18" :height="18" />
              Добавлено
            </span>
            <b class="detail-info__value">
              {{ formatDate(currentUserMovie.addedAt) }}
            </b>
          </div>
        </div>
        </div>
        <!-- /Обзор -->

        <div v-show="showTab('progress')" class="detail-tabpanel">
        <div v-if="hasSerialProgress" class="detail-section">
          <div class="detail-section__header">
            <h2 class="detail-section__title">
              <BaseIcon name="ph:clock-countdown" :width="22" :height="22" />
              Прогресс просмотра
            </h2>
            <a-button
              v-if="!isEditingProgress"
              type="text"
              size="small"
              class="detail-section__edit-btn"
              @click="startEditProgress"
            >
              <BaseIcon name="ph:pencil-simple" :width="16" :height="16" />
              <span>Изменить</span>
            </a-button>
          </div>

          <div v-if="isSerialCompleted" class="serial-progress__completed">
            <BaseIcon name="ph:check-circle" :width="20" :height="20" />
            <span>Сериал просмотрен полностью</span>
          </div>

          <!-- Статус здесь только читается: управление — в панели фильма (эталон) -->
          <div class="serial-progress__status-row">
            <span class="serial-progress__status-info">
              Статус:
              <b class="serial-progress__status-value">
                {{ currentWatchStatusLabel }}
              </b>
            </span>
            <span class="serial-progress__status-hint">
              Меняется в панели фильма
            </span>
          </div>

          <!-- Даты статусов (эталон): состав зависит от текущего статуса -->
          <div v-if="dateChips.length" class="serial-progress__date-chips">
            <span
              v-for="chip in dateChips"
              :key="chip.key"
              class="date-chip"
              :class="{ 'date-chip--active': chip.active }"
            >
              <BaseIcon :name="chip.icon" :width="14" :height="14" />
              {{ chip.label }}
            </span>
          </div>

          <div v-if="!isEditingProgress" class="serial-progress">
            <div v-if="movie.seasonCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Сезоны</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentSeason ?? 0 }} / {{ movie.seasonCount }}
                </span>
              </div>
              <div class="serial-progress__track">
                <div
                  class="serial-progress__fill"
                  :class="{ 'serial-progress__fill_done': isSerialCompleted }"
                  :style="{ width: `${seasonProgress}%` }"
                />
              </div>
            </div>

            <div v-if="movie.episodeCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Эпизоды</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentEpisode ?? 0 }} / {{ movie.episodeCount }}
                </span>
              </div>
              <div class="serial-progress__track">
                <div
                  class="serial-progress__fill"
                  :class="{ 'serial-progress__fill_done': isSerialCompleted }"
                  :style="{ width: `${episodeProgress}%` }"
                />
              </div>
            </div>

            <!-- Эталон: серая плашка + белый сегмент с «−1 / +1» -->
            <div class="serial-progress__quick-actions">
              <div v-if="movie.seasonCount" class="serial-progress__quick-group">
                <span class="serial-progress__quick-label">Сезон</span>
                <div class="serial-progress__seg">
                  <button
                    type="button"
                    class="serial-progress__seg-btn"
                    :disabled="isProgressSaving || !canDecreaseSeason"
                    aria-label="Уменьшить сезон"
                    @click="decreaseSeason"
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    class="serial-progress__seg-btn"
                    :disabled="isProgressSaving || !canIncreaseSeason"
                    aria-label="Увеличить сезон"
                    @click="increaseSeason"
                  >
                    +1
                  </button>
                </div>
              </div>
              <div v-if="movie.episodeCount" class="serial-progress__quick-group">
                <span class="serial-progress__quick-label">Эпизод</span>
                <div class="serial-progress__seg">
                  <button
                    type="button"
                    class="serial-progress__seg-btn"
                    :disabled="isProgressSaving || !canDecreaseEpisode"
                    aria-label="Уменьшить эпизод"
                    @click="decreaseEpisode"
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    class="serial-progress__seg-btn"
                    :disabled="isProgressSaving || !canIncreaseEpisode"
                    aria-label="Увеличить эпизод"
                    @click="increaseEpisode"
                  >
                    +1
                  </button>
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
                <BaseIcon name="ph:check" :width="16" :height="16" />
                Сохранить
              </a-button>
            </div>
          </div>
        </div>

        </div>
        <!-- /Прогресс -->

        <div v-show="showTab('reviews')" class="detail-tabpanel">
        <div
          v-if="currentMovieId"
          class="movie-detail__review-widget review-widget"
        >
          <ReviewsWidget :movie-id="currentMovieId" />
        </div>
        </div>
        <!-- /Отзывы -->

        <!-- «Похожее» — последний блок страницы (эталон); на мобилке живёт в «Обзоре» -->
        <div
          v-if="similarMovies.length && showTab('overview')"
          class="detail-section"
        >
          <h2 class="detail-section__title">
            <BaseIcon name="ph:squares-four" :width="22" :height="22" />
            Похожее из вашей коллекции
          </h2>
          <div class="similar-grid">
            <button
              v-for="item in similarMovies"
              :key="item.movieId"
              type="button"
              class="similar-card"
              @click="openSimilar(item.movieId)"
            >
              <span class="similar-card__poster">
                <img
                  v-if="item.posterUrl"
                  :src="item.posterUrl"
                  :alt="item.title"
                  loading="lazy"
                />
              </span>
              <span class="similar-card__title">{{ item.title }}</span>
              <span class="similar-card__meta">
                <template v-if="item.publishDate">
                  {{ formatYear(item.publishDate) }} ·
                </template>
                {{ item.isSerial ? "сериал" : "фильм" }}
              </span>
            </button>
          </div>
        </div>
        </div>
        <!-- /detail-main -->

        <!-- Липкая панель фильма (эталон 2c) -->
        <aside class="detail-side">
          <div class="detail-panel">
            <div class="detail-panel__head">
              <div class="detail-panel__poster">
                <img
                  :src="posterSrc"
                  :alt="`${movie.title} постер`"
                  class="detail-panel__poster-img"
                />
              </div>

              <div class="detail-panel__info">
                <h1 class="detail-panel__title">{{ movie.title }}</h1>
                <!-- Метастрока вместо чипов: это факты, а не фильтры -->
                <div class="detail-panel__meta">
                  <span v-if="movie.publishDate" class="detail-panel__meta-item">
                    <BaseIcon name="ph:calendar-blank" :width="13" :height="13" />
                    {{ formatYear(movie.publishDate) }}
                  </span>
                  <span
                    class="detail-panel__meta-item detail-panel__meta-item_kind"
                  >
                    <BaseIcon
                      :name="movie.isSerial ? 'ph:monitor' : 'ph:film-slate'"
                      :width="13"
                      :height="13"
                    />
                    {{ movie.isSerial ? "сериал" : "фильм" }}
                  </span>
                  <span
                    v-if="movie.countryCodes?.length"
                    class="detail-panel__meta-item detail-panel__meta-item_country"
                  >
                    <BaseIcon name="ph:globe" :width="13" :height="13" />
                    {{ countriesLabelsRu(movie.countryCodes) }}
                  </span>
                </div>
              </div>

              <div class="detail-panel__rates">
                <div class="detail-panel__rate">
                  <span class="detail-panel__rate-label">Моя оценка</span>
                  <span class="detail-panel__rate-value">
                    <b
                      class="detail-panel__rate-num detail-panel__rate-num_mine"
                      :class="{
                        'detail-panel__rate-num_empty':
                          !currentUserMovie.personalRate,
                      }"
                    >
                      {{ currentUserMovie.personalRate || "нет" }}
                    </b>
                    <span
                      v-if="currentUserMovie.personalRate"
                      class="detail-panel__rate-max"
                    >
                      /10
                    </span>
                  </span>
                </div>
                <div class="detail-panel__rate">
                  <span class="detail-panel__rate-label">Средняя</span>
                  <span class="detail-panel__rate-value">
                    <b
                      class="detail-panel__rate-num"
                      :class="{
                        'detail-panel__rate-num_empty': !hasAverageRating,
                      }"
                    >
                      {{ averageRatingLabel }}
                    </b>
                    <span v-if="hasAverageRating" class="detail-panel__rate-max">
                      /10
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Статус просмотра (эталон 1c): единственная точка управления -->
            <div class="detail-panel__status">
              <span class="detail-panel__status-label">Статус</span>
              <WatchStatusSelect
                v-model="watchStatusModel"
                :disabled="isProgressSaving"
              />
            </div>

            <a-button
              type="primary"
              class="detail-panel__rate-cta"
              @click="isRateModalVisible = true"
            >
              <BaseIcon name="ph:star" :width="18" :height="18" />
              {{ currentUserMovie.personalRate ? "Изменить оценку" : "Оценить" }}
            </a-button>

            <!-- Действия: ряд иконок (эталон) -->
            <div class="detail-panel__actions">
              <button
                type="button"
                class="detail-panel__action"
                :class="{
                  'detail-panel__action_fav': currentUserMovie.isFavorite,
                }"
                :title="
                  currentUserMovie.isFavorite
                    ? 'В избранном'
                    : 'Добавить в избранное'
                "
                :aria-label="
                  currentUserMovie.isFavorite
                    ? 'Убрать из избранного'
                    : 'Добавить в избранное'
                "
                @click="toggleFavorite"
              >
                <BaseIcon
                  :name="
                    currentUserMovie.isFavorite ? 'ph:heart-fill' : 'ph:heart'
                  "
                  :width="20"
                  :height="20"
                />
              </button>

              <button
                type="button"
                class="detail-panel__action"
                title="Добавить в список"
                aria-label="Добавить в список"
                @click="openListsModal"
              >
                <BaseIcon name="ph:list-plus" :width="20" :height="20" />
              </button>

              <MovieShareButton
                v-if="currentMovieId"
                compact
                :movie-id="currentMovieId"
                :movie-title="movie.title"
              />

              <button
                type="button"
                class="detail-panel__action"
                :class="{
                  'detail-panel__action_on': currentUserMovie.seeLater,
                }"
                :title="
                  currentUserMovie.seeLater
                    ? 'В списке «Смотреть позже»'
                    : 'Смотреть позже'
                "
                aria-label="Смотреть позже"
                :aria-pressed="currentUserMovie.seeLater"
                @click="toggleSeeLater"
              >
                <BaseIcon name="ph:clock" :width="20" :height="20" />
              </button>
            </div>

            <p
              v-if="
                currentUserMovie.addedAt ||
                (movie.isSerial && seasonsEpisodesLabel)
              "
              class="detail-panel__footnote"
            >
              <template v-if="currentUserMovie.addedAt">
                Добавлено {{ formatDate(currentUserMovie.addedAt) }}
              </template>
              <template v-if="movie.isSerial && seasonsEpisodesLabel">
                · {{ seasonsEpisodesLabel }}
              </template>
            </p>
          </div>
        </aside>
        </div>
        <!-- /detail-grid -->

        <!-- Мобилка: липкая панель действий над таб-баром (эталон) -->
        <div v-if="isMobile" class="detail-actionbar">
          <a-button
            type="primary"
            class="detail-actionbar__primary"
            @click="isRateModalVisible = true"
          >
            <BaseIcon name="ph:star" :width="18" :height="18" />
            {{ currentUserMovie.personalRate ? "Изменить оценку" : "Оценить" }}
          </a-button>
          <button
            type="button"
            class="detail-actionbar__icon"
            aria-label="Добавить в список"
            @click="openListsModal"
          >
            <BaseIcon name="ph:list-plus" :width="20" :height="20" />
          </button>
        </div>
      </template>
    </div>
  </div>

  <RateMovieModal
    v-if="currentMovieId && movie"
    v-model="isRateModalVisible"
    :movie-id="currentMovieId"
    :title="movie.title"
    :year="movie.publishDate ? formatYear(movie.publishDate) : ''"
    :kind="movie.isSerial ? 'сериал' : 'фильм'"
    :poster-url="movie.imageUrl"
    :personal-rate="currentUserMovie?.personalRate"
    @saved="onRateSaved"
  />

  <BaseModal v-model="isListsModalVisible" layout="detail">
    <template #title>Добавить в пользовательский список</template>

    <template #body>
      <div class="lists-modal">
        <div class="lists-modal__create">
          <div
            class="lists-modal__preview"
            :style="{ background: newListColor }"
          >
            {{ newListName.trim() || "Новый список" }}
          </div>
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
          <div class="lists-modal__swatches" role="radiogroup" aria-label="Цвет обложки">
            <button
              v-for="swatch in LIST_COLOR_SWATCHES"
              :key="swatch"
              type="button"
              class="lists-modal__swatch"
              :class="{ 'lists-modal__swatch--active': newListColor === swatch }"
              :style="{ background: swatch }"
              :aria-label="`Цвет ${swatch}`"
              :aria-checked="newListColor === swatch"
              role="radio"
              @click="newListColor = swatch"
            ></button>
          </div>
          <a-button
            type="primary"
            :loading="isListActionLoading"
            :disabled="!newListName.trim()"
            @click="createListFromModal"
          >
            Создать список
          </a-button>
        </div>

        <RowsSkeleton
          v-if="userListsStore.isLoading"
          :count="3"
          :badge="false"
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
@use "@/styles/scrollbar" as *;
@use "@/styles/layout" as *;

.movie-detail {
  @include pageShell(4rem);

  &__content {
    // Эталон: страница 1180px (контент 1fr + панель 348px + gap 22)
    max-width: 1180px;
    margin: 0 auto;
    padding: 2rem 1rem 0;
    // (StateBlock/скелетоны центрируются своими стилями и не задеты)
    text-align: left;

    @include mediaTablet {
      padding: 2.5rem 2rem 0;
    }
  }
}

/* ============ Каркас детальной (эталон): контент + липкая панель ============ */
.detail-crumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--fv-color-text-secondary);

  &__link {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: var(--fv-color-text-secondary);
    cursor: pointer;

    &:hover {
      color: var(--fv-color-text-primary);
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
      border-radius: 4px;
    }
  }

  &__sep {
    flex-shrink: 0;
    color: var(--fv-color-text-tertiary);
  }

  &__current {
    // Спека: элемент крошек обрезается на 220px, полный текст — в title
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fv-color-text-primary);
    font-weight: 500;
    min-width: 0;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 348px;
  gap: 22px;
  align-items: start;

  // ≤1080px — одна колонка, панель уезжает наверх
  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
}

.detail-main {
  min-width: 0;

  // первая секция без верхнего отступа — панель и контент выровнены по верху
  > .detail-section:first-child,
  > .detail-tabpanel:first-child > .detail-section:first-child {
    margin-top: 0;
  }
}

.detail-side {
  position: sticky;
  // Топбар проекта 64px + 16px зазор (в эталоне 96px при более высокой шапке)
  top: 80px;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  // padding+отрицательный margin, чтобы тень панели не срезалась скроллом
  padding: 8px;
  margin: -8px;

  @include customScrollbar();

  @media (max-width: 1080px) {
    position: static;
    order: -1;
    max-height: none;
    overflow: visible;
    margin: 0;
    padding: 0;
  }
}

/* ============ Панель фильма ============ */
.detail-panel {
  padding: 22px;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-low);
  text-align: left;

  &__head {
    display: grid;
    grid-template-columns: 112px 1fr;
    grid-template-areas: "poster info" "rates rates";
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;

    // Планшет: плитки оценок встают справа под метастрокой — пустота уходит
    @media (max-width: 1080px) {
      grid-template-columns: 150px 1fr;
      grid-template-areas: "poster info" "poster rates";
      gap: 10px 22px;
      align-content: start;
    }
  }

  &__poster {
    grid-area: poster;
    aspect-ratio: 2 / 3;
    border-radius: 14px;
    overflow: hidden;
    background: var(--fv-color-bg-secondary);
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__info {
    grid-area: info;
    min-width: 0;
  }

  &__title {
    margin: 0;
    // Эталон: mts-h4 (UI-шрифт), 20/24
    font-family: var(--fv-font-ui);
    font-size: 20px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--fv-color-text-primary);
  }

  // Метастрока: год · тип · страны (факты, не фильтры)
  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }

  &__meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;

    // Разделитель «·» прилипает к своему элементу, а не висит в конце строки
    // при переносе (панель узкая — «США, Великобритания» часто уезжает вниз)
    + .detail-panel__meta-item::before {
      content: "·";
      margin-inline-end: 3px;
      color: var(--fv-color-text-tertiary);
    }

    &_kind {
      color: var(--fv-color-accent);
      font-weight: 500;
    }

    // В узкой панели страны всё равно не влезают в строку с годом и типом —
    // отдаём им отдельную строку без разделителя (иначе «·» висит перед ними).
    // Класс удвоен: иначе правило-разделитель выше выигрывает по специфичности.
    &_country {
      flex-basis: 100%;

      &.detail-panel__meta-item::before {
        content: none;
      }

      // Панель развёрнута наверх — места хватает, возвращаем в общую строку
      @media (max-width: 1080px) {
        flex-basis: auto;

        &.detail-panel__meta-item::before {
          content: "·";
          margin-inline-end: 3px;
          color: var(--fv-color-text-tertiary);
        }
      }
    }
  }

  &__rates {
    grid-area: rates;
    display: flex;
    gap: 12px;
  }

  &__rate {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
  }

  &__rate-label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--fv-color-text-secondary);
  }

  &__rate-value {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  &__rate-num {
    font-family: var(--fv-font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    color: var(--fv-color-text-primary);

    &_mine {
      color: var(--fv-color-accent);
    }

    // Нет оценки: display-шрифт 24/700 превращал «—» в жирную черту
    &_empty {
      font-family: var(--fv-font-ui);
      font-size: 17px;
      font-weight: 500;
      color: var(--fv-color-text-tertiary);
    }
  }

  &__rate-max {
    font-size: 13px;
    color: var(--fv-color-text-tertiary);
  }

  &__status {
    margin-bottom: 18px;
  }

  &__status-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  // Основное действие — оценить (эталон: primary во всю ширину панели)
  &__rate-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 46px;
    margin-bottom: 10px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
  }

  // Действия — ряд равных иконок (перенос текста исключён)
  &__actions {
    display: flex;
    gap: 10px;
    margin-bottom: 18px;
  }

  &__action {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    // В избранном — красная подложка (эталон)
    &_fav {
      background: var(--fv-color-negative-soft);
      color: var(--fv-color-brand);

      &:hover {
        background: color-mix(
          in srgb,
          var(--fv-color-brand) 18%,
          transparent
        );
      }
    }

    &_on {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);

      &:hover {
        background: color-mix(
          in srgb,
          var(--fv-color-accent) 20%,
          transparent
        );
      }
    }
  }

  // «Поделиться» — общий компонент, приводим к виду соседних иконок
  &__actions :deep(.movie-share-btn) {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    box-shadow: none;

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
      color: var(--fv-color-text-primary);
    }
  }

  &__footnote {
    margin: 0;
    padding-top: 12px;
    border-top: 1px solid var(--fv-color-border);
    font-size: 13px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
  }
}

/* «Похожее»: сетка постеров (эталон) */
.similar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.similar-card {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover .similar-card__poster {
    transform: translateY(-4px);
    box-shadow: var(--fv-shadow-middle);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
    border-radius: 14px;
  }

  &__poster {
    display: block;
    aspect-ratio: 2 / 3;
    margin-bottom: 9px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
    transition:
      transform var(--fv-motion-base) var(--fv-ease),
      box-shadow var(--fv-motion-base) var(--fv-ease);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
  }
}

/* Инфо-строки (эталон .mrow) — мобильная замена метастроки панели */
.detail-info {
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 0;
    border-bottom: 1px solid var(--fv-color-border);

    &:first-child {
      padding-top: 0;
    }

    &:last-child {
      padding-bottom: 0;
      border-bottom: none;
    }
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--fv-color-text-secondary);

    svg {
      color: var(--fv-color-accent);
    }
  }

  &__value {
    color: var(--fv-color-text-primary);
    text-align: right;
  }
}

/* ===== Мобильный hero (эталон): постер на весь экран ===== */
.detail-hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: min(420px, 56vh);
  padding: 20px;
  // Растягиваем на всю ширину, компенсируя padding контейнера
  margin: 0 -1rem;
  overflow: hidden;

  &__bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  // Затемнение снизу, чтобы название и чипы читались на любом постере
  &__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(20, 26, 40, 0.35) 0%,
      rgba(20, 26, 40, 0.15) 35%,
      rgba(20, 26, 40, 0.92) 100%
    );
  }

  &__nav {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(4px);
    color: #fff;
    cursor: pointer;

    &_right {
      left: auto;
      right: 16px;
    }

    &_on {
      color: var(--fv-color-brand);
      background: rgba(255, 255, 255, 0.92);
    }
  }

  &__bottom {
    position: relative;
    z-index: 2;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: 30px;
    font-weight: 700;
    line-height: 1.05;
    color: #fff;
  }
}

/* Блок под hero: рейтинг, статус, быстрые действия */
.detail-mobile-bar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 0;
}

.detail-mobile-rate {
  display: flex;
  align-items: center;
  gap: 12px;

  &__num {
    font-family: var(--fv-font-display);
    font-size: 34px;
    font-weight: 700;
    line-height: 1;
    color: var(--fv-color-accent);
  }

  &__max {
    color: var(--fv-color-text-tertiary);
  }

  &__track {
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
  }

  &__fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--fv-color-accent);
  }
}

.detail-mobile-status {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }
}

.detail-mobile-actions {
  display: flex;
  gap: 10px;

  // Канва страницы сама mist — серые кнопки на ней сливались, поэтому белые
  :deep(.movie-share-btn) {
    flex: 1;
    height: 48px;
    margin: 0;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font-size: 15px;
    font-weight: 500;
    box-shadow: none;
  }

  &__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 48px;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    cursor: pointer;

    &_on {
      border-color: transparent;
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }
  }
}

/* ===== Мобильная детальная: табы, панель действий, чипы актёров ===== */
.detail-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: var(--fv-color-bg-secondary);
  // Табы липнут под шапкой, чтобы переключаться не прокручивая наверх
  position: sticky;
  top: 64px;
  z-index: 5;

  &__btn {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 36px;
    padding: 0 6px;
    border: none;
    border-radius: 9px;
    background: transparent;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &--on {
      background: var(--fv-color-bg-primary);
      box-shadow: var(--fv-shadow-low);
      color: var(--fv-color-text-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }
  }

  &__count {
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
    font-size: 11px;
    font-weight: 500;
  }
}

/* Липкая панель действий: над мобильным таб-баром (64px + safe-area) */
.detail-actionbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 10px;
  // Таб-бар на детальной скрыт — панель занимает низ (эталон)
  padding: 12px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--fv-color-border);
  background: color-mix(in srgb, var(--fv-color-bg-primary) 94%, transparent);
  backdrop-filter: blur(10px);

  &__primary {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
  }

  &__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }
  }
}

/* Инициалы в аватаре актёра — только в мобильных чипах */
.actor-card__initials {
  display: none;
}

/* Чип даты статуса: активный этап — синий, пройденный — нейтральный (эталон) */
.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--fv-color-border);
  border-radius: 999px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--fv-color-text-secondary);
  white-space: nowrap;

  &--active {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }
}

/* Жанры — чипами в блоке «Описание» (в панели эталона их нет) */
.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;

  &__chip {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
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
    border-bottom: 1px solid color-mix(in srgb, var(--fv-color-border) 65%, transparent);
  }

  &__preview {
    display: flex;
    align-items: flex-end;
    min-height: 64px;
    padding: 0.75rem 1rem;
    border-radius: var(--fv-radius-md);
    color: #fff;
    font-family: var(--fv-font-display);
    font-weight: 500;
    font-size: 1.1rem;
    text-align: left;
    box-shadow: var(--fv-shadow-low);
    transition: background var(--fv-motion-slow) var(--fv-ease);
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  &__swatch {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    outline-offset: 2px;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--fv-color-text-primary) 12%, transparent);
    transition: transform var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      transform: scale(1.08);
    }

    &--active {
      border-color: var(--fv-color-bg-primary);
      box-shadow: 0 0 0 2px var(--fv-color-text-primary);
    }
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
    border: 1px solid var(--fv-color-border);
    background: color-mix(in srgb, var(--fv-color-bg-secondary) 75%, transparent);
  }

  &__list-main {
    display: grid;
    gap: 0.25rem;
  }

  &__list-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__list-meta {
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
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
    border: 1px solid color-mix(in srgb, var(--fv-color-accent) 35%, transparent);
    background: color-mix(in srgb, var(--fv-color-accent) 10%, var(--fv-color-bg-primary));
    color: var(--fv-color-accent);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.15rem 0.55rem;
    line-height: 1.3;
  }

  &__empty {
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px dashed var(--fv-color-border);
    color: var(--fv-color-text-secondary);
  }
}

.detail-section {
  margin-top: 22px;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  padding: 26px;
  box-shadow: var(--fv-shadow-low);

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
    font-weight: 500;
    color: var(--fv-color-text-primary);
    margin: 0 0 1rem 0;

    svg {
      color: var(--fv-color-accent);
    }
  }

  &__text {
    font-size: var(--fv-text-p3-size);
    line-height: var(--fv-text-p3-lh);
    color: var(--fv-color-text-secondary);
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

.movie-detail__review-widget {
  // Как между секциями (эталон). Через смежный селектор нельзя: контент
  // разбит на .detail-tabpanel, и прогресс с отзывами — не соседи
  margin-top: 22px;
}

.actors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.actor-card {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 12px 9px 9px;
  border: 1.5px solid transparent;
  border-radius: 14px;
  background: var(--fv-color-bg-secondary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--fv-motion-fast) var(--fv-ease),
    background var(--fv-motion-fast) var(--fv-ease);

  &:hover {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }

  &__avatar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }

  &__info {
    min-width: 0;
  }

  &__name {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__role {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
  }

  &__caret {
    flex-shrink: 0;
    margin-inline-start: auto;
    color: var(--fv-color-text-tertiary);
  }
}

.serial-progress {
  display: flex;
  flex-direction: column;
  // Между строками прогресса нужен воздух: с эталонными 14px полоса «Сезоны»
  // визуально прилипала к подписи «Эпизоды»
  gap: 18px;

  // Эталон: positive-soft подложка, текст и иконка затемнены для контраста
  // (светло-зелёный на светлом фоне читался плохо). color-mix вместо хардкода
  // #0F5C26/#0F7A32 — чтобы не потерять читаемость в тёмной теме.
  &__completed {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--fv-color-positive-soft);
    color: color-mix(
      in srgb,
      var(--fv-color-positive) 45%,
      var(--fv-color-text-primary)
    );
    font-weight: 500;
    font-size: 0.9rem;
    margin-bottom: 16px;

    svg {
      color: color-mix(
        in srgb,
        var(--fv-color-positive) 55%,
        var(--fv-color-text-primary)
      );
    }
  }

  // Эталон: без серой карточки — только подпись, бейдж и полоса
  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  // Полоса прогресса: 8px, полностью скруглённая (было 6px от a-progress)
  &__track {
    height: 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    background: var(--fv-color-accent);
    transition:
      width 0.4s var(--fv-ease),
      background var(--fv-motion-slow) var(--fv-ease);

    // Зеленеет только у просмотренных (цвет идёт от статуса, не от 100%)
    &_done {
      background: var(--fv-color-positive);
    }
  }

  &__status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
    margin-bottom: 14px;
  }

  &__status-info {
    color: var(--fv-color-text-secondary);
  }

  &__status-value {
    color: var(--fv-color-text-primary);
    font-weight: 500;
  }

  &__status-hint {
    font-size: 0.8rem;
    color: var(--fv-color-text-tertiary);
  }

  &__date-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__label-value {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
    font-size: 13px;
    // В шрифте есть 400/500/700 — при 600 браузер подставлял 700 (перетяжелён)
    font-weight: 500;
  }

  &__quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    // До плашек с кнопками — чуть больше, чем между строками прогресса
    margin-top: 2px;

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  }

  // Эталон: серая плашка без рамки, radius 12, padding 10/14
  &__quick-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--fv-color-bg-secondary);
  }

  &__quick-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  // Сегмент «−1 / +1»: белая подложка, кнопки без рамок (эталон .seg)
  &__seg {
    display: inline-flex;
    gap: 2px;
    padding: 4px;
    border-radius: 10px;
    background: var(--fv-color-bg-primary);
  }

  &__seg-btn {
    height: 34px;
    padding: 0 14px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover:not(:disabled) {
      background: var(--fv-color-bg-secondary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }

    &:disabled {
      color: var(--fv-color-text-tertiary);
      cursor: default;
      opacity: 0.6;
    }
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
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--fv-color-border) 50%, transparent);

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
      align-items: flex-start;
      gap: 0.35rem;
    }
  }
}
/* Мобильные переопределения — в конце файла, чтобы перебивать базовые правила */
@media (max-width: 767.98px) {
  .movie-detail__content {
    // Hero прижат к краям, поэтому боковой отступ гасим здесь
    padding-top: 0;
    // Место под липкую панель действий
    padding-bottom: 96px;
  }

  // На мобиле роль панели играет hero + блок под ним
  .detail-crumbs,
  .detail-side {
    display: none;
  }

  // Актёры превращаются в чипы (эталон)
  .actors-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .actor-card {
    width: auto;
    min-height: 36px;
    align-items: center;
    gap: 7px;
    padding: 4px 13px 4px 5px;
    border-radius: 999px;
    border-color: var(--fv-color-border);

    &__avatar {
      width: 26px;
      height: 26px;
      flex: none;
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }

    &__avatar-icon {
      display: none;
    }

    &__initials {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      text-transform: uppercase;
    }

    &__info {
      display: flex;
      align-items: center;
    }

    &__name {
      font-size: 13px;
      line-height: 1.2;
    }

    // В чипе роль и стрелка не нужны
    &__role,
    &__caret {
      display: none;
    }
  }

  // Тач-таргеты 44px (эталон)
  .serial-progress__seg-btn {
    min-width: 44px;
    height: 44px;
  }

  .serial-progress__quick-group {
    padding: 9px 12px;
  }
}

</style>
