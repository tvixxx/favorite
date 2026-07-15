<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { movieCardMeta, movieCardTitle } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import { useUserMoviesStore } from "@/stores";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock, {
  type StateAction,
} from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import type { UserMovie, UserMoviesFilters } from "@/stores";
import CollectionFiltersBar from "@/components/MoviesFiltersPanel/CollectionFiltersBar.vue";
import MovieCard from "@/components/MovieCard/MovieCard.vue";

const router = useRouter();
const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

const imageErrors = ref<Set<string>>(new Set());
const searchQuery = ref("");
const localFilters = ref<UserMoviesFilters>({});

const userId = computed(() => mainStore.userData?.id || "");

/** Запросы со страницы избранного всегда ограничиваются isFavorite=true */
const applyFavoriteScopeToStore = () => {
  userMoviesStore.setFilters({
    ...userMoviesStore.filters,
    isFavorite: true,
  });
};

const favoriteUserMovies = computed(() =>
  userMoviesStore.favoriteUserMovies
);

const shouldFetchFavorites = computed(
  () =>
    !favoriteUserMovies.value.length &&
    mainStore.isLoggedIn &&
    !!userId.value
);

const refetchFavorites = async () => {
  if (!userId.value) {
    return;
  }

  applyFavoriteScopeToStore();
  await userMoviesStore.fetchUserMovies(userId.value);
};

const handleFiltersUpdate = async (filters: UserMoviesFilters) => {
  localFilters.value = filters;
  userMoviesStore.setCurrentPage(1);
  userMoviesStore.setFilters({ ...filters, isFavorite: true });

  if (!userId.value) {
    return;
  }

  try {
    if (searchQuery.value.trim()) {
      await userMoviesStore.searchUserMovies(userId.value, searchQuery.value);
    } else {
      userMoviesStore.clearSearch();
      await refetchFavorites();
    }
  } catch {
    message.error("Ошибка применения фильтров");
  }
};

const handleSearch = async (value: string) => {
  searchQuery.value = value;
  userMoviesStore.setCurrentPage(1);
  applyFavoriteScopeToStore();

  if (!userId.value) {
    return;
  }

  try {
    if (value.trim()) {
      await userMoviesStore.searchUserMovies(userId.value, value);
    } else {
      userMoviesStore.clearSearch();
      await refetchFavorites();
    }
  } catch {
    message.error("Ошибка поиска");
  }
};

/** Сетка и пагинация: при текстовом поиске показываем searchResults (API с isFavorite), иначе — избранное из userMovies */
const favoritesForView = computed(() => {
  if (userMoviesStore.searchQuery.trim()) {
    return userMoviesStore.searchResults.filter((um) => um.isFavorite);
  }

  return favoriteUserMovies.value;
});

const paginatedFavorites = computed(() => {
  const favorites = favoritesForView.value;
  const start = (userMoviesStore.currentPage - 1) * userMoviesStore.pageSize;

  return favorites.slice(start, start + userMoviesStore.pageSize);
});

const totalFavorites = computed(() => favoritesForView.value.length);

const pluralTitles = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "тайтл";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return "тайтла";
  }

  return "тайтлов";
};

const favoritesSubtitle = computed(
  () =>
    `${totalFavorites.value} ${pluralTitles(totalFavorites.value)} отмечено сердечком`,
);
const hasFilteredResults = computed(() => favoritesForView.value.length > 0);

const showPaginator = computed(
  () =>
    !!favoritesForView.value.length &&
    !userMoviesStore.isError &&
    !userMoviesStore.isLoading
);

const showSkeleton = useMinLoading(() => userMoviesStore.isLoading);

const favoritesEmptyState = computed(() => {
  const searching =
    searchQuery.value.trim() || userMoviesStore.searchQuery.trim();

  if (searching) {
    return {
      variant: "empty" as const,
      icon: "ph:magnifying-glass",
      title: "Ничего не найдено",
      description: "В избранном ничего не найдено — измените запрос.",
      actions: [] as StateAction[],
    };
  }

  return {
    ...STATE_PRESETS.favoritesEmpty,
    actions: [
      {
        label: "Открыть каталог",
        icon: "ph:squares-four",
        kind: "secondary",
        onClick: () => void router.push("/library/catalog"),
      },
    ] as StateAction[],
  };
});

