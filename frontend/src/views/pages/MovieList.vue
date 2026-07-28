<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { type UserMovie, useUserMoviesStore, WatchStatus } from "@/stores";
import type { MovieApiResponse } from "@/stores/movies/types";
import { useMainStore } from "@/state/state";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock, {
  type StateAction,
} from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { formatYear, movieCardMeta, movieCardTitle } from "@/utils";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import type { UserMoviesFilters } from "@/stores";
import MovieCard from "@/components/MovieCard/MovieCard.vue";
import CollectionFiltersBar from "@/components/MoviesFiltersPanel/CollectionFiltersBar.vue";
import { FETCH_METHOD, useFetch, useEscapeKey } from "@/composable";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";

const router = useRouter();
const route = useRoute();
const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

interface QuickAddOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const QUICK_ADD_MIN_QUERY_LENGTH = 2;
const QUICK_ADD_DEBOUNCE_MS = 280;
const QUICK_ADD_OPTIONS_LIMIT = 10;

const imageErrors = ref<Set<string>>(new Set());
const quickAddQuery = ref("");
const quickAddOptions = ref<QuickAddOption[]>([]);
const isQuickAddLoading = ref(false);
const isQuickAddPanelOpen = ref(false);
const quickAddFabRoot = ref<HTMLElement | null>(null);
let quickAddDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const userId = computed(() => mainStore.userData?.id || "");
const hasMovies = computed(() => userMoviesStore.currentList.length !== 0);
const totalMovies = computed(() => userMoviesStore.currentList.length);

// Догрузка вместо страниц (спека new-9): порция = pageSize
const restCount = computed(
  () => totalMovies.value - userMoviesStore.visibleUserMovies.length,
);

const showMore = (): void => {
  userMoviesStore.setCurrentPage(userMoviesStore.currentPage + 1);
};

const userMovieIds = computed(() => {
  return new Set(userMoviesStore.userMovies.map((item) => item.movieId));
});
const showSkeleton = useMinLoading(() => userMoviesStore.isLoading);

const shouldFetchMovies = computed(
  () => !hasMovies.value && mainStore.isLoggedIn && userId.value
);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    totalMovies.value > 0 &&
    !userMoviesStore.isError &&
    !userMoviesStore.isLoading
);

const collectionEmptyState = computed(() => {
  if (userMoviesStore.hasActiveFilters) {
    return {
      variant: "empty" as const,
      icon: "ph:magnifying-glass",
      title: "Ничего не найдено",
      description: "Измените фильтры или сбросьте их, чтобы увидеть коллекцию.",
      actions: [
        {
          label: "Сбросить фильтры",
          icon: "ph:arrow-counter-clockwise",
          kind: "secondary",
          onClick: () => void clearCollectionFilters(),
        },
      ] as StateAction[],
    };
  }

  return {
    ...STATE_PRESETS.collectionEmpty,
    actions: [
      {
        label: "Добавить фильм",
        icon: "ph:plus",
        kind: "primary",
        onClick: goToCreate,
      },
      {
        label: "Открыть каталог",
        icon: "ph:squares-four",
        kind: "secondary",
        onClick: goToCatalog,
      },
    ] as StateAction[],
  };
});

const clearCollectionFilters = async () => {
  userMoviesStore.clearSearch();
  userMoviesStore.setFilters({});
  userMoviesStore.setCurrentPage(1);

  if (!userId.value) {
    return;
  }

  await userMoviesStore.fetchUserMovies(userId.value);
};

const goToCatalog = () => {
  router.push("/library/catalog");
};

const goToCreate = () => {
  router.push("/create");
};

const getPosterSrc = (item: UserMovie) => {
  return imageErrors.value.has(item.movieId)
    ? FALLBACK_IMAGE_URL
    : item.movie.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

// Прогресс просмотра для полосы на постере (сериал — по сериям, фильм — завершён/нет)
const watchProgressPercent = (item: UserMovie): number => {
  const { movie } = item;

  if (movie.isSerial && movie.episodeCount && item.currentEpisode) {
    return Math.min(
      100,
      Math.round((item.currentEpisode / movie.episodeCount) * 100)
    );
  }

  return item.completedAt || item.watchStatus === WatchStatus.COMPLETED
    ? 100
    : 0;
};

const removeMovie = async (item: UserMovie) => {
  try {
    await userMoviesStore.removeUserMovie(userId.value, item.movieId);
    message.success(`${item.movie.title} удален`);
  } catch {
    message.error(`Не удалось удалить: ${item.movie.title}`);
  }
};

const addToFavorite = async (item: UserMovie) => {
  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      isFavorite: true,
    });
    message.success(`${item.movie.title} добавлен в избранное`);
  } catch {
    message.error(`Не удалось добавить в избранное: ${item.movie.title}`);
  }
};

