<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import CatalogMoviePreviewModal from "@/components/Catalog/CatalogMoviePreviewModal.vue";
import LeaderboardMoviesFiltersBar from "@/components/Leaderboard/LeaderboardMoviesFiltersBar.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { useLeaderboardMoviesStore } from "@/stores";
import { formatDate } from "@/utils";

const store = useLeaderboardMoviesStore();
const { items, total, isLoading, isError, currentPage } = storeToRefs(store);

const previewOpen = ref(false);
const previewMovieId = ref<string | null>(null);

function openPreview(movieId: string) {
  previewMovieId.value = movieId;
  previewOpen.value = true;
}

watch(previewOpen, (open) => {
  if (!open) {
    previewMovieId.value = null;
  }
});

const formatAvg = (avg: number | null, ratingsCount: number): string => {
  if (ratingsCount === 0 || avg === null) {
    return "—";
  }

  return avg.toFixed(1);
};

onMounted(() => {
  void store.fetchTopMovies();
});
</script>

<template>
  <div class="leaderboard-movies-page">
    <div class="leaderboard-movies-page__content">
      <AppBackButton
        class="leaderboard-movies-page__back"
        :fallback="{ path: '/profile' }"
      />
      <LeaderboardMoviesFiltersBar />

      <ListError
        v-if="isError"
        :is-error="isError"
        :repeat-fn="() => void store.fetchTopMovies()"
        repeat-text="Повторить"
      />

      <div
        v-else-if="isLoading && !items.length"
        class="leaderboard-movies-page__loading"
      >
        <ListLoading
          size="large"
          loading-text="Загружаем топ..."
          :center="true"
        />
      </div>

      <div
        v-else-if="!isLoading && !items.length"
        class="leaderboard-movies-page__empty"
      >
        <a-empty description="Нет фильмов по выбранным фильтрам" />
      </div>

      <div v-else class="leaderboard-movies-page__results">
        <a-spin
          :spinning="isLoading"
          size="large"
          tip="Обновляем список..."
          class="leaderboard-movies-page__spin"
        >
          <div class="leaderboard-movies-page__grid">
            <div
              v-for="row in items"
              :key="row.movieId"
              class="lb-movie-card"
              role="button"
              tabindex="0"
              :class="{
                'lb-movie-card--gold': row.rank === 1,
                'lb-movie-card--silver': row.rank === 2,
                'lb-movie-card--bronze': row.rank === 3,
              }"
              @click="openPreview(row.movieId)"
              @keydown.enter.prevent="openPreview(row.movieId)"
            >
              <div class="lb-movie-card__rank">#{{ row.rank }}</div>
              <div class="lb-movie-card__poster-wrap">
                <img
                  v-if="row.posterUrl"
                  :src="row.posterUrl"
                  :alt="row.title"
                  class="lb-movie-card__poster"
                  loading="lazy"
                />
                <div
                  v-else
                  class="lb-movie-card__poster lb-movie-card__poster--empty"
                >
                  Нет постера
                </div>
              </div>
              <h3 class="lb-movie-card__title">{{ row.title }}</h3>
              <p v-if="row.isSerial" class="lb-movie-card__badge">Сериал</p>
              <p v-if="row.publishDate" class="lb-movie-card__meta">
                {{ formatDate(row.publishDate) }}
              </p>
              <div class="lb-movie-card__stats">
                <span class="lb-movie-card__avg">
                  Средняя:
                  <strong>{{
                    formatAvg(row.avgPersonalRate, row.ratingsCount)
                  }}</strong>
                </span>
                <span class="lb-movie-card__count">
                  Оценок: {{ row.ratingsCount }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="total > store.pageSize"
            class="leaderboard-movies-page__pagination"
          >
            <a-pagination
              :current="currentPage"
              :page-size="store.pageSize"
              :total="total"
              show-less-items
              @change="(p: number) => void store.setPage(p)"
            />
          </div>
        </a-spin>
      </div>
    </div>

    <CatalogMoviePreviewModal
      v-model="previewOpen"
      :movie-id="previewMovieId"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;

.leaderboard-movies-page {
  width: 100%;

  &__content {
    @include pageContentContainer;
  }

  &__back {
    align-self: flex-start;
    :deep(.app-back-btn) {
      margin: 0 0 1rem 0;
    }
  }

  &__loading,
  &__empty {
    min-height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &__results {
    width: 100%;
    max-width: var(--grid-max-width);
  }

  &__spin {
    width: 100%;

    :deep(.ant-spin-container) {
      min-height: 200px;
    }

    :deep(.ant-spin-blur) {
      opacity: 0.65;
    }
  }

  &__grid {
    display: grid;
    width: 100%;
    max-width: var(--grid-max-width);
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    margin-bottom: 2rem;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    padding: 2rem 0 1rem;
  }
}

.lb-movie-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  box-shadow: var(--shadow-card);
  border: 1px solid color-mix(in srgb, var(--border-color) 55%, transparent);
  padding: 1rem 1rem 1.25rem;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;

  &:focus-visible {
    outline: 2px solid var(--ant-color-primary);
    outline-offset: 2px;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-elevated);
  }

  &--gold {
    border-color: color-mix(in srgb, #eab308 55%, var(--border-color));
  }

  &--silver {
    border-color: color-mix(in srgb, #94a3b8 55%, var(--border-color));
  }

  &--bronze {
    border-color: color-mix(in srgb, #d97706 45%, var(--border-color));
  }

  &__rank {
    font-weight: 800;
    font-size: 0.9rem;
    color: var(--ant-color-primary);
    margin-bottom: 0.5rem;
  }

  &__poster-wrap {
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: 0.75rem;
    aspect-ratio: 2 / 3;
    background: var(--bg-secondary);
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      color: var(--text-secondary);
      padding: 1rem;
      text-align: center;
    }
  }

  &__title {
    margin: 0 0 0.35rem;
    font-size: 1.1rem;
    font-weight: 800;
    line-height: 1.25;
    color: var(--text-primary);
  }

  &__badge {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ant-color-primary);
  }

  &__meta {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  &__stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: auto;
  }

  &__avg strong {
    color: var(--text-primary);
  }
}
</style>
