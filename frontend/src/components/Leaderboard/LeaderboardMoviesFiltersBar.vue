<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import DateRangeFilter from "@/components/Filters/DateRangeFilter.vue";
import RateFilter from "@/components/Filters/RateFilter.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import {
  useLeaderboardMoviesStore,
  type LeaderboardMovieSortBy,
  type LeaderboardMovieSortOrder,
} from "@/stores";
import { useActorsStore } from "@/stores/actors/actorsStore";
import type { SelectProps } from "ant-design-vue";

const moviesLbStore = useLeaderboardMoviesStore();
const {
  sortBy,
  sortOrder,
  selectedGenres,
  selectedCountries,
  publishDateRange,
  actorIds,
  personalRateRange,
} = storeToRefs(moviesLbStore);

const actorsStore = useActorsStore();

const sortByOptions: SelectProps["options"] = [
  {
    value: "avgPersonalRate",
    label: "По средней пользовательской оценке",
  },
  { value: "ratingsCount", label: "По числу оценок" },
  { value: "title", label: "По названию" },
  { value: "publishDate", label: "По дате выхода" },
];

const sortOrderOptions: SelectProps["options"] = [
  { value: "desc", label: "По убыванию" },
  { value: "asc", label: "По возрастанию" },
];

const debouncedRefetch = useDebounceFn(() => {
  void moviesLbStore.refreshFromStart();
}, 350);

const onSortByChange = (value: LeaderboardMovieSortBy) => {
  void moviesLbStore.setSort(value, sortOrder.value);
};

const onSortOrderChange = (value: LeaderboardMovieSortOrder) => {
  void moviesLbStore.setSort(sortBy.value, value);
};

const hasFilters = computed(
  () =>
    selectedGenres.value.length > 0 ||
    selectedCountries.value.length > 0 ||
    !!publishDateRange.value ||
    actorIds.value.length > 0 ||
    personalRateRange.value[0] !== 0 ||
    personalRateRange.value[1] !== 10
);

const clearFilters = () => {
  moviesLbStore.clearFilters();
  void moviesLbStore.refreshFromStart();
};

onMounted(() => {
  if (!actorsStore.isActorsLoaded && !actorsStore.isActorsLoading) {
    void actorsStore.fetchActors().catch(() => {});
  }
});

watch(
  [
    selectedGenres,
    selectedCountries,
    publishDateRange,
    actorIds,
    personalRateRange,
  ],
  () => debouncedRefetch(),
  { deep: true }
);
</script>

<template>
  <div class="filters-panel filters-shared lb-movies-filters">
    <div class="filters-panel__main">
      <a-select
        :value="sortBy"
        :options="sortByOptions"
        placeholder="Сортировка"
        class="lb-movies-filters__sort lb-movies-filters__sort--wide"
        size="large"
        @update:value="onSortByChange"
      />
      <a-select
        :value="sortOrder"
        :options="sortOrderOptions"
        placeholder="Порядок"
        class="lb-movies-filters__sort lb-movies-filters__sort--narrow"
        size="large"
        @update:value="onSortOrderChange"
      />

      <GenreFilter v-model="selectedGenres" class="filters-panel__genre" />
      <CountryFilter v-model="selectedCountries" class="filters-panel__country" />

      <a-select
        v-model:value="actorIds"
        mode="multiple"
        allow-clear
        show-search
        option-filter-prop="label"
        placeholder="Актёры"
        class="lb-movies-filters__actors"
        size="large"
        :loading="actorsStore.isActorsLoading"
        :options="
          actorsStore.getAllActors.map((a) => ({
            value: a.id,
            label: a.name,
          }))
        "
      />

      <DateRangeFilter
        v-model="publishDateRange"
        label="Дата выхода"
        :placeholder="['От', 'До']"
        class="lb-movies-filters__dates"
      />
      <RateFilter v-model="personalRateRange" class="lb-movies-filters__rate" />

      <a-button
        type="primary"
        size="large"
        class="filters-panel__clear"
        :disabled="!hasFilters"
        @click="clearFilters"
      >
        <BaseIcon name="mdi:trash" />
        <span class="filters-panel__clear-text">Сбросить фильтры</span>
      </a-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.filters-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  margin-bottom: 2rem;
  width: 100%;
  max-width: var(--grid-max-width);

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

  &__genre,
  &__country {
    width: 100%;

    @include mediaTablet {
      width: 220px;
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

  &__clear-text {
    @media (max-width: 520px) {
      display: none;
    }
  }
}

.lb-movies-filters {
  &__sort {
    width: 100%;

    @include mediaTablet {
      &--wide {
        flex: 1 1 260px;
        max-width: min(100%, 400px);
        min-width: 200px;
      }

      &--narrow {
        flex: 0 0 auto;
        width: 200px;
        min-width: 180px;
      }
    }
  }

  &__actors {
    width: 100%;

    @include mediaTablet {
      flex: 1 1 240px;
      max-width: min(100%, 320px);
      min-width: 200px;
    }
  }

  &__dates {
    width: 100%;

    @include mediaTablet {
      flex: 1 1 260px;
      max-width: min(100%, 320px);
      min-width: 220px;
    }
  }

  &__rate {
    width: 100%;

    @include mediaTablet {
      width: 220px;
      flex-shrink: 0;
    }
  }

  @include mediaMax(600px) {
    .filters-panel__main > * {
      width: 100%;
      max-width: 100%;
    }
  }
}
</style>
