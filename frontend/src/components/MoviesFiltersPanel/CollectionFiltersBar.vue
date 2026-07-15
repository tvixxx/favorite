<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs, { type Dayjs } from "dayjs";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import GenreFilter from "@/components/Genres/GenreFilter.vue";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import DateRangeFilter from "@/components/Filters/DateRangeFilter.vue";
import RateFilter from "@/components/Filters/RateFilter.vue";
import { type UserMoviesFilters, WatchStatus } from "@/stores";
import { type Genre } from "@/components/Genres/constants/genres.constants";

const props = withDefaults(
  defineProps<{
    searchHandler: (value: string) => Promise<void>;
    /** Показывать статус-пилюли (коллекция — да; избранное — нет) */
    showStatus?: boolean;
    searchPlaceholder?: string;
  }>(),
  {
    showStatus: true,
    searchPlaceholder: "Поиск по коллекции",
  },
);

const emit = defineEmits<{
  "update:filters": [filters: UserMoviesFilters];
}>();

// Статус-пилюли (эталон): watchStatus WATCHING/COMPLETED + seeLater для «Буду смотреть»
type StatusKey = "all" | "watching" | "later" | "watched";

const STATUSES: { key: StatusKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "watching", label: "Смотрю" },
  { key: "later", label: "Буду смотреть" },
  { key: "watched", label: "Просмотрено" },
];

const DEFAULT_RATE: [number, number] = [0, 10];

const searchValue = ref("");
const activeStatus = ref<StatusKey>("all");
const selectedGenres = ref<Genre[]>([]);
const selectedCountries = ref<string[]>([]);
const publishDateRange = ref<[Dayjs, Dayjs] | null>(null);
const rateRange = ref<[number, number]>([...DEFAULT_RATE]);
const isDrawerOpen = ref(false);

const rateActive = computed(
  () => rateRange.value[0] > 0 || rateRange.value[1] < 10,
);

const advancedCount = computed(() => {
  let n = 0;
  if (selectedGenres.value.length) n += 1;
  if (selectedCountries.value.length) n += 1;
  if (publishDateRange.value) n += 1;
  if (rateActive.value) n += 1;

  return n;
});

const buildFilters = (): UserMoviesFilters => {
  const [rateMin, rateMax] = rateRange.value;

  return {
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
    personalRateMin: rateMin > 0 ? rateMin : undefined,
    personalRateMax: rateMax < 10 ? rateMax : undefined,
    watchStatus:
      activeStatus.value === "watching"
        ? WatchStatus.WATCHING
        : activeStatus.value === "watched"
          ? WatchStatus.COMPLETED
          : undefined,
    seeLater: activeStatus.value === "later" ? true : undefined,
  };
};

const emitFilters = (): void => {
  emit("update:filters", buildFilters());
};

const setStatus = (key: StatusKey): void => {
  if (activeStatus.value === key) {
    return;
  }

  activeStatus.value = key;
  emitFilters();
};

const resetAdvanced = (): void => {
  selectedGenres.value = [];
  selectedCountries.value = [];
  publishDateRange.value = null;
  rateRange.value = [...DEFAULT_RATE];
};

watch(
  [selectedGenres, selectedCountries, publishDateRange, rateRange],
  emitFilters,
  { deep: true },
);

let searchTimer: ReturnType<typeof setTimeout> | undefined;

const onSearchInput = (): void => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void props.searchHandler(searchValue.value.trim());
  }, 350);
};

const onSearchEnter = (): void => {
  clearTimeout(searchTimer);
  void props.searchHandler(searchValue.value.trim());
};
</script>

<template>
  <div class="collection-filters" data-tour="collection-filters">
    <div class="collection-filters__row">
      <label class="collection-filters__search">
        <BaseIcon
          name="ph:magnifying-glass"
          :width="20"
          :height="20"
          class="collection-filters__search-icon"
        />
        <input
          v-model="searchValue"
          type="text"
          :placeholder="searchPlaceholder"
          @input="onSearchInput"
          @keydown.enter="onSearchEnter"
        />
      </label>

      <div v-if="showStatus" class="collection-filters__statuses" role="group">
        <button
          v-for="s in STATUSES"
          :key="s.key"
          type="button"
          class="collection-filters__status"
          :class="{
            'collection-filters__status--active': activeStatus === s.key,
          }"
          @click="setStatus(s.key)"
        >
          {{ s.label }}
        </button>
      </div>

      <button
        type="button"
        class="collection-filters__toggle"
        :class="{ 'collection-filters__toggle--active': advancedCount > 0 }"
        @click="isDrawerOpen = true"
      >
        <BaseIcon name="ph:sliders-horizontal" :width="18" :height="18" />
        <span class="collection-filters__toggle-text">Фильтры</span>
        <span v-if="advancedCount" class="collection-filters__badge">{{
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
      <div class="collection-filters__advanced">
        <GenreFilter v-model="selectedGenres" />
        <CountryFilter v-model="selectedCountries" />
        <DateRangeFilter
          v-model="publishDateRange"
          label="Дата выхода"
          :placeholder="['От', 'До']"
        />
        <RateFilter v-model="rateRange" />
      </div>

      <template #footer>
        <div class="collection-filters__drawer-footer">
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

.collection-filters {
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
      flex-wrap: wrap;
      // 3 группы: поиск слева · статус-пилюли в центре · «Фильтры» справа
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
      // фикс. гибкий базис (без grow) — иначе конфликт с margin-left:auto у «Фильтры»
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

  &__statuses {
    display: flex;
    gap: 8px;
    // Эталон (мобилка): пилюли в один ряд со скроллом, без переноса на 2 строки
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  // Пилюли статуса: как чипы сабнава (активная = тёмная ink-плашка)
  &__status {
    flex-shrink: 0;
    height: 40px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    &--active {
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
      border-color: transparent;

      // активная пилюля на ховере — чуть светлее, текст остаётся белым
      &:hover {
        background: color-mix(in srgb, var(--fv-color-text-primary), #fff 16%);
        color: var(--fv-color-bg-primary);
      }
    }
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
