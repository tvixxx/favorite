<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs, { type Dayjs } from "dayjs";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import FiltersSheet from "@/components/MoviesFiltersPanel/FiltersSheet.vue";
import FiltersActiveTags, {
  type FilterTag,
} from "@/components/MoviesFiltersPanel/FiltersActiveTags.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import PeriodChips from "@/components/Filters/PeriodChips.vue";
import { useMoviesStore } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";
import {
  type Genre,
  GenreLabels,
} from "@/components/Genres/constants/genres.constants";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";

const props = defineProps<{
  lockedActorIds?: string[];
  /** Сколько тайтлов сейчас показано — число в кнопке «Показать» */
  resultCount?: number;
}>();

const moviesStore = useMoviesStore();

const searchValue = ref("");
const selectedGenres = ref<Genre[]>([]);
const selectedCountries = ref<string[]>([]);
const publishDateRange = ref<[Dayjs, Dayjs] | null>(null);
const isDrawerOpen = ref(false);

const advancedCount = computed(() => {
  let n = 0;
  if (selectedGenres.value.length) n += 1;
  if (selectedCountries.value.length) n += 1;
  if (publishDateRange.value) n += 1;

  return n;
});

const countryLabel = (code: string): string =>
  PRODUCTION_COUNTRIES.find((c) => c.code === code)?.label ?? code;

const activeTags = computed<FilterTag[]>(() => {
  const tags: FilterTag[] = selectedGenres.value.map((genre) => ({
    key: `genre:${genre}`,
    label: GenreLabels[genre],
  }));

  selectedCountries.value.forEach((code) => {
    tags.push({ key: `country:${code}`, label: countryLabel(code) });
  });

  const [from, to] = publishDateRange.value ?? [];

  if (from && to) {
    tags.push({
      key: "date",
      label: `${dayjs(from).format("MM.YYYY")} — ${dayjs(to).format("MM.YYYY")}`,
    });
  }

  return tags;
});

const removeTag = (key: string): void => {
  const [type, value] = key.split(":");

  if (type === "genre") {
    selectedGenres.value = selectedGenres.value.filter((g) => g !== value);
  } else if (type === "country") {
    selectedCountries.value = selectedCountries.value.filter(
      (c) => c !== value,
    );
  } else if (type === "date") {
    publishDateRange.value = null;
  }
};

const buildFilters = (): MoviesFilters => {
  const filters: MoviesFilters = {
    genres: selectedGenres.value.length ? selectedGenres.value : undefined,
    countryCodes: selectedCountries.value.length
      ? selectedCountries.value
      : undefined,
    publishDateFrom: publishDateRange.value?.[0]
      ? dayjs(publishDateRange.value[0]).startOf("month").toISOString()
      : undefined,
    publishDateTo: publishDateRange.value?.[1]
      ? dayjs(publishDateRange.value[1]).endOf("month").toISOString()
      : undefined,
  };

  return props.lockedActorIds?.length
    ? { ...filters, actorIds: props.lockedActorIds }
    : filters;
};

const runFetch = (): void => {
  const q = moviesStore.searchQuery.trim();

  if (q) {
    void moviesStore.findMovie(q);
  } else {
    void moviesStore.fetchMovies();
  }
};

const applyFilters = (): void => {
  moviesStore.setFilters(buildFilters());
  moviesStore.setCurrentPage(1);
  runFetch();
};

const resetAdvanced = (): void => {
  selectedGenres.value = [];
  selectedCountries.value = [];
  publishDateRange.value = null;
};

watch([selectedGenres, selectedCountries, publishDateRange], applyFilters, {
  deep: true,
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;

const triggerSearch = (): void => {
  const q = searchValue.value.trim();
  moviesStore.setCurrentPage(1);

  if (q) {
    void moviesStore.findMovie(q);
  } else {
    moviesStore.clearSearch();
    void moviesStore.fetchMovies();
  }
};

const onSearchInput = (): void => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(triggerSearch, 350);
};

const onSearchEnter = (): void => {
  clearTimeout(searchTimer);
  triggerSearch();
};
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
          placeholder="Название, ключевое слово, жанр, год…"
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
      flex: 0 1 460px;
      min-width: 240px;
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
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
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

    // На мобильной иконке бейдж синий и вынесен в угол (эталон)
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
