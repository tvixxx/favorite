<script lang="ts" setup>
import { useRouter } from "vue-router";
import { computed, onMounted, ref } from "vue";
import { formatDate, formatYear } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import { useFavoritesStore } from "@/stores/favorites/favoritesStore";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import ListEmpty from "@/components/List/ListEmpty/ListEmpty.vue";
import type { Movie } from "@/stores";
import type { MoviesFilters } from "@/stores";
import dayjs from "dayjs";
import MoviesFiltersPanel from "@/components/MoviesFiltersPanel/MoviesFiltersPanel.vue";

const router = useRouter();
const favoritesStore = useFavoritesStore();
const mainStore = useMainStore();

const imageErrors = ref<Set<string>>(new Set());
const searchQuery = ref("");
const localFilters = ref<MoviesFilters>({});

const shouldFetchFavorites = computed(
  () => !hasFavorites.value && mainStore.isLoggedIn
);

const handleFiltersUpdate = (filters: MoviesFilters) => {
  localFilters.value = filters;
  favoritesStore.setCurrentPage(1);
};

const handleSearch = async (value: string) => {
  searchQuery.value = value;
  favoritesStore.setCurrentPage(1);
};

const filteredFavorites = computed(() => {
  let list = favoritesStore.favoritesList;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();

    list = list.filter((movie) => movie.title.toLowerCase().includes(query));
  }

  const f = localFilters.value;

  if (f.genre) {
    list = list.filter((movie) => movie.genre === f.genre);
  }

  if (f.rateMin !== undefined || f.rateMax !== undefined) {
    list = list.filter((movie) => {
      const rate = movie.rate ?? 0;

      if (f.rateMin !== undefined && rate < f.rateMin) {
        return false;
      }

      if (f.rateMax !== undefined && rate > f.rateMax) {
        return false;
      }

      return true;
    });
  }

  if (f.dateFrom || f.dateTo) {
    list = list.filter((movie) => {
      if (!movie.date) {
        return false;
      }

      const d = dayjs(movie.date);

      if (f.dateFrom && d.isBefore(dayjs(f.dateFrom))) {
        return false;
      }

      if (f.dateTo && d.isAfter(dayjs(f.dateTo))) {
        return false;
      }

      return true;
    });
  }

  if (f.publishDateFrom || f.publishDateTo) {
    list = list.filter((movie) => {
      if (!movie.publishDate) {
        return false;
      }

      const d = dayjs(movie.publishDate);

      if (f.publishDateFrom && d.isBefore(dayjs(f.publishDateFrom))) {
        return false;
      }

      if (f.publishDateTo && d.isAfter(dayjs(f.publishDateTo))) {
        return false;
      }

      return true;
    });
  }

  if (f.seeLater) {
    list = list.filter((movie) => movie.seeLater);
  }

  return list;
});

const paginatedFavorites = computed(() => {
  const start = (favoritesStore.currentPage - 1) * favoritesStore.pageSize;

  return filteredFavorites.value.slice(start, start + favoritesStore.pageSize);
});

const totalFavorites = computed(() => filteredFavorites.value.length);
const hasFavorites = computed(() => favoritesStore.favoritesList.length !== 0);
const hasFilteredResults = computed(() => filteredFavorites.value.length > 0);

const showPaginator = computed(
  () =>
    !!favoritesStore.favoritesList.length &&
    !favoritesStore.isError &&
    !favoritesStore.isLoading
);

const getPosterSrc = (item: Movie) => {
  return imageErrors.value.has(item.id)
    ? FALLBACK_IMAGE_URL
    : item.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

const removeFromFavorite = async (favoriteMovie: Movie) => {
  try {
    await favoritesStore.removeFromFavorite(favoriteMovie);
    message.success(`${favoriteMovie.title} удален`);
  } catch {
    message.error(`Не удалось убрать из избранного: ${favoriteMovie.title}`);
  }
};

const goToMovie = ({ id }: Movie) => {
  router.push(`/detail/${id}`);
};

const goToMovies = () => {
  router.push("/list");
};

onMounted(async () => {
  if (shouldFetchFavorites.value) {
    try {
      await favoritesStore.fetchFavorites();
    } catch {
      message.error(
        "Ошибка загрузки избранного. Пожалуйста, попробуйте позже."
      );
    }
  }
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
      <MoviesFiltersPanel
        :search-handler="handleSearch"
        @update:filters="handleFiltersUpdate"
      />
      <ListError
        v-if="favoritesStore.isError"
        :isError="favoritesStore.isError"
        :repeatFn="favoritesStore.fetchFavorites"
        repeatText="Повторить"
      />

      <div v-else-if="favoritesStore.isLoading" class="favorites__loading">
        <ListLoading
          size="large"
          loading-text="Загружаем избранное..."
          :center="true"
        />
      </div>

      <div v-else-if="!hasFilteredResults" class="favorites__empty-state">
        <ListEmpty
          description="Избранных фильмов пока нет..."
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
            v-if="favoritesStore.isError"
            size="large"
            @click="favoritesStore.fetchFavorites"
            class="favorites__refresh"
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
                :alt="`${item.title} постер`"
                class="favorites__poster"
                loading="lazy"
                @error="handleImageError(item.id)"
              />
              <div class="favorites__card-favorite">
                <BaseIcon name="mdi:heart" />
              </div>
            </div>

            <div class="favorites__card-content">
              <div class="favorites__card-rating">{{ item.rate }}/10</div>

              <button
                class="favorites__card-delete"
                @click.stop="() => removeFromFavorite(item)"
              >
                <BaseIcon name="pajamas:remove" />
              </button>

              <h3 class="favorites__card-title">{{ item.title }}</h3>

              <div class="favorites__card-meta">
                <div class="favorites__meta-item">
                  <BaseIcon name="mdi:calendar" class="favorites__meta-icon" />
                  {{ formatDate(item.date) }}
                </div>
                <div class="favorites__meta-item">
                  {{ formatYear(item.publishDate) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="favorites__pagination" v-if="showPaginator">
          <a-pagination
            v-model:current="favoritesStore.currentPage"
            :total="totalFavorites"
            :page-size="favoritesStore.pageSize"
            :page-size-options="['6', '12', '18', '24']"
            show-size-changer
            @change="favoritesStore.setCurrentPage"
            @showSizeChange="(_, size: number) => favoritesStore.setPageSize(size)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.favorites {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  color: var(--text-primary);
  padding: 0 0 4rem 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    width: 100%;
    max-width: 1800px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;

    @include mediaDesktopS {
      padding: 0 3rem;
    }
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
    display: grid;
    gap: 2rem;
    margin: 2rem 0;
    width: 100%;
    max-width: 1400px;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));

    @include mediaTablet {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    }

    @include mediaDesktopXS {
      grid-template-columns: repeat(auto-fill, minmax(360px, 420px));
      justify-content: center;
    }

    @media (max-width: 500px) {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }

  &__card {
    background: var(--bg-primary);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
    box-shadow: var(--shadow);

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
