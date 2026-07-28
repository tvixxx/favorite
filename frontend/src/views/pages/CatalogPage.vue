<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";

import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock, {
  type StateAction,
} from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import CatalogFiltersBar from "@/components/MoviesFiltersPanel/CatalogFiltersBar.vue";
import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import CatalogMoviePreviewModal from "@/components/Catalog/CatalogMoviePreviewModal.vue";
import MovieCard from "@/components/MovieCard/MovieCard.vue";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import { formatAverageRating, movieCardMeta, movieCardTitle } from "@/utils";
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

// Догрузка вместо страниц (спека new-9): порция = pageSize
const restCount = computed(
  () => totalMovies.value - moviesStore.visibleMovies.length,
);

const showMore = (): void => {
  moviesStore.setCurrentPage(moviesStore.currentPage + 1);
};

const hasMovies = computed(() => totalMovies.value !== 0);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    totalMovies.value > 0 &&
    !moviesStore.isMoviesError &&
    !moviesStore.isMoviesLoading
);
const showSkeleton = useMinLoading(() => moviesStore.isMoviesLoading);

const catalogEmptyState = computed(() => {
  const query = moviesStore.searchQuery?.trim();

  if (moviesStore.hasActiveFilters) {
    const resetAction: StateAction = {
      label: "Сбросить фильтры",
      icon: "ph:arrow-counter-clockwise",
      kind: "secondary",
      onClick: () => void resetCatalogFilters(),
    };

    return {
      ...STATE_PRESETS.catalogSearchEmpty,
      description: query
        ? `По запросу «${query}» ничего не найдено. Проверьте написание или измените фильтры.`
        : STATE_PRESETS.catalogSearchEmpty.description,
      actions: [resetAction],
    };
  }

  if (props.actorId) {
    return {
      ...STATE_PRESETS.catalogEmpty,
      title: "Нет фильмов с этим актёром",
      description: "В каталоге пока нет фильмов с выбранным актёром.",
      actions: [] as StateAction[],
    };
  }

  return { ...STATE_PRESETS.catalogEmpty, actions: [] as StateAction[] };
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
  // Полный сброс: локальный UI фильтр-бара при возврате пуст, поэтому и стор
  // должен быть чистым — иначе поиск/фильтры «протекают» на другие страницы
  // и показывают 0 результатов. Актёрский фильтр восстанавливается на mount.
  moviesStore.clearSearch();
  moviesStore.setFilters({});
  moviesStore.setCurrentPage(1);
});

const repeatFetch = () => moviesStore.fetchMovies();

async function resetCatalogFilters(): Promise<void> {
  moviesStore.clearSearch();

  if (props.actorId) {
    moviesStore.setFilters({ actorIds: [props.actorId] });
  } else {
    moviesStore.setFilters({});
  }

  moviesStore.setCurrentPage(1);

  try {
    await moviesStore.fetchMovies();
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
}
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
        :result-count="totalMovies"
      />

      <StateBlock
        v-if="moviesStore.isMoviesError"
        v-bind="STATE_PRESETS.catalogError"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: repeatFetch,
          },
        ]"
      />

      <PosterGridSkeleton v-else-if="showSkeleton" :count="12" />

      <StateBlock v-else-if="!hasMovies" v-bind="catalogEmptyState" />

      <div v-else class="catalog-page__grid" data-tour="catalog-grid">
        <MovieCard
          v-for="item in moviesStore.visibleMovies"
          :key="item.id"
          :poster-src="getPosterSrc(item)"
          :title="movieCardTitle(item)"
          :meta="movieCardMeta(item)"
          :rate="ratingLabel(item)"
          addable
          @open="openPreview(item.id)"
          @add="openPreview(item.id)"
          @poster-error="handleImageError(item.id)"
        />
      </div>

      <div
        v-if="showPaginator && moviesStore.hasMoreMovies"
        class="catalog-page__more"
      >
        <a-button size="large" @click="showMore">
          Показать ещё
          <span class="catalog-page__more-count">{{ restCount }}</span>
        </a-button>
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
    max-width: var(--fv-layout-max-width);

    :deep(.app-back-btn) {
      margin: 0 0 0.75rem;
    }
  }

  &__grid {
    @include cardsGrid;
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

    @include antEmptyTypography;
  }

  &__empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 1.25rem;
  }
}

</style>
