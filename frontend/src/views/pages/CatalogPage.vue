<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import CatalogFiltersBar from "@/components/MoviesFiltersPanel/CatalogFiltersBar.vue";
import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import CatalogMoviePreviewModal from "@/components/Catalog/CatalogMoviePreviewModal.vue";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import { formatAverageRating, formatYear } from "@/utils";
import { useMoviesStore } from "@/stores";
import type { Movie } from "@/stores/movies/types";

const props = defineProps<{
  actorId?: string;
}>();

const router = useRouter();
const moviesStore = useMoviesStore();

function applyActorFilter(): void {
  if (props.actorId) {
    moviesStore.setFilters({
      ...moviesStore.filters,
      actorIds: [props.actorId],
    });
  } else {
    const next = { ...moviesStore.filters };
    delete next.actorIds;
    moviesStore.setFilters(next);
  }
}

const imageErrors = ref<Set<string>>(new Set());

const previewOpen = ref(false);
const previewMovieId = ref<string | null>(null);

const totalMovies = computed(() => moviesStore.currentMoviesList.length);
const hasMovies = computed(() => totalMovies.value !== 0);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    totalMovies.value > 0 &&
    !moviesStore.isMoviesError &&
    !moviesStore.isMoviesLoading
);
const emptyDescription = computed(() => {
  if (
    moviesStore.hasActiveFilters &&
    moviesStore.currentMoviesList.length === 0
  ) {
    return "Ничего не найдено — попробуйте изменить фильтры";
  }

  if (props.actorId && moviesStore.currentMoviesList.length === 0) {
    return "В каталоге пока нет фильмов с этим актёром";
  }

  return "В каталоге пока нет фильмов";
});

const getPosterSrc = (item: Movie) => {
  return imageErrors.value.has(item.id)
    ? FALLBACK_IMAGE_URL
    : item.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

const ratingLabel = (m: Movie) => formatAverageRating(m.averageRating);

function openPreview(movieId: string) {
  if (props.actorId) {
    void router.push({
      path: `/detail/${movieId}`,
      query: { libActor: props.actorId },
    });

    return;
  }

  previewMovieId.value = movieId;
  previewOpen.value = true;
}

watch(previewOpen, (open) => {
  if (!open) {
    previewMovieId.value = null;
  }
});

watch(
  () => moviesStore.searchQuery,
  () => {
    moviesStore.setCurrentPage(1);
  }
);

watch(
  () => props.actorId,
  async () => {
    applyActorFilter();
    moviesStore.setCurrentPage(1);
    try {
      await moviesStore.fetchMovies();
    } catch {
      message.error(ERROR_FETCH_MOVIES_TEXT);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (props.actorId) {
    const next = { ...moviesStore.filters };
    delete next.actorIds;
    moviesStore.setFilters(next);
  }
});

const repeatFetch = () => moviesStore.fetchMovies();
</script>

<template>
  <div class="catalog-page">
    <div class="catalog-page__content">
      <div v-if="actorId" class="catalog-page__back-wrap">
        <AppBackButton
          label="К списку актёров"
          mode="replace"
          :fallback="{ path: '/library/actors' }"
        />
      </div>
      <CatalogFiltersBar
        :locked-actor-ids="actorId ? [actorId] : undefined"
      />

      <ListError
        v-if="moviesStore.isMoviesError"
        :is-error="moviesStore.isMoviesError"
        :repeat-fn="repeatFetch"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="moviesStore.isMoviesLoading"
        :center="true"
        loading-text="Загружаем каталог…"
        size="large"
      />

      <div v-else-if="!hasMovies" class="catalog-page__empty-state">
        <a-empty :description="emptyDescription" />
      </div>

      <div v-else class="catalog-page__grid">
        <div
          v-for="item in moviesStore.paginatedMovies"
          :key="item.id"
          class="catalog-card"
          role="button"
          tabindex="0"
          @click="openPreview(item.id)"
          @keydown.enter.prevent="openPreview(item.id)"
        >
          <div class="catalog-card__header">
            <img
              :alt="`${item.title} постер`"
              :src="getPosterSrc(item)"
              class="catalog-card__poster"
              loading="lazy"
              @error="handleImageError(item.id)"
            />
          </div>

          <div class="catalog-card__body">
            <div class="catalog-card__rating-row">
              <span
                class="catalog-card__rating"
                :class="{ 'catalog-card__rating_muted': !ratingLabel(item) }"
              >
                <template v-if="ratingLabel(item)">
                  {{ ratingLabel(item) }}
                  <span class="catalog-card__rating-max">/10</span>
                </template>
                <template v-else>—</template>
              </span>
              <span class="catalog-card__rating-hint">средний балл</span>
            </div>

            <h3 class="catalog-card__title">
              {{ item.title }}
              <span v-if="item.isSerial" class="catalog-card__serial"
                >(сериал)</span
              >
            </h3>

            <div class="catalog-card__meta">
              <div v-if="item.publishDate" class="catalog-card__meta-item">
                <BaseIcon
                  class="catalog-card__meta-icon"
                  name="mdi:filmstrip"
                />
                <span>{{ formatYear(item.publishDate) }}</span>
              </div>
            </div>

            <div class="catalog-card__share" @click.stop>
              <MovieShareButton
                :movie-id="item.id"
                :movie-title="item.title"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showPaginator && totalMovies > moviesStore.pageSize"
        class="catalog-page__pagination"
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

    <CatalogMoviePreviewModal
      v-if="!actorId"
      v-model="previewOpen"
      :movie-id="previewMovieId"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/card" as *;
@use "@/styles/antd-overrides" as *;

.catalog-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    @include pageContentContainer;
  }

  &__back-wrap {
    align-self: stretch;
    width: 100%;
    max-width: var(--page-max-width);

    :deep(.app-back-btn) {
      margin: 0 0 0.75rem;
    }
  }

  &__grid {
    @include cardsGrid;
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

    @include antEmptyTypography;
  }
}

.catalog-card {
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

  &:hover::before {
    opacity: 1;
  }

  &__header {
    position: relative;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    overflow: hidden;
    aspect-ratio: 2 / 3;
    background: var(--bg-secondary);
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
    transition: transform 0.35s ease;
  }

  &:hover &__poster {
    transform: scale(1.03);
  }

  &__body {
    padding: 1rem 1.1rem 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__rating-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__rating {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.02em;

    &_muted {
      font-weight: 700;
      color: var(--text-secondary);
    }
  }

  &__rating-max {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__rating-hint {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: lowercase;
    opacity: 0.85;
  }

  &__title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--text-primary);
  }

  &__serial {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.9em;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  &__meta-icon {
    flex-shrink: 0;
    opacity: 0.75;
    color: var(--ant-color-primary);
  }

  &__share {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    padding-top: 0.35rem;
  }
}
</style>
