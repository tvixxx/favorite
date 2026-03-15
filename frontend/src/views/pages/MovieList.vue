<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { type Movie, useMoviesStore } from "@/stores/movies/moviesStore";
import { useMainStore } from "@/state/state";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useFavoritesStore } from "@/stores/favorites/favoritesStore";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { formatDate, formatYear } from "@/utils";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import type { MoviesFilters } from "@/stores";
import MoviesFiltersPanel from "@/components/MoviesFiltersPanel/MoviesFiltersPanel.vue";

const router = useRouter();
const moviesStore = useMoviesStore();
const mainStore = useMainStore();
const favoritesStore = useFavoritesStore();

const imageErrors = ref<Set<number>>(new Set());

const hasMovies = computed(() => moviesStore.currentMoviesList.length !== 0);
const totalMovies = computed(() => moviesStore.currentMoviesList.length);
const shouldFetchMovies = computed(
  () => !hasMovies.value && mainStore.isLoggedIn
);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    totalMovies.value > 0 &&
    !moviesStore.isMoviesError &&
    !moviesStore.isMoviesLoading
);

const emptyMoviesDescription = computed(() => {
  if (
    moviesStore.hasActiveFilters &&
    moviesStore.currentMoviesList.length === 0
  ) {
    return "Фильмы не найдены";
  }

  return "Фильмов пока нет...";
});

const getPosterSrc = (item: Movie) => {
  return imageErrors.value.has(item.id)
    ? FALLBACK_IMAGE_URL
    : item.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: number) => {
  imageErrors.value.add(movieId);
};

const removeMovie = async ({ title, id }: Movie) => {
  try {
    await moviesStore.removeMovie(id);
    message.success(`${title} удален`);
  } catch {
    message.error(`Не удалось удалить: ${title}`);
  }
};

const addToFavorite = async (item: Movie) => {
  try {
    await favoritesStore.addToFavorite(item);
    message.success(`${item.title} добавлен в избранное`);
  } catch {
    message.error(`Не удалось добавить в избранное: ${item.title}`);
  }
};

const removeFromFavorite = async (item: Movie) => {
  try {
    await favoritesStore.removeFromFavorite(item);
    message.success(`${item.title} удален из избранного`);
  } catch {
    message.error(`Не удалось удалить из избранного: ${item.title}`);
  }
};

const toggleSeeLater = async (item: Movie) => {
  const newValue = !item.seeLater;

  try {
    await moviesStore.patchMovie(item.id, { seeLater: newValue });

    if (moviesStore.filters.seeLater && !newValue) {
      moviesStore.searchResults = moviesStore.searchResults.filter(
        (movie) => movie.id !== item.id
      );
    }

    message.success(
      newValue
        ? `${item.title} добавлен в «Смотреть позже»`
        : `${item.title} убран из «Смотреть позже»`
    );
  } catch {
    message.error("Не удалось обновить статус");
  }
};

const goToMovie = ({ id }: Movie) => {
  router.push(`/detail/${id}`);
};

