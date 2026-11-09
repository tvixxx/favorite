<script lang="ts" setup>
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
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
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { useUserMoviesStore, useFriendsStore } from "@/stores";
import { useMainStore } from "@/state/state";
import {
  PROFILE_THEME_META,
  STAT_BLOCK_TITLES,
} from "@/components/ProfileSettings/constants";
import { useRouter } from "vue-router";
import { PLURAL, pluralForm } from "@/utils/plural.utils";

const userMoviesStore = useUserMoviesStore();
const friendsStore = useFriendsStore();
const mainStore = useMainStore();
const router = useRouter();

const props = defineProps<SettingBlockProps & { hideHeading?: boolean }>();
const emit = defineEmits<{ themeSelected: [] }>();
const isTheme = computed(() => props.type === "theme");
const isStats = computed(() => props.type === "stats");
const isFriends = computed(() => props.type === "friends");

const userId = computed(() => mainStore.userData?.id || "");

const themeSwatches = themes.map((value) => ({
  value,
  ...PROFILE_THEME_META[value],
}));

const selectTheme = (theme: Theme): void => {
  setTheme(theme);
  emit("themeSelected");
};

const stats = computed(() => {
  const data = userMoviesStore.stats;

  // Эталон: «Смотреть позже» в статистике не показываем (есть в аналитике/коллекции)
  const keys = (Object.keys(StatsBlockType) as StatsBlockType[]).filter(
    (type) => type !== StatsBlockType.totalSeeLater
  );

  return keys.map((type) => ({
    type,
    title: STAT_BLOCK_TITLES[type],
    value: data?.[type] ?? 0,
  })) satisfies StatsBlockItem[];
});

const isStatsLoading = computed(
  () => userMoviesStore.isStatsLoading && !userMoviesStore.stats
);
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
const showFriendsSkeleton = computed(
  () =>
    (friendsStatsLoading.value || friendsStore.isLoading) && !friendsStore.stats
);

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
    <SectionHeading
      v-if="!props.hideHeading"
      class="setting-block__header"
      :title="props.title"
      :icon="props.icon"
      tag="h3"
    />

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
        :aria-pressed="currentTheme === t.value"
        @click="selectTheme(t.value)"
      >
        <span
          class="theme-swatches__dot"
          :style="{ background: t.accent }"
          aria-hidden="true"
        />
        <span class="theme-swatches__label">{{ t.label }}</span>
        <BaseIcon
          v-if="currentTheme === t.value"
          class="theme-swatches__selected"
          name="ph:check-bold"
          :width="16"
          :height="16"
          aria-hidden="true"
        />
      </button>
    </div>

    <div v-if="isStats" class="setting-block__stats">
      <StateBlock
        v-if="!isStatsLoading && (isStatsFailed || !userMoviesStore.stats)"
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
        <StatsBlock :items="stats" :loading="isStatsLoading" />
      </div>
    </div>

    <div
      v-if="isFriends"
      class="setting-block__friends"
      :aria-busy="showFriendsSkeleton || undefined"
    >
      <div
        v-if="showFriendsSkeleton || friendsStore.stats"
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
        <div v-if="friendsStore.stats" class="friends-stats">
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.friendsCount
            }}</span>
            <span class="friends-stats__label">{{
              pluralForm(friendsStore.stats.friendsCount, PLURAL.friend)
            }}</span>
          </div>
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.subscribersCount
            }}</span>
            <span class="friends-stats__label">{{
              pluralForm(friendsStore.stats.subscribersCount, PLURAL.subscriber)
            }}</span>
          </div>
          <div class="friends-stats__item">
            <span class="friends-stats__value">{{
              friendsStore.stats.subscriptionsCount
            }}</span>
            <span class="friends-stats__label">{{
              pluralForm(
                friendsStore.stats.subscriptionsCount,
                PLURAL.subscription
              )
            }}</span>
          </div>
        </div>
        <div v-else class="friends-stats" aria-hidden="true">
          <SkeletonBar width="42px" height="12px" radius="5px" />
          <SkeletonBar width="93px" height="12px" radius="5px" />
          <SkeletonBar width="72px" height="12px" radius="5px" />
        </div>
        <div
          class="friends-actions"
          :class="{ 'friends-actions--loading': showFriendsSkeleton }"
          :aria-hidden="showFriendsSkeleton || undefined"
        >
          <a-button
            size="large"
            :disabled="showFriendsSkeleton"
            @click="goToFriendsPage"
          >
            <template #icon>
              <BaseIcon name="ph:users" class="friends-actions__icon" />
            </template>
            Друзья
            <SkeletonBar
              v-if="showFriendsSkeleton"
              class="friends-actions__skeleton"
              height="100%"
              radius="var(--fv-radius-control)"
            />
          </a-button>
          <a-button
            size="large"
            :disabled="showFriendsSkeleton"
            @click="goToChatPage"
          >
            <template #icon>
              <BaseIcon name="ph:chat-circle" class="friends-actions__icon" />
            </template>
            Сообщения
            <SkeletonBar
              v-if="showFriendsSkeleton"
              class="friends-actions__skeleton"
              height="100%"
              radius="var(--fv-radius-control)"
            />
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
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-control);
    background: var(--fv-color-bg-primary);
    text-align: left;
    font: inherit;
    color: var(--fv-color-text-primary);
    cursor: pointer;
    transition: border-color var(--fv-motion-fast) var(--fv-ease);

    &--active {
      border-color: var(--fv-color-accent);
      background: color-mix(
        in srgb,
        var(--fv-color-accent) 12%,
        var(--fv-color-bg-primary)
      );
      font-weight: 700;
    }

    &:hover {
      border-color: var(--fv-color-accent);
    }
  }

  &__dot {
    flex: none;
    width: 14px;
    height: 14px;
    border: 1px solid var(--fv-color-border);
    border-radius: 50%;
  }

  &__label {
    overflow-wrap: anywhere;
  }

  &__selected {
    flex: none;
    margin-left: auto;
    color: var(--fv-color-accent);
  }
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__header {
    margin-bottom: 0.5rem;
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
    // Эталон: плитки и кнопки лежат прямо на карточке, серые только сами плитки
    padding: 0;
  }

  &__friends-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-height: 24px;
  gap: 4px 10px;

  &__item {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__value {
    font-weight: 700;
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
  flex-wrap: wrap;
  gap: 8px;

  &--loading :deep(.ant-btn.ant-btn-lg) {
    position: relative;
    overflow: hidden;
    color: transparent;
    border-color: transparent;
  }

  &__skeleton {
    position: absolute;
    inset: 0;
  }

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
    max-width: 100%;
    border-radius: var(--fv-radius-control);
    border-color: var(--fv-color-border);
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: normal;
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