const getPosterSrc = (item: UserMovie) => {
  return imageErrors.value.has(item.movieId)
    ? FALLBACK_IMAGE_URL
    : item.movie.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

const removeFromFavorite = async (item: UserMovie) => {
  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      isFavorite: false,
    });
    message.success(`${item.movie.title} удален из избранного`);
  } catch {
    message.error(`Не удалось убрать из избранного: ${item.movie.title}`);
  }
};

const goToMovie = (item: UserMovie) => {
  router.push(`/detail/${item.movieId}`);
};

onMounted(async () => {
  applyFavoriteScopeToStore();

  if (shouldFetchFavorites.value) {
    try {
      await refetchFavorites();
    } catch {
      message.error(
        "Ошибка загрузки избранного. Пожалуйста, попробуйте позже."
      );
    }
  }
});

onBeforeUnmount(() => {
  // Полный сброс общего стор-стейта, чтобы поиск/фильтры не «протекали»
  // на другие страницы (Медиатека и т.д.).
  userMoviesStore.clearSearch();
  userMoviesStore.setFilters({});
  userMoviesStore.setCurrentPage(1);
});
</script>

<template>
  <section class="favorites">
    <HeroHeader
      title="Любимое кино"
      :subtitle="favoritesSubtitle"
      badge-text="Избранное"
      icon-name="ph:heart-fill"
      icon-tone="negative"
    />

    <div class="favorites__content">
      <CollectionFiltersBar
        :show-status="false"
        search-placeholder="Поиск по избранному"
        :search-handler="handleSearch"
        @update:filters="handleFiltersUpdate"
      />
      <StateBlock
        v-if="userMoviesStore.isError"
        v-bind="STATE_PRESETS.favoritesError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: () => void refetchFavorites(),
          },
        ]"
      />

      <PosterGridSkeleton v-else-if="showSkeleton" :count="12" />

      <StateBlock v-else-if="!hasFilteredResults" v-bind="favoritesEmptyState" />

      <div v-else class="favorites__section">
        <div class="favorites__section-header">
          <h2 class="favorites__section-title">
            <BaseIcon name="ph:heart" />
            Избранное
          </h2>
          <a-button
            v-if="userMoviesStore.isError"
            size="large"
            class="favorites__refresh"
            @click="() => void refetchFavorites()"
          >
            Обновить
          </a-button>
        </div>

        <div class="favorites__grid">
          <MovieCard
            v-for="item in paginatedFavorites"
            :key="item.id"
            :poster-src="getPosterSrc(item)"
            :title="movieCardTitle(item.movie)"
            :meta="movieCardMeta(item.movie)"
            :rate="item.personalRate || 0"
            :favorite="true"
            @open="goToMovie(item)"
            @toggle-favorite="removeFromFavorite(item)"
            @poster-error="handleImageError(item.movieId)"
          />
        </div>

        <div class="favorites__pagination" v-if="showPaginator">
          <a-pagination
            v-model:current="userMoviesStore.currentPage"
            :total="totalFavorites"
            :page-size="userMoviesStore.pageSize"
            :page-size-options="['6', '12', '18', '24']"
            show-size-changer
            @change="userMoviesStore.setCurrentPage"
            @showSizeChange="(_, size: number) => userMoviesStore.setPageSize(size)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/card" as *;

.favorites {
  @include pageShell(4rem);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    @include pageContentContainer;
  }

  &__section {
    margin-top: 2rem;
    width: 100%;
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--fv-color-border) 50%, transparent);
  }

  &__section-title {
    font-size: 1.75rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0;

    svg {
      width: 28px;
      height: 28px;
      color: var(--fv-color-brand);
    }
  }

  &__refresh {
    background: transparent;
    border: 1px solid var(--fv-color-border);
    color: var(--fv-color-text-secondary);

    &:hover {
      border-color: var(--fv-color-accent);
      color: var(--fv-color-accent);
    }
  }

  &__grid {
    @include cardsGrid;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    padding: 2rem;
    width: 100%;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 4rem;
    padding: 2rem 0;
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
  }
}
</style>