const handleFiltersUpdate = async (filters: MoviesFilters) => {
  moviesStore.setFilters(filters);

  try {
    await moviesStore.findMovie(moviesStore.searchQuery);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

const findMovie = async (value: string) => {
  try {
    await moviesStore.findMovie(value);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

onMounted(async () => {
  if (shouldFetchMovies.value) {
    try {
      await moviesStore.fetchMovies();
    } catch {
      message.error(ERROR_FETCH_MOVIES_TEXT);
    }
  }
});

watch(
  () => moviesStore.searchQuery,
  () => {
    moviesStore.setCurrentPage(1);
  }
);
</script>

<template>
  <div class="movie-list">
    <HeroHeader
      :badge-count="totalMovies"
      badge-text="Фильмотека"
      icon-name="mdi:filmstrip"
      subtitle="Все хиты и новинки которые вы смотрели"
      title="Кинотеатр у вас дома"
    />

    <div class="movie-list__content">
      <MoviesFiltersPanel
        :search-handler="findMovie"
        @update:filters="handleFiltersUpdate"
      />
      <ListError
        v-if="moviesStore.isMoviesError"
        :is-error="moviesStore.isMoviesError"
        :repeat-fn="moviesStore.fetchMovies"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="moviesStore.isMoviesLoading"
        :center="true"
        loading-text="Загружаем фильмы..."
        size="large"
      />

      <div v-else-if="!totalMovies" class="movie-list__empty-state">
        <a-empty :description="emptyMoviesDescription" />
      </div>

      <div v-else class="movie-list__grid">
        <div
          v-for="item in moviesStore.paginatedMovies"
          :key="item.id"
          class="movie-card"
          @click="goToMovie(item)"
        >
          <div class="movie-card__header">
            <img
              :alt="`${item.title} постер`"
              :src="getPosterSrc(item)"
              class="movie-card__poster"
              loading="lazy"
              @error="handleImageError(item.id)"
            />
            <div class="movie-card__favorite">
              <BaseIcon
                :height="22"
                :name="item.isFavorite ? 'mdi:heart' : 'mdi:heart-outline'"
                :width="22"
                @click.stop="
                  () =>
                    item.isFavorite
                      ? removeFromFavorite(item)
                      : addToFavorite(item)
                "
              />
            </div>
          </div>

          <div class="movie-card__content">
            <div class="movie-card__rating">{{ item.rate }}/10</div>

            <button
              class="movie-card__delete"
              @click.stop="() => removeMovie(item)"
            >
              <BaseIcon :height="18" :width="18" name="pajamas:remove" />
            </button>

            <h3 class="movie-card__title">
              {{ item.title }} <span v-if="item.isSerial">(сериал)</span>
            </h3>

            <div class="movie-card__meta">
              <div class="movie-card__meta-item">
                <BaseIcon class="movie-card__meta-icon" name="mdi:eye" />
                <span class="movie-card__meta-item-text">
                  Дата просмотра: {{ formatDate(item.date) }}
                </span>
              </div>
              <div class="movie-card__meta-item">
                <BaseIcon class="movie-card__meta-icon" name="mdi:filmstrip" />
                <span class="movie-card__meta-item-text"
                  >Дата выхода: {{ formatYear(item.publishDate) }}</span
                >
              </div>
            </div>

            <div class="movie-card__see-later" @click.stop>
              <a-switch
                :checked="item.seeLater"
                size="small"
                @change="() => toggleSeeLater(item)"
              />
              <span class="movie-card__see-later-label">Смотреть позже</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showPaginator && totalMovies > moviesStore.pageSize"
        class="movie-list__pagination"
      >
        <a-pagination
          v-model:current="moviesStore.currentPage"
          :page-size="moviesStore.pageSize"
          :page-size-options="['6', '12', '18', '24']"
          :total="totalMovies"
          show-size-changer
          @change="moviesStore.setCurrentPage"
          @showSizeChange="(_, size: number) => moviesStore.setPageSize(size)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.movie-list {
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

    .ant-empty {
      max-width: 400px;
    }

    .ant-empty-description {
      margin-top: 1rem;
      font-size: 1.1rem;
    }
  }
}

.movie-list__grid {
  display: grid;
  gap: 2.5rem;
  margin: 2rem 0;
  justify-content: center;
  max-width: 1800px;

  @media (min-width: 1900px) {
    grid-template-columns: repeat(4, 430px);
  }
  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, 380px);
  }
  @media (min-width: 1200px) and (max-width: 1680px) {
    grid-template-columns: repeat(3, minmax(380px, 430px));
  }
  @media (min-width: 900px) and (max-width: 1199px) {
    grid-template-columns: repeat(2, 430px);
  }
  @media (max-width: 899px) {
    grid-template-columns: minmax(350px, 430px);
    gap: 2rem;
  }
  @media (max-width: 500px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

.movie-card {
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
    border-color: color-mix(in srgb, var(--ant-color-primary) 40%, transparent);

    &::before {
      opacity: 1;
    }

    .movie-card__poster {
      transform: scale(1.05);
    }
  }

  &__header {
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

  &__favorite {
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
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.1);
      background: white;
    }

    svg {
      width: 20px;
      height: 20px;
      color: var(--ant-color-primary);
    }
  }

  &__content {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  &__rating {
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

  &__delete {
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

    .movie-card:hover & {
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

  &__title {
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

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
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

  &__meta-item-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__see-later {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }

  &__see-later-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }
}
</style>
