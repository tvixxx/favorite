<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { message } from "ant-design-vue";
import { type UserMovie, useUserMoviesStore, WatchStatus } from "@/stores";
import { useMainStore } from "@/state/state";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock, {
  type StateAction,
} from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { movieCardMeta, movieCardTitle } from "@/utils";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import type { UserMoviesFilters } from "@/stores";
import LoadMoreButton from "@/components/LoadMoreButton/LoadMoreButton.vue";
import MovieCard from "@/components/MovieCard/MovieCard.vue";
import CollectionFiltersBar from "@/components/MoviesFiltersPanel/CollectionFiltersBar.vue";
import ConfirmDialog from "@/components/ConfirmDialog/ConfirmDialog.vue";
import CollectionQuickAdd from "@/components/Collection/CollectionQuickAdd.vue";
import WatchTonightModal from "@/components/WatchTonight/WatchTonightModal.vue";
import { getUserPreference } from "@/utils/userPreferences";

const router = useRouter();
const route = useRoute();
const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();
const watchTonightOpen = ref(false);
const showQuickAdd = computed(() =>
  getUserPreference(mainStore.userData, "quickAddEnabled")
);
const showWatchTonight = computed(() =>
  getUserPreference(mainStore.userData, "watchTonightEnabled")
);

const imageErrors = ref<Set<string>>(new Set());

const userId = computed(() => mainStore.userData?.id || "");
const totalMovies = computed(() => userMoviesStore.totalCount);

// Догрузка вместо страниц (спека new-9): порция = pageSize
const restCount = computed(
  () => totalMovies.value - userMoviesStore.visibleUserMovies.length
);

const showMore = async (): Promise<void> => {
  try {
    await userMoviesStore.loadMore(userId.value);
  } catch {
    message.error("Не удалось загрузить следующую порцию");
  }
};

const showSkeleton = useMinLoading(() => userMoviesStore.isLoading);

const shouldFetchMovies = computed(() => mainStore.isLoggedIn && userId.value);
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
    : item.movie.imageThumbnailUrl || item.movie.imageUrl || FALLBACK_IMAGE_URL;
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

const removal = ref<UserMovie | null>(null);
const isRemoving = ref(false);
const removalOpen = computed({
  get: () => removal.value !== null,
  set: (open: boolean) => {
    if (!open && !isRemoving.value) {
      removal.value = null;
    }
  },
});

const removeMovie = (item: UserMovie): void => {
  removal.value = item;
};

const confirmRemoval = async (): Promise<void> => {
  const item = removal.value;

  if (!item || isRemoving.value) {
    return;
  }

  isRemoving.value = true;

  try {
    await userMoviesStore.removeUserMovie(userId.value, item.movieId);
    removal.value = null;
    message.success(`${item.movie.title} удален`);
  } catch {
    message.error(`Не удалось удалить: ${item.movie.title}`);
  } finally {
    isRemoving.value = false;
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

watch(showWatchTonight, (visible) => {
  if (!visible) watchTonightOpen.value = false;
});

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
  if (shouldFetchMovies.value) {
    try {
      await userMoviesStore.ensureUserMovies(userId.value);
    } catch {
      message.error(ERROR_FETCH_MOVIES_TEXT);
    }
  }

  await applyRoutePresetFilters();
});

onBeforeUnmount(() => {
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
        :filters="userMoviesStore.filters"
        :search-query="userMoviesStore.searchQuery"
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
          :movie-id="item.movieId"
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
        <LoadMoreButton
          :count="restCount"
          :loading="userMoviesStore.isLoadingMore"
          @load-more="showMore"
        />
      </div>
    </div>

    <ConfirmDialog
      v-model="removalOpen"
      title="Удалить из коллекции?"
      :subject="removal?.movie.title"
      description="Личная оценка и прогресс просмотра будут удалены. Тайтл также исчезнет из всех ваших списков."
      :loading="isRemoving"
      @confirm="confirmRemoval"
    />
    <WatchTonightModal v-if="showWatchTonight" v-model="watchTonightOpen" />

    <CollectionQuickAdd
      :user-id="userId"
      :enabled="showQuickAdd"
      :watch-tonight-enabled="showWatchTonight"
      @watch-tonight="watchTonightOpen = true"
    />
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

    @include mediaMax($tablet) {
      margin-bottom: 0;
    }
  }

  // Догрузка: кнопка «Показать ещё» по центру под сеткой
  &__more {
    display: flex;
    justify-content: center;
    margin-top: 8px;
    padding: 8px 0 32px;

    @include mediaMax($tablet) {
      padding-bottom: 0;
    }
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
</style>