const removeFromFavorite = async (item: UserMovie) => {
  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      isFavorite: false,
    });
    message.success(`${item.movie.title} удален из избранного`);
  } catch {
    message.error(`Не удалось удалить из избранного: ${item.movie.title}`);
  }
};

const getQueryValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
};

const normalizeWatchStatus = (
  value: string | null
): WatchStatus | undefined => {
  if (!value) {
    return undefined;
  }

  const allowed = Object.values(WatchStatus);

  if (allowed.includes(value as WatchStatus)) {
    return value as WatchStatus;
  }

  return undefined;
};

const applyRoutePresetFilters = async () => {
  const watchStatus = normalizeWatchStatus(
    getQueryValue(route.query.watchStatus)
  );
  const isSerialRaw = getQueryValue(route.query.isSerial);
  const seeLaterRaw = getQueryValue(route.query.seeLater);
  const hasPreset =
    watchStatus !== undefined || isSerialRaw !== null || seeLaterRaw !== null;

  if (!hasPreset || !userId.value) {
    return;
  }

  const isSerial =
    isSerialRaw === null
      ? undefined
      : isSerialRaw === "true"
      ? true
      : isSerialRaw === "false"
      ? false
      : undefined;
  const seeLater =
    seeLaterRaw === null
      ? undefined
      : seeLaterRaw === "true"
      ? true
      : seeLaterRaw === "false"
      ? false
      : undefined;

  userMoviesStore.setFilters({
    ...userMoviesStore.filters,
    watchStatus,
    isSerial,
    seeLater,
  });

  try {
    await userMoviesStore.fetchUserMovies(userId.value);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

const goToMovie = (item: UserMovie) => {
  router.push(`/detail/${item.movieId}`);
};

const resetQuickAddState = () => {
  quickAddQuery.value = "";
  quickAddOptions.value = [];
  isQuickAddLoading.value = false;

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }
};

const openQuickAddPanel = () => {
  isQuickAddPanelOpen.value = true;
};

const closeQuickAddPanel = () => {
  isQuickAddPanelOpen.value = false;
};

// Esc закрывает панель быстрого ввода (клик вне уже закрывает)
useEscapeKey(isQuickAddPanelOpen, closeQuickAddPanel);

const toggleQuickAddPanel = () => {
  if (isQuickAddPanelOpen.value) {
    closeQuickAddPanel();
  } else {
    openQuickAddPanel();
  }
};

const buildQuickAddOptionLabel = (
  movie: MovieApiResponse,
  isExisting: boolean
) => {
  const mediaType = movie.isSerial ? "сериал" : "фильм";
  const year = movie.publishDate
    ? formatYear(movie.publishDate)
    : "год не указан";
  const suffix = isExisting ? " • уже в коллекции" : "";

  return `${movie.title} • ${mediaType} • ${year}${suffix}`;
};

const fetchQuickAddOptions = async (query: string) => {
  const q = query.trim();

  if (!q || q.length < QUICK_ADD_MIN_QUERY_LENGTH) {
    quickAddOptions.value = [];
    isQuickAddLoading.value = false;

    return;
  }

  isQuickAddLoading.value = true;

  try {
    const endpoint = `/movies/search?q=${encodeURIComponent(q)}`;
    const { data, status } = await useFetch<MovieApiResponse[]>(endpoint, {
      method: FETCH_METHOD.get,
    });

    if (status !== 200) {
      throw new Error("Не удалось загрузить подсказки");
    }

    const prepared = data.slice(0, QUICK_ADD_OPTIONS_LIMIT).map((movie) => {
      const isExisting = userMovieIds.value.has(movie.id);

      return {
        value: movie.id,
        label: buildQuickAddOptionLabel(movie, isExisting),
        disabled: isExisting,
      };
    });

    quickAddOptions.value = prepared;
  } catch {
    quickAddOptions.value = [];
  } finally {
    isQuickAddLoading.value = false;
  }
};

const handleQuickAddSearch = (value: string) => {
  quickAddQuery.value = value;

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }

  const q = value.trim();
  if (!q || q.length < QUICK_ADD_MIN_QUERY_LENGTH) {
    quickAddOptions.value = [];
    isQuickAddLoading.value = false;

    return;
  }

  quickAddDebounceTimer = setTimeout(() => {
    void fetchQuickAddOptions(value);
  }, QUICK_ADD_DEBOUNCE_MS);
};

