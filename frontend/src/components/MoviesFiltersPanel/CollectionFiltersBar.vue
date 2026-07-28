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
import RateFilter from "@/components/Filters/RateFilter.vue";
import { type UserMoviesFilters, WatchStatus } from "@/stores";
import {
  type Genre,
  GenreLabels,
} from "@/components/Genres/constants/genres.constants";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";

const props = withDefaults(
  defineProps<{
    searchHandler: (value: string) => Promise<void>;
    /** Показывать статус-пилюли (коллекция — да; избранное — нет) */
    showStatus?: boolean;
    searchPlaceholder?: string;
    /** Сколько тайтлов сейчас показано — число в кнопке «Показать» */
    resultCount?: number;
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

// Пресеты (эталон): один клик выставляет типовую комбинацию фильтров
type PresetKey = "high-rate" | "fresh" | "later";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "high-rate", label: "Высокий рейтинг" },
  { key: "fresh", label: "Новинки 2020+" },
  { key: "later", label: "Буду смотреть" },
];

const FRESH_FROM_YEAR = 2020;
const HIGH_RATE_MIN = 7;

const activePreset = computed<PresetKey | null>(() => {
  if (activeStatus.value === "later") {
    return "later";
  }

  if (rateRange.value[0] === HIGH_RATE_MIN && rateRange.value[1] === 10) {
    return "high-rate";
  }

  const from = publishDateRange.value?.[0];

  if (from && dayjs(from).year() === FRESH_FROM_YEAR) {
    return "fresh";
  }

  return null;
});

const togglePreset = (key: PresetKey): void => {
  const isActive = activePreset.value === key;

  if (key === "later") {
    setStatus(isActive ? "all" : "later");

    return;
  }

  if (key === "high-rate") {
    rateRange.value = isActive ? [...DEFAULT_RATE] : [HIGH_RATE_MIN, 10];

    return;
  }

  publishDateRange.value = isActive
    ? null
    : [dayjs(`${FRESH_FROM_YEAR}-01-01`), dayjs()];
};

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

  if (rateActive.value) {
    tags.push({
      key: "rate",
      label: `Оценка ${rateRange.value[0]}–${rateRange.value[1]}`,
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
  } else if (type === "rate") {
    rateRange.value = [...DEFAULT_RATE];
  }
};

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
        aria-label="Фильтры"
        @click="isDrawerOpen = true"
      >
        <BaseIcon name="ph:sliders-horizontal" :width="19" :height="19" />
        <span class="collection-filters__toggle-text">Фильтры</span>
        <span v-if="advancedCount" class="collection-filters__badge">{{
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

      <div class="collection-filters__presets">
        <span class="collection-filters__presets-label">Быстрый выбор</span>
        <div class="collection-filters__presets-row">
          <button
            v-for="preset in PRESETS"
            :key="preset.key"
            type="button"
            class="collection-filters__preset"
            :class="{
              'collection-filters__preset--active': activePreset === preset.key,
            }"
            @click="togglePreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <RateFilter v-model="rateRange" />
    </FiltersSheet>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/media" as *;
@use "@/styles/scrollbar" as *;

.collection-filters {
  margin-top: 16px;
  width: 100%;

  &__row {
    // До планшета: поиск и кнопка-иконка в одной строке, статусы — во второй
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search filter"
      "status status";
    align-items: center;
    gap: 10px;
    width: 100%;

    @include mediaTablet {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      // 3 группы: поиск слева · статус-пилюли в центре · «Фильтры» справа
      justify-content: space-between;
      gap: 12px;
    }
  }

  &__search {
    grid-area: search;
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
    grid-area: status;
    display: flex;
    gap: 8px;
    // Эталон (мобилка): пилюли в один ряд со скроллом, без переноса на 2 строки
    overflow-x: auto;

    @include hideScrollbar();
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
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease),
      border-color var(--fv-motion-fast) var(--fv-ease);

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
    grid-area: filter;

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

  &__presets {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__presets-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__preset {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    &:hover:not(&--active) {
      background: var(--fv-color-bg-secondary);
    }

    &--active {
      background: var(--fv-color-text-primary);
      border-color: transparent;
      color: var(--fv-color-bg-primary);
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
