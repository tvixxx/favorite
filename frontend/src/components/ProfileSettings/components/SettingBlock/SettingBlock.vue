<script lang="ts" setup>
import { currentTheme, setTheme, themes, type Theme } from "@/composable";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { computed, onMounted, ref, watch } from "vue";
import {
  type SettingBlockProps,
  type StatsBlockItem,
  StatsBlockType,
} from "@/shared/profile/profile.types";
import StatsBlock from "@/components/ProfileSettings/components/Stats/StatsBlock.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
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

const THEME_META: Record<
  Theme,
  { label: string; canvas: string; accent: string }
> = {
  light: { label: "Светлая", canvas: "#ffffff", accent: "#ff0032" },
  dark: { label: "Тёмная", canvas: "#141414", accent: "#177ddc" },
  emerald: { label: "Изумруд", canvas: "#f0fdf4", accent: "#10b981" },
  corporate: { label: "Корпоратив", canvas: "#f8fafc", accent: "#1e40af" },
  synthwave: { label: "Синтвейв", canvas: "#1e1e3f", accent: "#ec4899" },
  retro: { label: "Ретро", canvas: "#fef3c7", accent: "#f59e0b" },
  cyberpunk: { label: "Киберпанк", canvas: "#1e1b4b", accent: "#8b5cf6" },
};

const themeSwatches = themes.map((value) => ({
  value,
  ...THEME_META[value],
}));

const stats = computed(() => {
  const data = userMoviesStore.stats;

  if (!data) {
    return null;
  }

  // Эталон: «Смотреть позже» в статистике не показываем (есть в аналитике/коллекции)
  const keys = (Object.keys(StatsBlockType) as StatsBlockType[]).filter(
    (type) => type !== StatsBlockType.totalSeeLater,
  );

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
  router.push("/friends");
};

const goToChatPage = () => {
  router.push("/chat");
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

    <p v-if="props.description" class="setting-block__description">
      {{ props.description }}
    </p>

    <div v-if="isTheme" class="theme-swatches">
      <button
        v-for="t in themeSwatches"
        :key="t.value"
        type="button"
        class="theme-swatches__item"
        :class="{ 'theme-swatches__item--active': currentTheme === t.value }"
        @click="setTheme(t.value)"
      >
        <span class="theme-swatches__chip" :style="{ background: t.canvas }">
          <span
            class="theme-swatches__dot"
            :style="{ background: t.accent }"
          ></span>
        </span>
        <span class="theme-swatches__label">{{ t.label }}</span>
      </button>
    </div>

    <div v-if="isStats" class="setting-block__stats">
      <RowsSkeleton v-if="isStatsLoading" :count="4" :badge="false" />
      <StateBlock
        v-else-if="isStatsFailed || !stats"
        compact
        variant="error"
        icon="ph:warning-circle"
        title="Не удалось загрузить статистику"
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: retryStats,
          },
        ]"
      />
      <div v-else class="setting-block__stats-content">
        <StatsBlock :items="stats" />
      </div>
    </div>

    <div v-if="isFriends" class="setting-block__friends">
      <RowsSkeleton
        v-if="friendsStatsLoading || friendsStore.isLoading"
        :count="3"
        :badge="false"
      />
      <div
        v-else-if="friendsStore.stats"
        class="setting-block__friends-content"
      >
        <div
          v-if="isFriendsEmptySocial"
          class="setting-block__friends-empty-hint"
        >
          <BaseIcon
            name="ph:users-three"
            class="setting-block__friends-empty-icon"
          />
          <p class="setting-block__friends-empty-text">
            Пока нет друзей и подписок — добавьте людей в разделе ниже или
            примите входящие запросы.
          </p>
        </div>
        <div class="friends-stats">
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.friendsCount
            }}</span>
            <span class="friends-stats__label">Друзей</span>
          </div>
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.subscribersCount
            }}</span>
            <span class="friends-stats__label">Подписчиков</span>
          </div>
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.subscriptionsCount
            }}</span>
            <span class="friends-stats__label">Подписок</span>
          </div>
        </div>
        <div class="friends-actions">
          <a-button type="primary" size="large" block @click="goToFriendsPage">
            <template #icon>
              <BaseIcon
                name="ph:users"
                class="friends-actions__icon"
              />
            </template>
            Управление друзьями
          </a-button>
          <a-button size="large" block @click="goToChatPage">
            <template #icon>
              <BaseIcon name="ph:chat-circle" class="friends-actions__icon" />
            </template>
            Сообщения
          </a-button>
        </div>
      </div>
      <StateBlock
        v-else
        compact
        variant="error"
        icon="ph:wifi-slash"
        title="Не удалось загрузить"
        description="Проверьте соединение и попробуйте снова."
        :actions="[
          {
            label: 'Повторить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: retryFriendsStats,
          },
        ]"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use "../../../../styles/antd-overrides" as *;

.theme-swatches {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  &__item {
    padding: 10px;
    border: 2px solid var(--fv-color-border);
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s ease;

    &--active {
      border-color: var(--fv-color-accent);
    }
  }

  &__chip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    margin-bottom: 7px;
    border-radius: 9px;
    border: 1px solid var(--fv-color-border);
  }

  &__dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }

  &__label {
    font-size: 12px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }
}

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
    color: var(--fv-color-accent);
  }

  &__title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__description {
    color: var(--fv-color-text-secondary);
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  &__stats {
    // Эталон: строки статистики прямо на белой карточке, без серой подложки
    padding: 0;
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
      var(--fv-color-accent) 8%,
      var(--fv-color-bg-primary)
    );
    border: 1px solid
      color-mix(in srgb, var(--fv-color-accent) 22%, var(--fv-color-border));
  }

  &__friends-empty-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-top: 2px;
    color: var(--fv-color-accent);
  }

  &__friends-empty-text {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--fv-color-text-secondary);
  }

}

// Эталон: 3 центрированных тайла в ряд (число + подпись)
.friends-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    text-align: center;
    padding: 0.875rem 0.375rem;
    background: var(--fv-color-bg-secondary);
    border-radius: 14px;
  }

  &__value {
    font-size: 1.5rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    color: var(--fv-color-text-primary);
  }

  &__label {
    font-size: 0.8125rem;
    color: var(--fv-color-text-secondary);
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