const handleQuickAddSelect = async (movieId: string) => {
  if (!userId.value) {
    return;
  }

  try {
    await userMoviesStore.addUserMovie(userId.value, movieId, {});
    message.success("Тайтл добавлен в коллекцию");
    resetQuickAddState();
    closeQuickAddPanel();
  } catch (error: unknown) {
    if (isApiConflictError(error)) {
      message.warning(
        getApiResponseMessage(error) ?? "Этот тайтл уже есть в коллекции"
      );

      return;
    }

    message.error(getApiResponseMessage(error) ?? "Не удалось добавить тайтл");
  }
};

const onGlobalPointerDown = (event: MouseEvent) => {
  if (!isQuickAddPanelOpen.value) {
    return;
  }

  const root = quickAddFabRoot.value;
  const target = event.target;

  if (!root || !(target instanceof Node)) {
    return;
  }

  if (!root.contains(target)) {
    closeQuickAddPanel();
  }
};

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isQuickAddPanelOpen.value) {
    closeQuickAddPanel();
  }
};

const handleFiltersUpdate = async (filters: UserMoviesFilters) => {
  userMoviesStore.setFilters(filters);
  userMoviesStore.setCurrentPage(1);

  if (!userId.value) {
    return;
  }

  try {
    if (userMoviesStore.searchQuery.trim()) {
      await userMoviesStore.searchUserMovies(
        userId.value,
        userMoviesStore.searchQuery
      );
    } else {
      userMoviesStore.clearSearch();
      await userMoviesStore.fetchUserMovies(userId.value);
    }
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

const findMovie = async (value: string) => {
  if (!userId.value) {
    return;
  }

  try {
    await userMoviesStore.searchUserMovies(userId.value, value);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

onMounted(async () => {
  window.addEventListener("mousedown", onGlobalPointerDown);
  window.addEventListener("keydown", onGlobalKeydown);

  if (shouldFetchMovies.value) {
    try {
      await userMoviesStore.fetchUserMovies(userId.value);
    } catch {
      message.error(ERROR_FETCH_MOVIES_TEXT);
    }
  }

  await applyRoutePresetFilters();
});

onBeforeUnmount(() => {
  window.removeEventListener("mousedown", onGlobalPointerDown);
  window.removeEventListener("keydown", onGlobalKeydown);

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }

  // Сбрасываем общий стор-стейт поиска/фильтров, иначе он «протекает» на другие
  // страницы (напр. в Избранное) и показывает 0 результатов при возврате.
  userMoviesStore.clearSearch();
  userMoviesStore.setFilters({});
  userMoviesStore.setCurrentPage(1);
});

const repeatFetchMovies = () => {
  if (userId.value) {
    return userMoviesStore.fetchUserMovies(userId.value);
  }
};

watch(
  () => userMoviesStore.searchQuery,
  () => {
    userMoviesStore.setCurrentPage(1);
  }
);

watch(
  () => route.query,
  () => {
    void applyRoutePresetFilters();
  }
);
</script>

<template>
  <div class="movie-list">
    <div class="movie-list__content">
      <CollectionFiltersBar
        :search-handler="findMovie"
        :result-count="totalMovies"
        @update:filters="handleFiltersUpdate"
      />
      <StateBlock
        v-if="userMoviesStore.isError"
        v-bind="STATE_PRESETS.collectionError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: repeatFetchMovies,
          },
        ]"
      />

      <PosterGridSkeleton v-else-if="showSkeleton" :count="12" />

      <StateBlock v-else-if="!totalMovies" v-bind="collectionEmptyState" />

      <div v-else class="movie-list__grid">
        <MovieCard
          v-for="item in userMoviesStore.visibleUserMovies"
          :key="item.id"
          :poster-src="getPosterSrc(item)"
          :title="movieCardTitle(item.movie)"
          :meta="movieCardMeta(item.movie)"
          :rate="item.personalRate || 0"
          :progress-percent="watchProgressPercent(item)"
          :favorite="item.isFavorite"
          deletable
          @open="goToMovie(item)"
          @toggle-favorite="
            item.isFavorite ? removeFromFavorite(item) : addToFavorite(item)
          "
          @delete="removeMovie(item)"
          @poster-error="handleImageError(item.movieId)"
        />
      </div>

      <div
        v-if="showPaginator && userMoviesStore.hasMoreUserMovies"
        class="movie-list__more"
      >
        <a-button size="large" @click="showMore">
          Показать ещё
          <span class="movie-list__more-count">{{ restCount }}</span>
        </a-button>
      </div>
    </div>

    <div ref="quickAddFabRoot" class="quick-add-fab" data-tour="tour-quick-add">
      <Transition name="quick-add-fab-panel">
        <div
          v-if="isQuickAddPanelOpen"
          class="quick-add-fab__panel"
          @click.stop
        >
          <div class="quick-add-fab__panel-head">
            <h3 class="quick-add-fab__panel-title">Быстрый ввод</h3>
            <span class="quick-add-fab__panel-hint">
              Добавление тайтла из каталога
            </span>
          </div>
          <a-auto-complete
            v-model:value="quickAddQuery"
            :options="quickAddOptions"
            :filter-option="false"
            placement="topLeft"
            :not-found-content="
              quickAddQuery.trim().length >= QUICK_ADD_MIN_QUERY_LENGTH &&
              !isQuickAddLoading
                ? 'Ничего не найдено'
                : undefined
            "
            @search="handleQuickAddSearch"
            @select="handleQuickAddSelect"
          >
            <a-input
              size="large"
              :maxlength="120"
              placeholder="Например: Рекрут, Интерстеллар, Dark..."
            >
              <template #prefix>
                <BaseIcon name="ph:magnifying-glass" :width="16" :height="16" />
              </template>
            </a-input>
          </a-auto-complete>
        </div>
      </Transition>

      <button
        type="button"
        class="quick-add-fab__button"
        :class="{ 'quick-add-fab__button_active': isQuickAddPanelOpen }"
        @click.stop="toggleQuickAddPanel"
      >
        <BaseIcon
          :name="isQuickAddPanelOpen ? 'ph:x' : 'ph:plus'"
          :width="22"
          :height="22"
        />
        <span class="quick-add-fab__button-text">Быстрый ввод</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/card" as *;
@use "@/styles/antd-overrides" as *;

.movie-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    @include pageContentContainer;
  }

  &__grid {
    @include cardsGrid;
  }

  // Догрузка: кнопка «Показать ещё» по центру под сеткой
  &__more {
    display: flex;
    justify-content: center;
    margin-top: 8px;
    padding: 8px 0 32px;

    .ant-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 46px;
      padding: 0 22px;
      border-radius: var(--fv-radius-control);
      font-weight: 500;
    }
  }

  &__more-count {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  &__empty-state {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--fv-color-text-secondary);
    width: 100%;

    @include antEmptyTypography;
  }

  &__empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 1.25rem;
  }

  &__empty-hint {
    margin: 1rem 0 0;
    max-width: 26rem;
    font-size: 0.88rem;
    line-height: 1.45;
    opacity: 0.9;
  }
}

