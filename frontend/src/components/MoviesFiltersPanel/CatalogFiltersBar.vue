<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs, { type Dayjs } from "dayjs";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import DateRangeFilter from "@/components/Filters/DateRangeFilter.vue";
import { useMoviesStore } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";
import { type Genre } from "@/components/Genres/constants/genres.constants";

const props = defineProps<{
  lockedActorIds?: string[];
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
        @click="isDrawerOpen = true"
      >
        <BaseIcon name="ph:sliders-horizontal" :width="18" :height="18" />
        <span class="catalog-filters__toggle-text">Фильтры</span>
        <span v-if="advancedCount" class="catalog-filters__badge">{{
          advancedCount
        }}</span>
      </button>
    </div>

    <a-drawer
      v-model:open="isDrawerOpen"
      title="Фильтры"
      placement="right"
      :width="380"
    >
      <div class="catalog-filters__advanced">
        <GenreFilter v-model="selectedGenres" />
        <CountryFilter v-model="selectedCountries" />
        <DateRangeFilter
          v-model="publishDateRange"
          label="Дата выхода"
          :placeholder="['От', 'До']"
        />
      </div>

      <template #footer>
        <div class="catalog-filters__drawer-footer">
          <a-button :disabled="advancedCount === 0" @click="resetAdvanced">
            Сбросить
          </a-button>
          <a-button type="primary" @click="isDrawerOpen = false">Готово</a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.catalog-filters {
  margin-top: 16px;
  width: 100%;

  &__row {
    display: flex;
    flex-direction: column;
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
    transition: border-color 0.15s ease;

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

  // Эталон: «Фильтры» — plain иконка + жирный текст, без рамки/фона
  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease;

    &:hover {
      color: var(--fv-color-accent);
    }

    &--active {
      color: var(--fv-color-accent);
    }
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 600;
  }

  &__advanced {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  &__drawer-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
