<script setup lang="ts">
import { currentTheme, themes } from "@/composable";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { SelectProps } from "ant-design-vue";
import { computed } from "vue";
import {
  type SettingBlockProps,
  StatsBlockItem,
  StatsBlockType,
} from "@/shared/profile/profile.types";
import StatsBlock from "@/components/ProfileSettings/components/Stats/StatsBlock.vue";
import { useMoviesStore } from "@/stores";
import { STAT_BLOCK_TITLES } from "@/components/ProfileSettings/constants";

const moviesStore = useMoviesStore();

const props = defineProps<SettingBlockProps>();
const isTheme = computed(() => props.type === "theme");
const isStats = computed(() => props.type === "stats");

const themeOptions: SelectProps["options"] = themes.map((theme) => ({
  label: theme.charAt(0).toUpperCase() + theme.slice(1),
  value: theme,
}));

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const stats = computed(() => {
  const data = moviesStore.moviesStats;

  if (!data) return null;

  const keys = Object.keys(StatsBlockType) as StatsBlockType[];

  return keys.map((type) => ({
    type,
    title: STAT_BLOCK_TITLES[type],
    value: data[type],
  })) satisfies StatsBlockItem[];
});

const isStatsLoading = computed(() => moviesStore.isMoviesStatsLoading);
const isStatsFailed = computed(() => moviesStore.isMoviesStatsError);
</script>

<template>
  <section class="setting-block setting-block--theme">
    <div class="setting-block__header">
      <BaseIcon :name="props.icon" class="setting-block__icon" />
      <h3 class="setting-block__title">{{ props.title }}</h3>
    </div>

    <p class="setting-block__description">
      {{ props.description }}
    </p>

    <a-select
      v-if="isTheme"
      v-model:value="currentTheme"
      show-search
      placeholder="Выберите тему"
      size="large"
      :style="{ width: '100%' }"
      :options="themeOptions"
      :filter-option="filterOption"
      :allow-clear="true"
    />

    <div v-if="isStats" class="setting-block__stats">
      <div v-if="isStatsLoading" class="settings-block__stats-loading">
        загрузка...
      </div>
      <div v-else>
        <div
          v-if="isStatsFailed || !stats"
          class="settings-block__stats-failed"
        >
          Ошибка загрузки...
        </div>
        <div v-else class="settings-block__stats-info">
          <StatsBlock :items="stats" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.setting-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  &__icon {
    width: 28px;
    height: 28px;
    color: var(--ant-color-primary);
  }

  &__title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__description {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.6;
  }
}
</style>