.quick-add-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1000;
  display: grid;
  gap: 0.7rem;
  justify-items: end;

  &__panel {
    width: min(420px, calc(100vw - 2rem));
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem;
    border-radius: 16px;
    border: 1px solid var(--fv-color-border);
    background: color-mix(in srgb, var(--fv-color-bg-primary) 92%, transparent);
    box-shadow: var(--fv-shadow-elevated);
    backdrop-filter: blur(8px);

    :deep(.ant-select) {
      width: 100%;
    }
  }

  &__panel-head {
    display: grid;
    gap: 0.1rem;
  }

  &__panel-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__panel-hint {
    font-size: 0.78rem;
    color: var(--fv-color-text-secondary);
  }

  &__button {
    border: 1px solid color-mix(in srgb, var(--fv-color-brand) 35%, transparent);
    background: linear-gradient(
      135deg,
      var(--fv-color-brand),
      color-mix(in srgb, var(--fv-color-brand), #000 12%)
    );
    color: #fff;
    border-radius: 999px;
    padding: 0.58rem 0.92rem;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    cursor: pointer;
    box-shadow: var(--fv-shadow-brand-md);
    transition: transform var(--fv-motion-slow) var(--fv-ease), box-shadow var(--fv-motion-slow) var(--fv-ease);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px
        color-mix(in srgb, var(--fv-color-brand) 40%, transparent);
    }

    &_active {
      background: color-mix(in srgb, var(--fv-color-brand) 92%, #1f3b87);
    }
  }

  &__button-text {
    font-size: 0.86rem;
    font-weight: 500;
  }

  @include mediaMax(768px) {
    right: 0.85rem;
    // поднимаем над мобильным таб-баром (82px + safe-area)
    bottom: calc(82px + env(safe-area-inset-bottom, 0px) + 0.85rem);

    &__button {
      padding: 0.55rem 0.8rem;
    }

    &__button-text {
      display: none;
    }
  }
}

.quick-add-fab-panel-enter-active,
.quick-add-fab-panel-leave-active {
  transition: all var(--fv-motion-slow) var(--fv-ease);
}

.quick-add-fab-panel-enter-from,
.quick-add-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
