<script lang="ts" setup>
import { currentTheme, themes } from "@/composable";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { SelectProps } from "ant-design-vue";
import { computed, onMounted, ref, watch } from "vue";
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

  if (!data) {
    return null;
  }

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

const friendsStatsLoading = ref(false);

const loadFriendsStats = async () => {
  if (!userId.value) {
    return;
  }

  friendsStatsLoading.value = true;
  try {
    await friendsStore.fetchStats(userId.value);
  } finally {
    friendsStatsLoading.value = false;
  }
};

const retryFriendsStats = () => {
  void loadFriendsStats();
};

onMounted(() => {
  if (isFriends.value && userId.value) {
    void loadFriendsStats();
  }
});

watch(userId, (id) => {
  if (isFriends.value && id) {
    void loadFriendsStats();
  }
});

const isFriendsEmptySocial = computed(() => {
  const s = friendsStore.stats;
  if (!s) {
    return false;
  }

  const n = (v: number | undefined) => v ?? 0;

  return (
    n(s.friendsCount) === 0 &&
    n(s.subscribersCount) === 0 &&
    n(s.subscriptionsCount) === 0 &&
    n(s.pendingRequestsCount) === 0
  );
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
      <div
        v-if="friendsStatsLoading || friendsStore.isLoading"
        class="setting-block__stats-loading"
      >
        <div class="setting-block__loader"></div>
        <span>Загрузка...</span>
      </div>
      <div v-else-if="friendsStore.stats" class="setting-block__friends-content">
        <div
          v-if="isFriendsEmptySocial"
          class="setting-block__friends-empty-hint"
        >
          <BaseIcon
            name="mdi:account-multiple-outline"
            class="setting-block__friends-empty-icon"
          />
          <p class="setting-block__friends-empty-text">
            Пока нет друзей и подписок — добавьте людей в разделе ниже или примите входящие запросы.
          </p>
        </div>
        <div class="friends-stats">
          <div class="friends-stats__item">
            <div class="friends-stats__icon-wrap" aria-hidden="true">
              <BaseIcon name="mdi:account-multiple" class="friends-stats__icon" />
            </div>
            <div class="friends-stats__info">
              <span class="friends-stats__label">Друзей</span>
              <span class="friends-stats__value">{{
                friendsStore.stats.friendsCount
              }}</span>
            </div>
          </div>
          <div class="friends-stats__item">
            <div class="friends-stats__icon-wrap" aria-hidden="true">
              <BaseIcon name="mdi:account-heart" class="friends-stats__icon" />
            </div>
            <div class="friends-stats__info">
              <span class="friends-stats__label">Подписчиков</span>
              <span class="friends-stats__value">{{
                friendsStore.stats.subscribersCount
              }}</span>
            </div>
          </div>
          <div class="friends-stats__item">
            <div class="friends-stats__icon-wrap" aria-hidden="true">
              <BaseIcon name="mdi:account-star" class="friends-stats__icon" />
            </div>
            <div class="friends-stats__info">
              <span class="friends-stats__label">Подписок</span>
              <span class="friends-stats__value">{{
                friendsStore.stats.subscriptionsCount
              }}</span>
            </div>
          </div>
        </div>
        <div class="friends-actions">
          <a-button type="primary" size="large" block @click="goToFriendsPage">
            <template #icon>
              <BaseIcon name="mdi:account-group" class="friends-actions__icon" />
            </template>
            Управление друзьями
          </a-button>
          <a-button size="large" block @click="goToChatPage">
            <template #icon>
              <BaseIcon name="mdi:message-text" class="friends-actions__icon" />
            </template>
            Сообщения
          </a-button>
        </div>
      </div>
      <div v-else class="setting-block__friends-fallback">
        <BaseIcon
          name="mdi:account-question-outline"
          class="setting-block__friends-fallback-icon"
        />
        <p class="setting-block__friends-fallback-text">
          Не удалось загрузить данные о друзьях. Проверьте соединение и попробуйте снова.
        </p>
        <a-button type="primary" @click="retryFriendsStats">
          Повторить
        </a-button>
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

  &__friends-empty-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 8%,
      var(--bg-primary)
    );
    border: 1px solid
      color-mix(in srgb, var(--ant-color-primary) 22%, var(--border-color));
  }

  &__friends-empty-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-top: 2px;
    color: var(--ant-color-primary);
  }

  &__friends-empty-text {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  &__friends-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem 1.25rem;
    text-align: center;
    border-radius: 12px;
    border: 1px dashed var(--border-color);
    background: var(--bg-primary);
  }

  &__friends-fallback-icon {
    width: 40px;
    height: 40px;
    color: var(--text-secondary);
    opacity: 0.85;
  }

  &__friends-fallback-text {
    margin: 0;
    max-width: 28rem;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-secondary);
  }
}

.friends-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.125rem;
    min-height: 4.25rem;
    background: var(--bg-primary);
    border-radius: 14px;
    border: 1px solid var(--border-color);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--text-primary) 4%, transparent);
  }

  &__icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 3rem;
    height: 3rem;
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 12%,
      var(--bg-secondary)
    );
    border: 1px solid color-mix(in srgb, var(--ant-color-primary) 18%, transparent);
  }

  &__icon {
    width: 1.375rem;
    height: 1.375rem;
    color: var(--ant-color-primary);
    display: block;
  }

  &__info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    min-width: 0;
    flex: 1;
  }

  &__label {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.25;
    color: var(--text-secondary);
  }

  &__value {
    font-size: 1.625rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--text-primary);
  }
}

.friends-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  &__icon {
    width: 1.25rem;
    height: 1.25rem;
    display: block;
    vertical-align: middle;
  }

  /* #icon + подпись в одну строку (разметка ant-design-vue) */
  :deep(.ant-btn.ant-btn-lg) {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: auto;
    min-height: 44px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  :deep(.ant-btn.ant-btn-lg .ant-btn-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
}
</style>
