<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs, { Dayjs } from "dayjs";

import InputSearch from "@/components/Input/InputSearch/InputSearch.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import RateFilter from "@/components/Filters/RateFilter.vue";
import DateRangeFilter from "@/components/Filters/DateRangeFilter.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useWindowSize } from "@vueuse/core";
import type { MoviesFilters } from "@/stores";
import { Genre } from "@/components/Genres/constants/genres.constants";

const TABLET_WIDTH = 768;
const DEFAULT_RATE_RANGE: [number, number] = [0, 10];

defineProps<{
  searchHandler: (value: string) => Promise<void>;
}>();

const emit = defineEmits<{
  "update:filters": [filters: MoviesFilters];
}>();

const { width } = useWindowSize();

const searchQuery = ref<string>("");
const selectedGenre = ref<Genre | undefined>(undefined);
const rateRange = ref<[number, number]>([...DEFAULT_RATE_RANGE]);
const watchDateRange = ref<[Dayjs, Dayjs] | null>(null);
const publishDateRange = ref<[Dayjs, Dayjs] | null>(null);
const seeLater = ref(false);
const isExpanded = ref(false);

const isMobile = computed(() => width.value < TABLET_WIDTH);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const hasAdvancedFilters = computed(() => {
  const [rateMin, rateMax] = rateRange.value;
  return (
    rateMin > 0 ||
    rateMax < 10 ||
    !!watchDateRange.value ||
    !!publishDateRange.value
  );
});

const clearFilters = () => {
  searchQuery.value = "";
  selectedGenre.value = undefined;
  rateRange.value = [...DEFAULT_RATE_RANGE];
  watchDateRange.value = null;
  publishDateRange.value = null;
  seeLater.value = false;
};

const hasAnyFilters = computed(() => {
  return (
    searchQuery.value.length > 0 ||
    !!selectedGenre.value ||
    seeLater.value ||
    hasAdvancedFilters.value
  );
});

const buildFilters = (): MoviesFilters => {
  const [rateMin, rateMax] = rateRange.value;

  return {
    genre: selectedGenre.value,
    rateMin: rateMin > 0 ? rateMin : undefined,
    rateMax: rateMax < 10 ? rateMax : undefined,
    dateFrom: watchDateRange.value?.[0]
      ? dayjs(watchDateRange.value[0]).startOf("month").toISOString()
      : undefined,
    dateTo: watchDateRange.value?.[1]
      ? dayjs(watchDateRange.value[1]).endOf("month").toISOString()
      : undefined,
    publishDateFrom: publishDateRange.value?.[0]
      ? dayjs(publishDateRange.value[0]).startOf("month").toISOString()
      : undefined,
    publishDateTo: publishDateRange.value?.[1]
      ? dayjs(publishDateRange.value[1]).endOf("month").toISOString()
      : undefined,
    seeLater: seeLater.value || undefined,
  };
};

const emitFilters = () => {
  emit("update:filters", buildFilters());
};

watch(
  [selectedGenre, rateRange, watchDateRange, publishDateRange, seeLater],
  emitFilters,
  { deep: true }
);
</script>

<template>
  <div class="filters-panel">
    <div class="filters-panel__main">
      <InputSearch
        v-model="searchQuery"
        :search-handler="searchHandler"
        btn-label="Искать"
        class="filters-panel__search"
        placeholder="Введите название"
      />
      <GenreFilter v-model="selectedGenre" class="filters-panel__genre" />
      <div class="filters-panel__see-later">
        <a-switch v-model:checked="seeLater" size="small" />
        <span class="filters-panel__see-later-label">Смотреть позже</span>
      </div>
      <button
        class="filters-panel__toggle"
        :class="{
          'filters-panel__toggle--active': isExpanded || hasAdvancedFilters,
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
          v-if="hasAdvancedFilters && !isExpanded"
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
        <RateFilter v-model="rateRange" />
        <DateRangeFilter
          v-model="watchDateRange"
          label="Дата просмотра"
          :placeholder="['От', 'До']"
        />
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

  &__genre {
    width: 100%;

    @include mediaTablet {
      width: 220px;
    }
  }

  &__see-later {
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

  &__see-later-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);

    @media (max-width: 1100px) {
      display: none;
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
    //@media (max-width: 1100px) {
    //  display: none;
    //}
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
  max-height: 200px;
}
</style>
