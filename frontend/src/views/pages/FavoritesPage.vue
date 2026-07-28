<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { movieCardMeta, movieCardTitle, PLURAL, pluralize } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import { useUserMoviesStore } from "@/stores";

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

// Переключатель типа (эталон): фильтруем уже загруженное избранное на клиенте
type FavoriteKind = "all" | "movies" | "serials";

const KIND_TABS: { key: FavoriteKind; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "movies", label: "Фильмы" },
  { key: "serials", label: "Сериалы" },
];

const activeKind = ref<FavoriteKind>("all");

const setKind = (kind: FavoriteKind): void => {
  if (activeKind.value === kind) {
    return;
  }

  activeKind.value = kind;
  userMoviesStore.setCurrentPage(1);
};

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
  const source = userMoviesStore.searchQuery.trim()
    ? userMoviesStore.searchResults.filter((um) => um.isFavorite)
    : favoriteUserMovies.value;

  if (activeKind.value === "all") {
    return source;
  }

  const wantSerial = activeKind.value === "serials";

  return source.filter((um) => um.movie.isSerial === wantSerial);
});

const visibleFavorites = computed(() =>
  favoritesForView.value.slice(
    0,
    userMoviesStore.currentPage * userMoviesStore.pageSize,
  ),
);

const restCount = computed(
  () => favoritesForView.value.length - visibleFavorites.value.length,
);

const showMore = (): void => {
  userMoviesStore.setCurrentPage(userMoviesStore.currentPage + 1);
};

const totalFavorites = computed(() => favoritesForView.value.length);

const favoritesSubtitle = computed(
  () => `${pluralize(totalFavorites.value, PLURAL.title)} отмечено сердечком`,
);
const hasFilteredResults = computed(() => favoritesForView.value.length > 0);

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

  // Если избранное есть, но отфильтровано по типу — это не «пусто», а «нет такого типа»
  if (activeKind.value !== "all" && favoriteUserMovies.value.length) {
    return {
      variant: "empty" as const,
      icon: activeKind.value === "serials" ? "ph:monitor-play" : "ph:film-slate",
      title:
        activeKind.value === "serials"
          ? "Сериалов в избранном нет"
          : "Фильмов в избранном нет",
      description: "Переключите тип или отметьте сердечком что-нибудь ещё.",
      actions: [
        {
          label: "Показать все",
          icon: "ph:list",
          kind: "primary",
          onClick: () => setKind("all"),
        },
      ] as StateAction[],
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
      <div class="favorites__kinds" role="group" aria-label="Тип тайтла">
        <button
          v-for="tab in KIND_TABS"
          :key="tab.key"
          type="button"
          class="favorites__kind"
          :class="{ 'favorites__kind--active': activeKind === tab.key }"
          @click="setKind(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <CollectionFiltersBar
        :show-status="false"
        search-placeholder="Поиск по избранному"
        :search-handler="handleSearch"
        :result-count="userMoviesStore.currentList.length"
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
        <div class="favorites__grid">
          <MovieCard
            v-for="item in visibleFavorites"
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

        <div v-if="restCount > 0" class="favorites__more">
          <a-button size="large" @click="showMore">
            Показать ещё
            <span class="favorites__more-count">{{ restCount }}</span>
          </a-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "@/styles/scrollbar" as *;
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



  // Переключатель типа: активный — тёмная ink-пилюля (эталон)
  &__kinds {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
    overflow-x: auto;

    @include hideScrollbar();
  }

  &__kind {
    flex-shrink: 0;
    height: 40px;
    padding: 0 18px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover:not(&--active) {
      background: var(--fv-color-bg-secondary);
    }

    &--active {
      background: var(--fv-color-text-primary);
      border-color: transparent;
      color: var(--fv-color-bg-primary);
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
  }
}
</style>
