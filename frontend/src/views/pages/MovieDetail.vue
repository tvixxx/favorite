<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useMainStore } from "@/state/state";
import { MOVIES_ENDPOINTS } from "@/constants";
import { message } from "ant-design-vue";
import api from "@/services/api";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { formatDateTime, formatYear } from "@/utils";
import { useMoviesStore } from "@/stores/movies/moviesStore";

const store = useMainStore();
const moviesStore = useMoviesStore();
const router = useRouter();

const currentMovieId = +router.currentRoute.value.params.id;

onMounted(async () => {
  const shouldLoadMovie = !moviesStore.currentMovie && store.isLoggedIn;

  if (shouldLoadMovie) {
    await getMovieDetail();
  }
});

onBeforeUnmount(() => {
  moviesStore.setCurrentMovie(null);
});

const getMovieDetail = async () => {
  if (!moviesStore.isMoviesLoaded) {
    moviesStore.setLoadingMovie(true);
    moviesStore.setErrorMovie(null);

    try {
      const { data, status } = await api.get(
        `${MOVIES_ENDPOINTS}/${currentMovieId}`
      );

      if (status !== 200) {
        moviesStore.setErrorMovie("Ошибка загрузки фильма");
        message.error(moviesStore.isMovieError);
        return;
      }

      moviesStore.setCurrentMovie(data);
    } catch (err) {
      moviesStore.setErrorMovie("Ошибка загрузки фильма");
      message.error(moviesStore.isMoviesError);
    } finally {
      moviesStore.setLoadingMovie(false);
    }

    return;
  }

  const foundMovie = moviesStore.getMovieById(currentMovieId);

  if (foundMovie) {
    moviesStore.setCurrentMovie(foundMovie);

    return;
  }
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="movie-detail">
    <div class="movie-detail__hero">
      <div class="movie-detail__content">
        <a-button
          @click="goBack"
          type="text"
          class="movie-detail__back-button"
          size="large"
        >
          <BaseIcon name="mdi:arrow-left" :width="24" :height="24" />
          Назад
        </a-button>
      </div>
    </div>

    <div class="movie-detail__content">
      <a-alert
        v-if="moviesStore.isMovieError"
        type="error"
        showIcon
        closable
        class="movie-detail__error"
      ></a-alert>

      <div v-else-if="moviesStore.isMovieLoading" class="movie-detail__loading">
        <a-spin size="large" tip="Загружаем фильм..." />
      </div>

      <div v-else-if="moviesStore.currentMovie" class="movie-card">
        <div class="movie-card__header">
          <div class="movie-card__poster">
            <img
              v-if="moviesStore.currentMovie.poster"
              :src="moviesStore.currentMovie.poster"
              alt="Постер фильма"
              class="movie-card__poster-img"
            />
            <div v-else class="movie-card__no-poster">
              <span class="movie-card__no-poster-text">Нет изображения</span>
            </div>
            <div class="movie-card__rating">
              {{ moviesStore.currentMovie.rate }}/10
            </div>
          </div>
        </div>

        <div class="movie-card__content">
          <h1 class="movie-card__title">
            {{ moviesStore.currentMovie.title }}
          </h1>

          <div class="movie-card__meta">
            <div class="movie-card__meta-item">
              <BaseIcon name="mdi:calendar" class="movie-card__meta-icon" />
              <span class="movie-card__meta-sub-title">Дата просмотра: </span>
              {{ formatDateTime(moviesStore.currentMovie.date) }}
            </div>

            <div
              class="movie-card__meta-item"
              v-if="moviesStore.currentMovie.publishDate"
            >
              <BaseIcon name="mdi:calendar" class="movie-card__meta-icon" />
              <span class="movie-card__meta-sub-title">Дата выхода: </span>
              {{ formatYear(moviesStore.currentMovie.publishDate) }}
            </div>
          </div>

          <p class="movie-card__description">
            {{ moviesStore.currentMovie.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.movie-detail {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  padding: 0 0 4rem 0;
  color: var(--text-primary);

  &__hero {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--ant-color-primary) 80%, transparent) 0%,
      transparent 100%
    );
    padding: 2rem 0;
  }

  &__content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  &__back-button {
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--text-primary);
    border-color: transparent;

    &:hover {
      background: transparent;
      color: var(--ant-color-primary);
    }
  }

  &__error,
  &__loading {
    max-width: 600px;
    margin: 300px auto;
  }
}

.movie-card {
  --card-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);

  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: var(--card-shadow);
  overflow: hidden;
  transition: all 0.3s ease;
  will-change: box-shadow;

  &:hover {
    --card-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  &__header {
    position: relative;
  }

  &__poster {
    position: relative;
    width: 100%;
    height: 400px;
    overflow: hidden;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        45deg,
        transparent 0%,
        rgba(0, 0, 0, 0.4) 100%
      );
      z-index: 1;
    }
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;

    &:hover {
      transform: scale(1.05);
    }
  }

  &__no-poster {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  &__rating {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: var(--ant-color-primary);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2;
  }

  &__content {
    padding: 2.5rem;
  }

  &__title {
    font-size: clamp(1.8rem, 5vw, 2.5rem);
    font-weight: 800;
    margin: 0 0 1rem 0;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
    opacity: 0.9;
  }

  &__meta-item {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__meta-sub-title {
    font-weight: 500;
    margin-right: 4px;
  }

  &__meta-icon {
    margin-right: 0.5rem;
    color: var(--ant-color-primary);
  }

  &__description {
    font-size: 1.1rem;
    line-height: 1.7;
    color: var(--text-secondary);
  }
}
</style>
