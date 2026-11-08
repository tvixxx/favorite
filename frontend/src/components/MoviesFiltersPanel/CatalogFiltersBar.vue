<script setup lang="ts">
import { ref } from "vue";
import { useDebouncedSearch } from "@/composable/useDebouncedSearch";
import { clearedCatalogFacets, useCatalogFacets } from "@/composable/useCatalogFacets";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import FiltersSheet from "@/components/MoviesFiltersPanel/FiltersSheet.vue";
import FiltersActiveTags from "@/components/MoviesFiltersPanel/FiltersActiveTags.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import PeriodChips from "@/components/Filters/PeriodChips.vue";
import { useMoviesStore } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";
import ContentKindFilter from "@/components/ContentType/ContentKindFilter.vue";

const props = defineProps<{
  lockedActorIds?: string[];
  /** Сколько произведений сейчас показано — число в кнопке «Показать» */
  resultCount?: number;
}>();

const moviesStore = useMoviesStore();

const {
  selectedGenres,
  selectedCountries,
  publishDateRange,
  tags: activeTags,
  count: advancedCount,
  removeTag,
} = useCatalogFacets(() => moviesStore.filters, updateFilters);
const isDrawerOpen = ref(false);

const runFetch = (): void => {
  void moviesStore.fetchMovies(moviesStore.searchQuery).catch(() => {
    // Ошибка уже отражена в состоянии каталога с кнопкой повторной загрузки.
  });
};

function updateFilters(patch: MoviesFilters): void {
  moviesStore.setFilters({
    ...moviesStore.filters,
    ...patch,
    ...(props.lockedActorIds?.length ? { actorIds: props.lockedActorIds } : {}),
  });

  moviesStore.setCurrentPage(1);
  runFetch();
}

const resetAdvanced = (): void => updateFilters(clearedCatalogFacets);

const triggerSearch = (q: string): void => {
  moviesStore.setCurrentPage(1);

  if (q) {
    void moviesStore.findMovie(q).catch(() => {});
  } else {
    moviesStore.clearSearch();
    runFetch();
  }
};

const { searchValue, onSearchInput, onSearchEnter } = useDebouncedSearch(
  () => moviesStore.searchQuery,
  triggerSearch
);
</script>

<template>
  <div class="catalog-filters" data-tour="catalog-filters">
    <div class="catalog-filters__row">
      <label class="catalog-filters__search">
        <BaseIcon
          name="ph:magnifying-glass"
          :width="20"
          :height="20"
          class="catalog-filters__search-icon"
        />
        <input
          v-model="searchValue"
          type="text"
          aria-label="Поиск в каталоге"
          placeholder="Название фильма или сериала"
          @input="onSearchInput"
          @keydown.enter="onSearchEnter"
        />
      </label>

      <button
        type="button"
        class="catalog-filters__toggle"
        :class="{ 'catalog-filters__toggle--active': advancedCount > 0 }"
        aria-label="Фильтры"
        @click="isDrawerOpen = true"
      >
        <BaseIcon name="ph:sliders-horizontal" :width="19" :height="19" />
        <span class="catalog-filters__toggle-text">Фильтры</span>
        <span v-if="advancedCount" class="catalog-filters__badge">{{
          advancedCount
        }}</span>
      </button>
    </div>

    <FiltersActiveTags
      :tags="activeTags"
      @remove="removeTag"
      @reset="resetAdvanced"
    />

    <FiltersSheet
      v-model="isDrawerOpen"
      :active-count="advancedCount"
      :result-count="resultCount"
      @reset="resetAdvanced"
    >
      <GenreFilter v-model="selectedGenres" />
      <ContentKindFilter
        :content-kind="moviesStore.filters.contentKind"
        :is-serial="moviesStore.filters.isSerial"
        show-format
        @change="updateFilters"
      />
      <CountryFilter v-model="selectedCountries" />
      <PeriodChips v-model="publishDateRange" />
    </FiltersSheet>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.catalog-filters {
  margin-top: 16px;
  width: 100%;

  &__row {
    // До планшета: поиск и кнопка-иконка в одной строке
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;

    @include mediaTablet {
      flex-direction: row;
      align-items: center;
      // поиск слева · «Фильтры» справа
      justify-content: space-between;
      gap: 12px;
    }
  }

  &__search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 16px;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-primary);
    border: 1.5px solid transparent;
    transition: border-color var(--fv-motion-fast) var(--fv-ease);

    @include mediaTablet {
      flex: 0 1 420px;
      min-width: 220px;
    }

    &:focus-within {
      border-color: var(--fv-color-accent);
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      outline: none;
      font: inherit;
      font-size: 1rem;
      color: var(--fv-color-text-primary);
    }
  }

  &__search-icon {
    flex-shrink: 0;
    color: var(--fv-color-text-tertiary);
  }

  // Плашка 44px как в эталоне, но белая: канва страницы — mist, и mist-кнопка
  // на ней пропадала. Применённые фильтры — синяя подложка с рамкой
  &__toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: var(--fv-color-bg-secondary);
    }

    &--active {
      background: var(--fv-color-bg-active-soft);
      color: var(--fv-color-link);
      box-shadow: inset 0 0 0 1.5px var(--fv-color-accent);
    }

    // Эталон мобилки: иконка 46×46 в синей подложке справа от поиска
    @include mediaMax(767.98px) {
      width: 46px;
      height: 46px;
      padding: 0;
      border-radius: 14px;
      background: var(--fv-color-bg-active-soft);
      color: var(--fv-color-link);

      &:hover {
        background: var(--fv-color-bg-active-soft);
      }
    }
  }

  &__toggle-text {
    @include mediaMax(767.98px) {
      display: none;
    }
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 12px;
    font-weight: 700;

    @include mediaMax(767.98px) {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0;
      border: 2px solid var(--fv-color-bg-secondary);
      background: var(--fv-color-accent);
      font-size: 11px;
    }
  }
}
</style>
