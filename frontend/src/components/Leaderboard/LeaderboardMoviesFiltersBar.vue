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
  <div class="lb-movies-filters">
    <div class="lb-movies-filters__row lb-movies-filters__row--sort">
      <div class="lb-movies-filters__field">
        <span class="lb-movies-filters__label">Сортировка</span>
        <a-select
          :value="sortBy"
          :options="sortByOptions"
          class="lb-movies-filters__select"
          size="large"
          @update:value="onSortByChange"
        />
      </div>
      <div class="lb-movies-filters__field">
        <span class="lb-movies-filters__label">Порядок</span>
        <a-select
          :value="sortOrder"
          :options="sortOrderOptions"
          class="lb-movies-filters__select lb-movies-filters__select--narrow"
          size="large"
          @update:value="onSortOrderChange"
        />
      </div>
    </div>

    <div class="lb-movies-filters__row lb-movies-filters__row--filters">
      <GenreFilter v-model="selectedGenres" class="lb-movies-filters__genre" />
      <CountryFilter
        v-model="selectedCountries"
        class="lb-movies-filters__country"
      />
      <div class="lb-movies-filters__field lb-movies-filters__field--actors">
        <span class="lb-movies-filters__label">Актёры</span>
        <a-select
          v-model:value="actorIds"
          mode="multiple"
          allow-clear
          show-search
          option-filter-prop="label"
          placeholder="Любой из выбранных"
          class="lb-movies-filters__select lb-movies-filters__select--actors"
          size="large"
          :loading="actorsStore.isActorsLoading"
          :options="
            actorsStore.getAllActors.map((a) => ({
              value: a.id,
              label: a.name,
            }))
          "
        />
      </div>
      <DateRangeFilter
        v-model="publishDateRange"
        label="Дата выхода"
        :placeholder="['От', 'До']"
        class="lb-movies-filters__dates"
      />
      <RateFilter v-model="personalRateRange" class="lb-movies-filters__rate" />
      <a-button
        type="default"
        size="large"
        class="lb-movies-filters__clear"
        :disabled="!hasFilters"
        @click="clearFilters"
      >
        <BaseIcon name="mdi:trash" />
        Сбросить фильтры
      </a-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.lb-movies-filters {
  margin-top: 1.5rem;
  margin-bottom: 2rem;
  width: 100%;
  max-width: var(--grid-max-width);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.25rem;
    width: 100%;
    justify-content: center;
    align-items: flex-end;

    &--sort {
      border-bottom: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
      padding-bottom: 1.25rem;
    }

    &--filters {
      align-items: flex-end;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-width: min(100%, 200px);

    &--actors {
      min-width: min(100%, 260px);
      flex: 1;
    }
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__select {
    width: min(100%, 380px);

    &--narrow {
      width: min(100%, 200px);
    }

    &--actors {
      width: 100%;
    }
  }

  &__genre,
  &__country {
    width: min(100%, 220px);
  }

  &__dates {
    min-width: min(100%, 260px);
  }

  &__rate {
    min-width: min(100%, 220px);
  }

  &__clear {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  @include mediaMax(600px) {
    &__row--filters {
      flex-direction: column;
      align-items: stretch;
    }

    &__genre,
    &__country,
    &__select,
    &__select--narrow {
      width: 100%;
    }
  }
}
</style>
