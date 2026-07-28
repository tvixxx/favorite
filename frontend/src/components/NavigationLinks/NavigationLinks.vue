<script setup lang="ts">
import { computed, ref } from "vue";
import { useMainStore } from "@/state/state";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { BellOutlined } from "@ant-design/icons-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { INFO_LOGOUT_TEXT } from "@/state/constants";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useChatStore } from "@/stores/chat/chatStore";
import type { NotificationDto } from "@/stores/notifications/types";
import { currentTheme, setTheme, themes, type Theme } from "@/composable";
import { createOnboardingDriver } from "@/onboarding/createOnboardingDriver";
import { setOnboardingDone } from "@/composable/useOnboarding";

const router = useRouter();
const route = useRoute();
const store = useMainStore();
const notificationsStore = useNotificationsStore();
const chatStore = useChatStore();

// Непрочитанные сообщения для бейджа «Общение»
const socialUnread = computed<number>(() => chatStore.totalUnreadCount);
const socialBadge = computed<string>(() =>
  socialUnread.value > 99 ? "99+" : String(socialUnread.value),
);

const isLoggedIn = computed<boolean>(() => store.isLoggedIn ?? false);
const userId = computed(() => store.userData?.id ?? "");

const drawerOpen = ref(false);
const accountMenuOpen = ref(false);

interface NavItem {
  key: string;
  label: string;
  to: string;
  tour?: string;
  /** Показывать бейдж непрочитанного (соцхаб «Общение») */
  badge?: boolean;
}

// Консолидированная навигация (COMPONENTS.md §1): только контентные разделы.
// «Профиль» — в меню аккаунта, «Добавить» — кнопка в тулбаре Медиатеки.
const navItems: NavItem[] = [
  { key: "library", label: "Медиатека", to: "/library/collection", tour: "nav-library" },
  { key: "favorites", label: "Избранное", to: "/favorites" },
  { key: "leaderboard", label: "Топ", to: "/leaderboard" },
  { key: "social", label: "Общение", to: "/chat", badge: true },
];

const THEME_LABELS: Record<Theme, string> = {
  light: "Светлая",
  dark: "Тёмная",
  emerald: "Изумруд",
  corporate: "Деловая",
  synthwave: "Synthwave",
  retro: "Ретро",
  cyberpunk: "Cyberpunk",
};

// Свотч показывает канву темы и точкой — её акцент (эталон)
const THEME_SWATCHES: Record<Theme, { bg: string; accent: string }> = {
  light: { bg: "#ffffff", accent: "#ff0032" },
  dark: { bg: "#141414", accent: "#ff3355" },
  emerald: { bg: "#f0fdf4", accent: "#10b981" },
  corporate: { bg: "#f8fafc", accent: "#1e40af" },
  synthwave: { bg: "#0f0f23", accent: "#ec4899" },
  retro: { bg: "#fef3c7", accent: "#f59e0b" },
  cyberpunk: { bg: "#1e1b4b", accent: "#8b5cf6" },
};

const themeSwatches = themes.map((value) => ({
  value,
  label: THEME_LABELS[value],
  ...THEME_SWATCHES[value],
}));

const fullName = computed<string>(() => store.userData?.fullName?.trim() ?? "");
const email = computed<string>(() => store.userData?.email?.trim() ?? "");

