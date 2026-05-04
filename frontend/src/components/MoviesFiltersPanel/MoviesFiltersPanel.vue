<script setup lang="ts">
import { computed, ref, watch } from "vue";

import MoviesFiltersShared from "@/components/MoviesFiltersPanel/MoviesFiltersShared.vue";
import RateFilter from "@/components/Filters/RateFilter.vue";
import type { UserMoviesFilters } from "@/stores";
import type { MoviesFilters } from "@/stores/movies/types";

const DEFAULT_RATE_RANGE: [number, number] = [0, 10];

defineProps<{
  searchHandler: (value: string) => Promise<void>;
}>();

const emit = defineEmits<{
  "update:filters": [filters: UserMoviesFilters];
}>();

const moviesPart = ref<MoviesFilters>({});
const searchQuery = ref("");
const rateRange = ref<[number, number]>([...DEFAULT_RATE_RANGE]);
const seeLater = ref(false);

const rateAdvanced = computed(() => {
  const [min, max] = rateRange.value;

  return min > 0 || max < 10;
});

const extraAdvancedActive = computed(() => rateAdvanced.value || seeLater.value);

const extraFiltersActive = computed(() => extraAdvancedActive.value);

function onMoviesFilters(f: MoviesFilters) {
  moviesPart.value = f;
  emitFilters();
}

function onSharedCleared() {
  rateRange.value = [...DEFAULT_RATE_RANGE];
  seeLater.value = false;
  emitFilters();
}

function onSearchQuery(q: string) {
  searchQuery.value = q;
}

const buildFilters = (): UserMoviesFilters => {
  const [rateMin, rateMax] = rateRange.value;

  return {
    ...moviesPart.value,
    personalRateMin: rateMin > 0 ? rateMin : undefined,
    personalRateMax: rateMax < 10 ? rateMax : undefined,
    seeLater: seeLater.value || undefined,
  };
};

const emitFilters = () => {
  emit("update:filters", buildFilters());
};

watch([rateRange, seeLater], emitFilters, { deep: true });
</script>

<template>
  <MoviesFiltersShared
    :search-handler="searchHandler"
    :extra-advanced-active="extraAdvancedActive"
    :extra-filters-active="extraFiltersActive"
    @update:movies-filters="onMoviesFilters"
    @update:search-query="onSearchQuery"
    @cleared="onSharedCleared"
  >
    <template #after-country>
      <div class="filters-panel__see-later">
        <a-switch v-model:checked="seeLater" size="small" />
        <span class="filters-panel__see-later-label">Смотреть позже</span>
      </div>
    </template>
    <template #advanced-extra>
      <RateFilter v-model="rateRange" />
    </template>
  </MoviesFiltersShared>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;

.filters-panel__see-later {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  height: 40px;
  white-space: nowrap;
}

.filters-panel__see-later-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);

  @media (max-width: 1100px) {
    display: none;
  }
}
</style>
