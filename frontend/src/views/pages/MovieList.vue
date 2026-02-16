<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { formatDate, formatYear } from "@/utils";
import { type Movie, useMoviesStore } from "@/stores/movies/moviesStore";
import { useMainStore } from "@/state/state";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { useFavoritesStore } from "@/stores/favorites/favoritesStore";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/ListError/ListError.vue";
import ListLoading from "@/components/ListLoading/ListLoading.vue";

const router = useRouter();
const moviesStore = useMoviesStore();
const mainStore = useMainStore();
const favoritesStore = useFavoritesStore();

const imageErrors = ref<Set<number>>(new Set());

const hasMovies = computed(() => moviesStore.moviesList.length !== 0);
const totalMovies = computed(() => moviesStore.moviesList.length);
const shouldFetchMovies = computed(
  () => !hasMovies.value && mainStore.isLoggedIn
);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    !moviesStore.isMovieError &&
    !moviesStore.isMoviesLoading
);
const getPosterSrc = (item: Movie) => {
  return imageErrors.value.has(item.id)
    ? FALLBACK_IMAGE_URL
    : item.imageUrl || FALLBACK_IMAGE_URL;
};

onMounted(async () => {
  if (shouldFetchMovies.value) {
    await moviesStore.fetchMovies();
  }
});

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

const goToMovie = ({ id }: Movie) => {
  router.push(`/detail/${id}`);
};
</script>

<template>
  <div class="movie-list">
    <HeroHeader
      title="Кинотеатр у вас дома"
      subtitle="Все хиты и новинки которые вы смотрели"
      badge-text="Фильмотека"
      icon-name="mdi:filmstrip"
      :badge-count="totalMovies"
    />

    <div class="movie-list__content">
      <ListError
        v-if="moviesStore.isMoviesError"
        :is-error="moviesStore.isMoviesError"
        :repeat-fn="moviesStore.fetchMovies"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="moviesStore.isMoviesLoading"
        size="large"
        loading-text="Загружаем фильмы..."
        :center="true"
      />

      <div v-else-if="!totalMovies" class="movie-list__empty-state">
        <a-empty description="Фильмов пока нет..." />
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
              :src="getPosterSrc(item)"
              :alt="`${item.title} постер`"
              class="movie-card__poster"
              loading="lazy"
              @error="handleImageError(item.id)"
            />
            <div class="movie-card__favorite">
              <BaseIcon
                :name="item.favorite ? 'mdi:heart' : 'mdi:heart-outline'"
                :width="22"
                :height="22"
              />
            </div>
          </div>

          <div class="movie-card__content">
            <div class="movie-card__rating">{{ item.rate }}/10</div>

            <button
              class="movie-card__delete"
              @click.stop="() => removeMovie(item)"
            >
              <BaseIcon name="pajamas:remove" :width="18" :height="18" />
            </button>

            <h3 class="movie-card__title">{{ item.title }}</h3>

            <div class="movie-card__meta">
              <div class="movie-card__meta-item">
                <BaseIcon name="mdi:calendar" class="movie-card__meta-icon" />
                {{ formatDate(item.date) }}
              </div>
              <div class="movie-card__meta-item">
                {{ formatYear(item.publishDate) }}
              </div>
            </div>

            <div class="movie-card__meta movie-card__meta_favorite">
              <a-button
                v-if="!item.favorite"
                class="movie-card__favorite-btn"
                type="primary"
                size="large"
                @click.stop="() => addToFavorite(item)"
              >
                В избранное
                <BaseIcon name="mdi:favorite" class="movie-card__meta-icon" />
              </a-button>

              <a-button
                v-else
                class="movie-card__favorite-btn"
                type="primary"
                size="large"
                @click.stop="() => removeFromFavorite(item)"
              >
                Из избранного
                <BaseIcon name="mdi:trash" class="movie-card__meta-icon" />
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <div class="movie-list__pagination" v-if="showPaginator">
        <a-pagination
          v-model:current="moviesStore.currentPage"
          :total="totalMovies"
          :page-size="moviesStore.pageSize"
          :page-size-options="['6', '12', '18', '24']"
          show-size-changer
          @change="moviesStore.setCurrentPage"
          @showSizeChange="(_, size: number) => moviesStore.setPageSize(size)"
        />
      </div>
    </div>
  </div>
</template>

✅ ПОЛНЫЕ BEM STYLES MovieList.vue (100% как FavoritesPage): text
<style scoped lang="scss">
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
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1rem;
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
    padding: 0 1rem;
  }
}

.movie-card {
  background: var(--bg-primary);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 480px;
  border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
  box-shadow: var(--shadow);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      var(--ant-color-primary),
      color-mix(in srgb, var(--ant-color-primary) 50%, var(--bg-secondary))
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border-color: var(--ant-color-primary);

    &::before {
      opacity: 1;
    }
    .movie-card__poster {
      transform: scale(1.05);
    }
  }
}

.movie-card__header {
  position: relative;
  height: 240px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
}

.movie-card__poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transition: transform 0.4s ease;
}

.movie-card__favorite {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 2;

  svg {
    width: 22px;
    height: 22px;
    color: var(--ant-color-primary);
  }
}

.movie-card__content {
  padding: 1.5rem;
  height: calc(100% - 240px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 100%, transparent) 0%,
    color-mix(in srgb, var(--bg-secondary) 100%, transparent) 100%
  );
  position: relative;
}

.movie-card__rating {
  align-self: flex-end;
  background: var(--ant-color-primary);
  color: white;
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 700;
  box-shadow: 0 4px 16px
    color-mix(in srgb, var(--ant-color-primary) 30%, transparent);
}

.movie-card__delete {
  position: absolute;
  top: 1rem;
  left: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
  border: 2px solid color-mix(in srgb, var(--text-secondary) 70%, transparent);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
  opacity: 0.9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 2;

  @media (min-width: 900px) {
    opacity: 0;
    .movie-card:hover & {
      opacity: 1;
    }
  }

  &:hover {
    background: #ef4444;
    border-color: #dc2626;
    color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.movie-card__title {
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: 700;
  margin: 0;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text-primary);
  flex-grow: 1;
}

.movie-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);

  &--favorite {
    border-top: none;
    padding-top: 0;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
}

.movie-card__meta-icon {
  width: 16px;
  height: 16px;
  color: var(--ant-color-primary);
}

.movie-card__favorite-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;

  .movie-card__meta-icon {
    color: var(--ant-color-secondary);
    margin-left: 0.375rem;
  }
}
</style>