const initials = computed<string>(() => {
  const name = fullName.value;

  if (!name) {
    return "";
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";

  return (first + second).toUpperCase();
});

const selectedKeys = computed(() => {
  const path = route.path;

  if (
    path.startsWith("/library") ||
    path.startsWith("/my-collection") ||
    path.startsWith("/list") ||
    path.startsWith("/catalog")
  ) {
    return ["library"];
  }

  if (path.startsWith("/favorites")) {
    return ["favorites"];
  }

  if (path.startsWith("/leaderboard")) {
    return ["leaderboard"];
  }

  // Соцхаб: «Общение» активен и на Чате, и на Друзьях
  if (path.startsWith("/chat") || path.startsWith("/friends")) {
    return ["social"];
  }

  return [];
});

const goTo = (to: string): void => {
  router.push(to);
  drawerOpen.value = false;
  accountMenuOpen.value = false;
};

const signOut = (): void => {
  drawerOpen.value = false;
  accountMenuOpen.value = false;
  store.logOut();
  message.info(INFO_LOGOUT_TEXT);
  router.push("/login");
};

const startOnboarding = (): void => {
  accountMenuOpen.value = false;

  const tourDriver = createOnboardingDriver(router, {
    onCompleted: () => {
      if (userId.value) {
        setOnboardingDone(userId.value);
      }
    },
  });

  tourDriver.drive();
};

const summary = (n: NotificationDto): string => {
  const p = n.payload;

  switch (n.type) {
    case "CHAT_MESSAGE": {
      const name = String(p.senderName ?? "Сообщение");
      const preview = String(p.preview ?? "").trim();

      if (preview) {
        return `${name}: ${preview}`;
      }

      return name;
    }

    case "FRIEND_REQUEST": {
      const name = String(p.requesterName ?? "Пользователь");

      return `${name} хочет добавить вас в друзья`;
    }

    case "FRIEND_ACCEPTED": {
      const name = String(p.friendName ?? "Друг");

      return `${name} принял(а) вашу заявку`;
    }

    default:
      return "Уведомление";
  }
};

const onDropdownOpenChange = async (open: boolean) => {
  if (!open || !userId.value) {
    return;
  }

  try {
    await notificationsStore.fetchNotifications(userId.value);
    await notificationsStore.fetchUnreadCount(userId.value);
  } catch {
    // ignore
  }
};

const retryNotifications = (): void => {
  if (userId.value) {
    void notificationsStore.fetchNotifications(userId.value);
  }
};

const handleNotificationClick = async (n: NotificationDto) => {
  const uid = userId.value;

  if (!uid) {
    return;
  }

  try {
    if (n.readAt === null) {
      await notificationsStore.markRead(uid, n.id);
    }
  } catch {
    // ignore
  }

  if (n.type === "CHAT_MESSAGE") {
    const sid = String(n.payload.senderId ?? "");

    if (sid) {
      router.push(`/chat/${sid}`);
    } else {
      router.push("/chat");
    }
  } else {
    router.push("/friends");
  }
};

const handleMarkAllRead = async () => {
  const uid = userId.value;

  if (!uid) {
    return;
  }

  try {
    await notificationsStore.markAllRead(uid);
  } catch {
    // ignore
  }
};
</script>

<template>
  <header v-if="isLoggedIn" class="topbar">
    <div class="topbar__inner">
    <a class="topbar__logo" @click="router.push('/library/collection')">
      <span class="topbar__logo-mark">
        <BaseIcon name="ph:film-slate-fill" :width="19" :height="19" />
      </span>
      favorite
    </a>

    <nav class="topbar__nav">
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        class="topbar__nav-link"
        :class="{ 'is-active': selectedKeys.includes(item.key) }"
        @click="router.push(item.to)"
      >
        <span v-if="item.tour" :data-tour="item.tour">{{ item.label }}</span>
        <template v-else>{{ item.label }}</template>
        <span
          v-if="item.badge && socialUnread > 0"
          class="topbar__nav-badge"
          >{{ socialBadge }}</span
        >
      </button>
    </nav>

    <div class="topbar__actions">
      <!-- Колокольчик уведомлений — логика notificationsStore без изменений -->
      <a-dropdown
        trigger="click"
        placement="bottomRight"
        @open-change="onDropdownOpenChange"
      >
        <span
          class="topbar__icon-btn topbar__bell"
          data-tour="nav-notifications"
          role="button"
          tabindex="0"
          aria-label="Уведомления"
        >
          <BellOutlined class="topbar__bell-icon" />
          <span
            v-if="notificationsStore.unreadCount > 0"
            class="topbar__bell-dot"
            aria-hidden="true"
          ></span>
        </span>

        <template #overlay>
          <div class="notif-panel">
            <div class="notif-panel__head">
              <span class="notif-panel__title">Уведомления</span>
              <a-button
                v-if="notificationsStore.items.some((i) => i.readAt === null)"
                type="link"
                size="small"
                @click="handleMarkAllRead"
              >
                Прочитать все
              </a-button>
            </div>

            <div v-if="notificationsStore.isLoading" class="notif-panel__loading">
              <div
                v-for="n in 4"
                :key="`notif-skel-${n}`"
                class="notif-panel__skel-row"
              >
                <SkeletonBar height="12px" width="80%" radius="6px" />
                <SkeletonBar height="10px" width="45%" radius="6px" />
              </div>
            </div>

            <StateBlock
              v-else-if="notificationsStore.isError"
              class="notif-panel__empty"
              compact
              variant="error"
              icon="ph:warning-circle"
              title="Не удалось загрузить"
              :actions="[
                {
                  label: 'Повторить',
                  icon: 'ph:arrow-clockwise',
                  kind: 'primary',
                  onClick: retryNotifications,
                },
              ]"
            />

            <StateBlock
              v-else-if="notificationsStore.items.length === 0"
              class="notif-panel__empty"
              compact
              v-bind="STATE_PRESETS.notificationsEmpty"
            />

            <ul v-else class="notif-panel__list" role="list">
              <li
                v-for="n in notificationsStore.items"
                :key="n.id"
                role="listitem"
                class="notif-panel__item"
                :class="{
                  'notif-panel__item--unread': n.readAt === null,
                }"
                @click="handleNotificationClick(n)"
              >
                <span class="notif-panel__text">{{ summary(n) }}</span>
                <span class="notif-panel__time">{{
                  new Date(n.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }}</span>
              </li>
            </ul>
          </div>
        </template>
      </a-dropdown>

      <!-- Аватар → меню аккаунта (Профиль · Помощь · Цветовая тема · Выйти) -->
      <a-dropdown
        v-model:open="accountMenuOpen"
        trigger="click"
        placement="bottomRight"
      >
        <button
          type="button"
          class="topbar__avatar-btn"
          aria-label="Меню аккаунта"
        >
          <a-avatar
            class="topbar__avatar"
            :style="{ background: 'linear-gradient(135deg, #3a6ff0, #1b2a6b)' }"
          >
            {{ initials }}
          </a-avatar>
        </button>

        <template #overlay>
          <div class="acctmenu">
            <div class="acctmenu__head">
              <a-avatar
                class="acctmenu__avatar"
                :style="{ background: 'linear-gradient(135deg, #3a6ff0, #1b2a6b)' }"
              >
                {{ initials }}
              </a-avatar>
              <div class="acctmenu__id">
                <span class="acctmenu__name">{{ fullName || "Профиль" }}</span>
                <span v-if="email" class="acctmenu__email">{{ email }}</span>
              </div>
            </div>

            <div class="acctmenu__divider"></div>

            <button class="acctmenu__item" @click="goTo('/profile')">
              <BaseIcon name="ph:user" :width="18" :height="18" />
              <span>Профиль</span>
            </button>
            <button class="acctmenu__item" @click="startOnboarding">
              <BaseIcon name="ph:question" :width="18" :height="18" />
              <span>Помощь и онбординг</span>
            </button>
            <button class="acctmenu__item" @click="goTo('/feedback')">
              <BaseIcon name="ph:megaphone" :width="18" :height="18" />
              <span>Обратная связь</span>
            </button>

            <div class="acctmenu__divider"></div>

            <div class="acctmenu__section-label">Цветовая тема</div>
            <div class="acctmenu__themes">
              <button
                v-for="t in themeSwatches"
                :key="t.value"
                type="button"
                class="acctmenu__theme"
                :class="{ 'is-active': currentTheme === t.value }"
                @click="setTheme(t.value)"
              >
                <span
                  class="acctmenu__swatch"
                  :style="{ background: t.bg, '--swatch-accent': t.accent }"
                ></span>
                <span class="acctmenu__theme-label">{{ t.label }}</span>
                <BaseIcon
                  v-if="currentTheme === t.value"
                  name="ph:check-circle"
                  class="acctmenu__check"
                  :width="18"
                  :height="18"
                />
              </button>
            </div>

            <div class="acctmenu__divider"></div>

            <button class="acctmenu__item acctmenu__signout" @click="signOut">
              <BaseIcon name="ph:sign-out" :width="18" :height="18" />
              <span>Выйти</span>
            </button>
          </div>
        </template>
      </a-dropdown>

      <!-- Бургер для мобильных -->
      <button
        type="button"
        class="topbar__burger"
        aria-label="Меню"
        @click="drawerOpen = true"
      >
        <BaseIcon name="ph:list" :width="24" :height="24" />
      </button>
    </div>

    </div>

    <a-drawer
      v-model:open="drawerOpen"
      placement="right"
      title="Меню"
      :width="260"
    >
      <nav class="drawer-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="drawer-nav__link"
          :class="{ 'is-active': selectedKeys.includes(item.key) }"
          @click="goTo(item.to)"
        >
          {{ item.label }}
          <span
            v-if="item.badge && socialUnread > 0"
            class="drawer-nav__badge"
            >{{ socialBadge }}</span
          >
        </button>

        <div class="drawer-nav__divider"></div>

        <button
          type="button"
          class="drawer-nav__link drawer-nav__link_feedback"
          :class="{ 'is-active': route.path.startsWith('/feedback') }"
          @click="goTo('/feedback')"
        >
          <BaseIcon name="ph:megaphone" :width="18" :height="18" />
          Обратная связь
        </button>
      </nav>
    </a-drawer>
  </header>

  <header v-else class="topbar topbar--auth">
    <div class="topbar__inner">
      <a class="topbar__logo" @click="router.push('/login')">favorite</a>

      <div class="topbar__actions">
        <a-button type="primary" @click="router.push('/login')">Войти</a-button>
      </div>
    </div>
  </header>
</template>

<style lang="scss">
@use "@/styles/scrollbar" as *;

.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  box-sizing: border-box;
  width: 100%;
  background: color-mix(in srgb, var(--fv-color-bg-primary) 92%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--fv-color-border);

  // Полоса шапки — во всю ширину, а её содержимое живёт в сетке 1200,
  // как и страницы. Раньше ограничение стояло на самой шапке, и по краям
  // проступала канва (на тёмной теме это выглядело как белые поля)
  &__inner {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 24px;
    width: 100%;
    max-width: calc(var(--fv-layout-max-width) + var(--fv-layout-gutter) * 2);
    height: 66px;
    margin: 0 auto;
    padding: 0 var(--fv-layout-gutter);
  }

  &__logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    font-family: var(--fv-font-display);
    font-weight: 700;
    font-size: 19px;
    letter-spacing: -0.3px;
    color: var(--fv-color-text-primary);
    text-decoration: none;
    cursor: pointer;
    user-select: none;
  }

  &__logo-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--fv-color-brand);
    color: #fff;
  }

  &__nav {
    display: flex;
    align-items: center;
    gap: 22px;
  }

  &__nav-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 66px;
    padding: 0 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    font: inherit;
    font-size: 15px;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition: color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      color: var(--fv-color-text-primary);
    }

    &.is-active {
      color: var(--fv-color-text-primary);
      font-weight: 500;
      border-bottom-color: var(--fv-color-brand);
    }
  }

  &__nav-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  &__icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      color: var(--fv-color-text-primary);
      background: var(--fv-color-bg-secondary);
    }
  }

  // Эталон: не число, а точка с обводкой под цвет шапки
  &__bell-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 9px;
    height: 9px;
    border: 2px solid var(--fv-color-bg-primary);
    border-radius: 50%;
    background: var(--fv-color-brand);
  }

  &__bell-icon {
    font-size: 21px;
    color: inherit;

    :deep(svg) {
      fill: currentColor;
    }
  }

  &__avatar-btn {
    display: inline-flex;
    padding: 0;
    border: 0;
    background: none;
    border-radius: 999px;
    cursor: pointer;
  }

  &__avatar {
    flex-shrink: 0;
    color: #fff !important;
    font-weight: 500;
  }

  &__burger {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
  }
}

