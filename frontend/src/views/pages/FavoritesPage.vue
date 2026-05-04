<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { formatDate, formatYear } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import { useUserMoviesStore } from "@/stores";

import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import ListEmpty from "@/components/List/ListEmpty/ListEmpty.vue";
import type { UserMovie, UserMoviesFilters } from "@/stores";
import MoviesFiltersPanel from "@/components/MoviesFiltersPanel/MoviesFiltersPanel.vue";

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
const hasFilteredResults = computed(() => favoritesForView.value.length > 0);

const showPaginator = computed(
  () =>
    !!favoritesForView.value.length &&
    !userMoviesStore.isError &&
    !userMoviesStore.isLoading
);

const emptyFavoritesDescription = computed(() =>
  searchQuery.value.trim() || userMoviesStore.searchQuery.trim()
    ? "В избранном ничего не найдено"
    : "Избранных фильмов пока нет..."
);

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

const goToMovies = () => {
  router.push("/library/collection");
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
  userMoviesStore.setFilters({
    ...userMoviesStore.filters,
    isFavorite: undefined,
  });
});
</script>

<template>
  <section class="favorites">
    <HeroHeader
      title="Ваши любимые фильмы"
      subtitle="Только то, что вы выделили как лучшее"
      badge-text="Избранное"
      :badge-count="totalFavorites"
      icon-name="mdi:heart"
    />

    <div class="favorites__content">
      <AppBackButton :fallback="{ path: '/profile' }" />
      <MoviesFiltersPanel
        :search-handler="handleSearch"
        @update:filters="handleFiltersUpdate"
      />
      <ListError
        v-if="userMoviesStore.isError"
        :isError="userMoviesStore.isError"
        :repeatFn="() => void refetchFavorites()"
        repeatText="Повторить"
      />

      <div v-else-if="userMoviesStore.isLoading" class="favorites__loading">
        <ListLoading
          size="large"
          loading-text="Загружаем избранное..."
          :center="true"
        />
      </div>

      <div v-else-if="!hasFilteredResults" class="favorites__empty-state">
        <ListEmpty
          :description="emptyFavoritesDescription"
          btn-text="Перейти в фильмы"
          :btn-handler="goToMovies"
        />
      </div>

      <div v-else class="favorites__section">
        <div class="favorites__section-header">
          <h2 class="favorites__section-title">
            <BaseIcon name="mdi:heart-outline" />
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
          <div
            v-for="item in paginatedFavorites"
            :key="item.id"
            class="favorites__card"
            @click="goToMovie(item)"
          >
            <div class="favorites__card-image">
              <img
                :src="getPosterSrc(item)"
                :alt="`${item.movie.title} постер`"
                class="favorites__poster"
                loading="lazy"
                @error="handleImageError(item.movieId)"
              />
              <div class="favorites__card-favorite">
                <BaseIcon name="mdi:heart" />
              </div>
            </div>

            <div class="favorites__card-content">
              <div class="favorites__card-rating">{{ item.personalRate || 0 }}/10</div>

              <button
                class="favorites__card-delete"
                @click.stop="() => removeFromFavorite(item)"
              >
                <BaseIcon name="pajamas:remove" />
              </button>

              <h3 class="favorites__card-title">{{ item.movie.title }}</h3>

              <div class="favorites__card-meta">
                <div class="favorites__meta-item">
                  <BaseIcon name="mdi:calendar" class="favorites__meta-icon" />
                  {{ formatDate(item.addedAt) }}
                </div>
                <div class="favorites__meta-item">
                  {{ formatYear(item.movie.publishDate) }}
                </div>
              </div>
            </div>
          </div>
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
    max-width: 1400px;
  }

  &__section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);
  }

  &__section-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0;

    svg {
      width: 28px;
      height: 28px;
      color: var(--ant-color-primary);
    }
  }

  &__refresh {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
    }
  }

  &__grid {
    @include cardsGrid;
  }

  &__card {
    @include clickableCard(var(--radius-md));

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(
        90deg,
        var(--ant-color-primary),
        color-mix(in srgb, var(--ant-color-primary) 50%, var(--bg-secondary))
      );
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 1;
    }

    &:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.2);
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 40%,
        transparent
      );

      &::before {
        opacity: 1;
      }

      .favorites__poster {
        transform: scale(1.05);
      }
    }
  }

  &__card-image {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transition: transform 0.4s ease;
  }

  &__card-favorite {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2;

    svg {
      width: 20px;
      height: 20px;
      color: var(--ant-color-primary);
    }
  }

  &__card-content {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  &__card-rating {
    align-self: flex-end;
    background: var(--ant-color-primary);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 16px;
    font-size: 0.8rem;
    font-weight: 700;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--ant-color-primary) 30%, transparent);
  }

  &__card-delete {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-secondary) 50%, transparent);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    opacity: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 2;

    .favorites__card:hover & {
      opacity: 1;
    }

    @media (max-width: 899px) {
      opacity: 0.9;
    }

    &:hover {
      background: #ef4444;
      border-color: #dc2626;
      color: white;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  &__card-title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--text-primary);
    flex-grow: 1;
  }

  &__card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__meta-icon {
    width: 14px;
    height: 14px;
    color: var(--ant-color-primary);
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
    color: var(--text-secondary);
    width: 100%;
  }
}
</style>
