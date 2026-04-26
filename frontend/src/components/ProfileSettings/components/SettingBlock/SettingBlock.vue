<script lang="ts" setup>
import { currentTheme, themes } from "@/composable";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { SelectProps } from "ant-design-vue";
import { computed, onMounted } from "vue";
import {
  type SettingBlockProps,
  type StatsBlockItem,
  StatsBlockType,
} from "@/shared/profile/profile.types";
import StatsBlock from "@/components/ProfileSettings/components/Stats/StatsBlock.vue";
import { useUserMoviesStore, useFriendsStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { STAT_BLOCK_TITLES } from "@/components/ProfileSettings/constants";
import { useRouter } from "vue-router";

const userMoviesStore = useUserMoviesStore();
const friendsStore = useFriendsStore();
const mainStore = useMainStore();
const router = useRouter();

const props = defineProps<SettingBlockProps>();
const isTheme = computed(() => props.type === "theme");
const isStats = computed(() => props.type === "stats");
const isFriends = computed(() => props.type === "friends");

const userId = computed(() => mainStore.userData?.id || "");

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

const goToFriendsPage = () => {
  router.push('/friends');
};

const goToChatPage = () => {
  router.push('/chat');
};

onMounted(async () => {
  if (isFriends.value && userId.value) {
    await friendsStore.fetchStats(userId.value);
  }
});
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

    <div v-if="isFriends" class="setting-block__friends">
      <div v-if="friendsStore.isLoading" class="setting-block__stats-loading">
        <div class="setting-block__loader"></div>
        <span>Загрузка...</span>
      </div>
      <div v-else-if="friendsStore.stats" class="setting-block__friends-content">
        <div class="friends-stats">
          <div class="friends-stats__item">
            <BaseIcon name="mdi:account-multiple" class="friends-stats__icon" />
            <div class="friends-stats__info">
              <span class="friends-stats__value">{{ friendsStore.stats.friendsCount }}</span>
              <span class="friends-stats__label">Друзей</span>
            </div>
          </div>
          <div class="friends-stats__item">
            <BaseIcon name="mdi:account-heart" class="friends-stats__icon" />
            <div class="friends-stats__info">
              <span class="friends-stats__value">{{ friendsStore.stats.subscribersCount }}</span>
              <span class="friends-stats__label">Подписчиков</span>
            </div>
          </div>
          <div class="friends-stats__item">
            <BaseIcon name="mdi:account-star" class="friends-stats__icon" />
            <div class="friends-stats__info">
              <span class="friends-stats__value">{{ friendsStore.stats.subscriptionsCount }}</span>
              <span class="friends-stats__label">Подписок</span>
            </div>
          </div>
        </div>
        <div class="friends-actions">
          <a-button type="primary" size="large" block @click="goToFriendsPage">
            <BaseIcon name="mdi:account-group" />
            Управление друзьями
          </a-button>
          <a-button size="large" block @click="goToChatPage">
            <BaseIcon name="mdi:message-text" />
            Сообщения
          </a-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use "../../../../styles/antd-overrides" as *;

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
    @include mutedInsetPanel;
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
    @include spinnerRing;
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

  &__friends {
    padding: 1rem;
    @include mutedInsetPanel;
  }

  &__friends-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
}

.friends-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  &__icon {
    width: 32px;
    height: 32px;
    color: var(--ant-color-primary);
  }

  &__info {
    display: flex;
    flex-direction: column;
  }

  &__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
}

.friends-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