/* Меню аккаунта (телепортируется в body — стили глобальные) */
.acctmenu {
  min-width: 260px;
  padding: 8px;
  background: var(--fv-color-bg-primary);
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-md);
  box-shadow: var(--fv-shadow-modal);

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px 12px;
  }

  &__avatar {
    flex-shrink: 0;
    color: #fff !important;
    font-weight: 500;
  }

  &__id {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 500;
    font-size: 14px;
    color: var(--fv-color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__email {
    font-size: 12px;
    color: var(--fv-color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__divider {
    height: 1px;
    margin: 4px 0;
    background: var(--fv-color-border);
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    font: inherit;
    font-size: 14px;
    color: var(--fv-color-text-primary);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }
  }

  &__signout {
    color: var(--fv-color-brand);
  }

  &__section-label {
    text-transform: none;
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fv-color-text-secondary);
  }

  &__themes {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__theme {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    font: inherit;
    color: var(--fv-color-text-primary);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }

    &.is-active {
      background: var(--fv-color-bg-active-soft);
    }
  }

  &__swatch {
    position: relative;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid var(--fv-color-border);

    // Точка акцента в правом нижнем углу — как в эталоне
    &::after {
      content: "";
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: var(--swatch-accent, transparent);
    }
  }

  &__theme-label {
    flex: 1;
    font-size: 13px;
  }

  &__check {
    color: var(--fv-color-link);
  }
}

/* Панель уведомлений (телепортируется в body — стили глобальные) */
.notif-panel {
  width: min(344px, calc(100vw - 24px));
  max-height: 70vh;
  padding: 8px;
  overflow: auto;

  @include customScrollbar();
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  border: 1px solid var(--fv-color-border);
  border-radius: 14px;
  box-shadow: var(--fv-shadow-modal);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__title {
    font-weight: 700;
    font-size: 16px;
  }

  &__empty {
    margin: 16px 0;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 4px;
  }

  &__skel-row {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 8px;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }

    &--unread {
      background: color-mix(
        in srgb,
        var(--fv-color-accent) 10%,
        transparent
      );
    }
  }

  &__text {
    font-size: 13px;
    line-height: 1.35;
    word-break: break-word;
  }

  &__time {
    font-size: 11px;
    opacity: 0.55;
  }
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border: 0;
    border-radius: 10px;
    background: none;
    font: inherit;
    font-size: 16px;
    color: var(--fv-color-text-primary);
    text-align: left;
    cursor: pointer;

    &.is-active {
      color: var(--fv-color-brand);
      background: var(--fv-color-bg-active-soft);
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
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  &__signout {
    margin-top: 12px;
  }
  &__divider {
    height: 1px;
    margin: 8px 4px;
    background: var(--fv-color-border);
  }

  // Пункт с иконкой (эталон: последний пункт бургера)
  &__link_feedback {
    display: flex;
    align-items: center;
    gap: 11px;
  }

}

@media (max-width: 768px) {
  .topbar {
    gap: 12px;
  }

  .topbar__nav {
    display: none;
  }

  .topbar__burger {
    display: inline-flex;
  }
}
</style>
