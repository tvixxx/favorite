<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useChatStore } from "@/stores/chat/chatStore";

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();

// Непрочитанные сообщения для бейджа «Общение»
const socialUnread = computed<number>(() => chatStore.totalUnreadCount);
const socialBadge = computed<string>(() =>
  socialUnread.value > 99 ? "99+" : String(socialUnread.value),
);

interface Tab {
  key: string;
  label: string;
  icon: string;
  iconActive: string;
  to: string;
  /** Бейдж непрочитанного (соцхаб «Общение») */
  badge?: boolean;
}

// Нижняя навигация (мобайл): 4 таба + центральный FAB «+» (создание)
const tabs: Tab[] = [
  {
    key: "library",
    label: "Медиатека",
    icon: "ph:squares-four",
    iconActive: "ph:squares-four-fill",
    to: "/library/collection",
  },
  {
    key: "catalog",
    label: "Каталог",
    icon: "ph:magnifying-glass",
    iconActive: "ph:magnifying-glass",
    to: "/library/catalog",
  },
  {
    key: "social",
    label: "Общение",
    icon: "ph:chats-circle",
    iconActive: "ph:chats-circle-fill",
    to: "/chat",
    badge: true,
  },
  {
    key: "profile",
    label: "Профиль",
    icon: "ph:user",
    iconActive: "ph:user-fill",
    to: "/profile",
  },
];

const activeKey = computed<string>(() => {
  const p = route.path;

  if (p.startsWith("/library/catalog")) {
    return "catalog";
  }

  if (
    p.startsWith("/library") ||
    p.startsWith("/detail") ||
    p.startsWith("/list") ||
    p.startsWith("/my-collection")
  ) {
    return "library";
  }

  if (p.startsWith("/friends") || p.startsWith("/chat")) {
    return "social";
  }

  if (p.startsWith("/profile")) {
    return "profile";
  }

  return "";
});

const leftTabs = computed(() => tabs.slice(0, 2));
const rightTabs = computed(() => tabs.slice(2));

const go = (to: string): void => {
  router.push(to);
};
</script>

<template>
  <nav class="mobile-tabbar" aria-label="Основная навигация">
    <button
      v-for="tab in leftTabs"
      :key="tab.key"
      :data-tour="`tab-${tab.key}`"
      type="button"
      class="mobile-tabbar__tab"
      :class="{ 'mobile-tabbar__tab--active': activeKey === tab.key }"
      @click="go(tab.to)"
    >
      <span class="mobile-tabbar__icon-wrap">
        <BaseIcon
          :name="activeKey === tab.key ? tab.iconActive : tab.icon"
          :width="24"
          :height="24"
        />
        <span
          v-if="tab.badge && socialUnread > 0"
          class="mobile-tabbar__badge"
          >{{ socialBadge }}</span
        >
      </span>
      <span>{{ tab.label }}</span>
    </button>

    <button
      type="button"
      class="mobile-tabbar__fab"
      aria-label="Добавить в коллекцию"
      @click="go('/create')"
    >
      <BaseIcon name="ph:plus" :width="28" :height="28" />
    </button>

    <button
      v-for="tab in rightTabs"
      :key="tab.key"
      :data-tour="`tab-${tab.key}`"
      type="button"
      class="mobile-tabbar__tab"
      :class="{ 'mobile-tabbar__tab--active': activeKey === tab.key }"
      @click="go(tab.to)"
    >
      <span class="mobile-tabbar__icon-wrap">
        <BaseIcon
          :name="activeKey === tab.key ? tab.iconActive : tab.icon"
          :width="24"
          :height="24"
        />
        <span
          v-if="tab.badge && socialUnread > 0"
          class="mobile-tabbar__badge"
          >{{ socialBadge }}</span
        >
      </span>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style lang="scss" scoped>
.mobile-tabbar {
  display: none;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  align-items: flex-start;
  justify-content: space-around;
  height: calc(82px + env(safe-area-inset-bottom, 0px));
  padding: 10px 8px env(safe-area-inset-bottom, 0px);
  background: var(--fv-color-bg-primary);
  border-top: 1px solid var(--fv-color-border);

  // Показываем только на мобиле (десктоп — верхняя шапка)
  @media (max-width: 768px) {
    display: flex;
  }

  &__tab {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 11px;
    color: var(--fv-color-text-tertiary);
    cursor: pointer;
    transition: color var(--fv-motion-fast) var(--fv-ease);

    &--active {
      color: var(--fv-color-brand);
    }
  }

  &__icon-wrap {
    position: relative;
    display: inline-flex;
  }

  &__badge {
    position: absolute;
    top: -5px;
    left: calc(100% - 8px);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    border: 2px solid var(--fv-color-bg-primary);
  }

  &__fab {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    margin-top: -18px;
    border: 0;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    cursor: pointer;
    box-shadow: var(--fv-shadow-brand-md);
    transition:
      transform var(--fv-motion-fast) var(--fv-ease),
      background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: var(--fv-color-brand-hover);
    }

    &:active {
      transform: scale(0.94);
    }
  }
}
</style>
