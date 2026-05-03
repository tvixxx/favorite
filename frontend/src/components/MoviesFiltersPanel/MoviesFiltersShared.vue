<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs, { Dayjs } from "dayjs";

import InputSearch from "@/components/Input/InputSearch/InputSearch.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import DateRangeFilter from "@/components/Filters/DateRangeFilter.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useWindowSize } from "@vueuse/core";
import type { MoviesFilters } from "@/stores/movies/types";
import { Genre } from "@/components/Genres/constants/genres.constants";

const TABLET_WIDTH = 768;

const props = defineProps<{
  searchHandler: (value: string) => Promise<void>;
  extraAdvancedActive?: boolean;
  extraFiltersActive?: boolean;
}>();

const emit = defineEmits<{
  "update:movies-filters": [filters: MoviesFilters];
  "update:search-query": [query: string];
  cleared: [];
}>();

const { width } = useWindowSize();

const searchQuery = ref("");
const selectedGenres = ref<Genre[]>([]);
const selectedCountries = ref<string[]>([]);
const publishDateRange = ref<[Dayjs, Dayjs] | null>(null);
const isExpanded = ref(false);

const isMobile = computed(() => width.value < TABLET_WIDTH);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const buildMoviesFilters = (): MoviesFilters => ({
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
});

const emitMoviesFilters = () => {
  emit("update:movies-filters", buildMoviesFilters());
};

watch(
  [selectedGenres, selectedCountries, publishDateRange],
  emitMoviesFilters,
  { deep: true },
);

const clearFilters = () => {
  searchQuery.value = "";
  selectedGenres.value = [];
  selectedCountries.value = [];
  publishDateRange.value = null;
  emit("cleared");
};

const hasAdvancedFilters = computed(() => !!publishDateRange.value);

const filtersBadgeActive = computed(
  () => hasAdvancedFilters.value || !!props.extraAdvancedActive,
);

const hasAnyFilters = computed(
  () =>
    searchQuery.value.length > 0 ||
    selectedGenres.value.length > 0 ||
    selectedCountries.value.length > 0 ||
    !!publishDateRange.value ||
    !!props.extraFiltersActive,
);

watch(searchQuery, (q) => emit("update:search-query", q), {
  immediate: true,
});
</script>

<template>
  <div class="filters-panel filters-shared">
    <div class="filters-panel__main">
      <InputSearch
        v-model="searchQuery"
        :search-handler="searchHandler"
        btn-label="Искать"
        class="filters-panel__search"
        placeholder="Введите название"
      />
      <GenreFilter v-model="selectedGenres" class="filters-panel__genre" />
      <CountryFilter
        v-model="selectedCountries"
        class="filters-panel__country"
      />

      <slot name="after-country" />

      <button
        class="filters-panel__toggle"
        type="button"
        :class="{
          'filters-panel__toggle--active': isExpanded || filtersBadgeActive,
        }"
        @click="toggleExpanded"
      >
        <BaseIcon
          :name="isExpanded ? 'mdi:filter-off' : 'mdi:filter'"
          :width="18"
          :height="18"
        />
        <span class="filters-panel__toggle-text">Фильтры</span>
        <span
          v-if="filtersBadgeActive && !isExpanded"
          class="filters-panel__badge"
        />
      </button>

      <a-button
        type="primary"
        size="large"
        class="filters-panel__clear"
        :disabled="!hasAnyFilters"
        @click="clearFilters"
      >
        <BaseIcon name="mdi:trash" />
        <span class="filters-panel__clear-text">Очистить</span>
      </a-button>
    </div>

    <Transition name="filters-slide">
      <div v-if="isExpanded || isMobile" class="filters-panel__advanced">
        <slot name="advanced-extra" />
        <DateRangeFilter
          v-model="publishDateRange"
          label="Дата выхода"
          :placeholder="['От', 'До']"
        />
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.filters-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;

  &__main {
    display: flex;
    flex-direction: column;
    gap: 8px;

    @include mediaTablet {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
  }

  &__search {
    max-width: 100%;
    min-width: 100%;

    @include mediaTablet {
      max-width: 500px;
      min-width: 500px;
    }
  }

  &__genre,
  &__country {
    width: 100%;

    @include mediaTablet {
      width: 220px;
    }
  }

  &__toggle {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    white-space: nowrap;
    height: 40px;

    @include mediaTablet {
      display: flex;
    }

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
    }

    &--active {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 5%,
        var(--bg-primary)
      );
    }
  }

  &__toggle-text {
    @media (max-width: 1100px) {
      display: none;
    }
  }

  &__badge {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ant-color-primary);
  }

  &__advanced {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: color-mix(in srgb, var(--bg-secondary) 50%, var(--bg-primary));
    border-radius: 12px;
    border: 1px solid var(--border-color);

    @include mediaTablet {
      flex-direction: row;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
    }
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
    white-space: nowrap;
    height: 40px;

    &:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 5%,
        var(--bg-primary)
      );
    }

    &:disabled {
      cursor: default;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    &:hover:not(:disabled) {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
    }
  }
}

.filters-slide-enter-active,
.filters-slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
  will-change: opacity, height, padding, margin;
}

.filters-slide-enter-from,
.filters-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
}

.filters-slide-enter-to,
.filters-slide-leave-from {
  opacity: 1;
  max-height: 280px;
}
</style>
