<script lang="ts" setup>
import { currentTheme, themes } from "@/composable";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { SelectProps } from "ant-design-vue";
import { computed } from "vue";
import {
  type SettingBlockProps,
  type StatsBlockItem,
  StatsBlockType,
} from "@/shared/profile/profile.types";
import StatsBlock from "@/components/ProfileSettings/components/Stats/StatsBlock.vue";
import { useUserMoviesStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { STAT_BLOCK_TITLES } from "@/components/ProfileSettings/constants";

const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

const props = defineProps<SettingBlockProps>();
const isTheme = computed(() => props.type === "theme");
const isStats = computed(() => props.type === "stats");

const userId = computed(() => mainStore.user?.id || "");

const themeOptions: SelectProps["options"] = themes.map((theme) => ({
  label: theme.charAt(0).toUpperCase() + theme.slice(1),
  value: theme,
}));

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const stats = computed(() => {
  const data = userMoviesStore.stats;

  if (!data) return null;

  const keys = Object.keys(StatsBlockType) as StatsBlockType[];

  return keys.map((type) => ({
    type,
    title: STAT_BLOCK_TITLES[type],
    value: data[type],
  })) satisfies StatsBlockItem[];
});

const isStatsLoading = computed(() => userMoviesStore.isStatsLoading);
const isStatsFailed = computed(() => userMoviesStore.isStatsError);

const retryStats = async () => {
  if (userId.value) {
    await userMoviesStore.fetchUserMoviesStats(userId.value);
  }
};
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
      :allow-clear="true"
      :filter-option="filterOption"
      :options="themeOptions"
      :style="{ width: '100%' }"
      placeholder="Выберите тему"
      show-search
      size="large"
    />

    <div v-if="isStats" class="setting-block__stats">
      <div v-if="isStatsLoading" class="setting-block__stats-loading">
        <div class="setting-block__loader"></div>
        <span>Загрузка статистики...</span>
      </div>
      <div v-else>
        <div v-if="isStatsFailed || !stats" class="setting-block__stats-error">
          <BaseIcon class="setting-block__error-icon" name="mdi:alert-circle" />
          <span>Ошибка загрузки статистики</span>
          <a-button
            class="setting-block__retry-btn"
            size="small"
            type="primary"
            @click="retryStats"
          >
            Повторить
          </a-button>
        </div>
        <div v-else class="setting-block__stats-content">
          <StatsBlock :items="stats" />
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
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

  &__stats {
    padding: 1rem;
    background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--border-color) 30%, transparent);
  }

  &__stats-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--text-secondary);
  }

  &__loader {
    width: 40px;
    height: 40px;
    border: 3px solid color-mix(in srgb, var(--border-color) 50%, transparent);
    border-top: 3px solid var(--ant-color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  &__stats-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem 1rem;
    text-align: center;
    color: color-mix(in srgb, var(--ant-color-error) 80%, var(--text-primary));
  }

  &__error-icon {
    width: 2rem;
    height: 2rem;
    color: var(--ant-color-error);
  }

  &__retry-btn {
    margin-top: 1rem;
  }
}
</style>
