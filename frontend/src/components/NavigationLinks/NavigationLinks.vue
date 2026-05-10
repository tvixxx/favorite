<script setup lang="ts">
import { computed } from "vue";
import { useMainStore } from "@/state/state";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";
import { Badge, Dropdown, Button, Empty, Spin } from "ant-design-vue";
import { BellOutlined } from "@ant-design/icons-vue";
import { INFO_LOGOUT_TEXT } from "@/state/constants";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import type { NotificationDto } from "@/stores/notifications/types";

const router = useRouter();
const route = useRoute();
const store = useMainStore();
const notificationsStore = useNotificationsStore();

const isLoggedIn = computed<boolean>(() => store.isLoggedIn ?? false);
const userId = computed(() => store.userData?.id ?? "");

const selectedKeys = computed(() => {
  const path = route.path;

  if (path.startsWith("/profile")) {
    return ["profile"];
  }

  if (path.startsWith("/create")) {
    return ["create"];
  }

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

  return [];
});

const signOut = (): void => {
  store.logOut();
  message.info(INFO_LOGOUT_TEXT);
  router.push("/login");
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
  <a-layout-header class="navigation">
    <a-menu
      v-if="isLoggedIn"
      theme="dark"
      mode="horizontal"
      :selected-keys="selectedKeys"
      :style="{ lineHeight: '64px' }"
    >
      <a-menu-item key="profile" @click="router.push('/profile')">
        Профиль
      </a-menu-item>

      <a-menu-item key="create" @click="router.push('/create')">
        Добавить
      </a-menu-item>

      <a-menu-item
        key="library"
        @click="router.push('/library/collection')"
      >
        <span class="navigation__tour-anchor" data-tour="nav-library">
          Медиатека
        </span>
      </a-menu-item>

      <a-menu-item key="favorites" @click="router.push('/favorites')">
        Избранное
      </a-menu-item>

      <a-menu-item key="leaderboard" @click="router.push('/leaderboard')">
        Топ
      </a-menu-item>

      <a-menu-item key="notifications" class="navigation__notifications">
        <a-dropdown
          trigger="click"
          placement="bottomRight"
          @open-change="onDropdownOpenChange"
        >
          <span
            class="navigation__bell-wrap"
            data-tour="nav-notifications"
            role="button"
            tabindex="0"
            aria-label="Уведомления"
          >
            <Badge :count="notificationsStore.unreadCount" :overflow-count="99">
              <BellOutlined class="navigation__bell-icon" />
            </Badge>
          </span>

          <template #overlay>
            <div class="navigation__notifications-panel">
              <div class="navigation__notifications-head">
                <span class="navigation__notifications-title">Уведомления</span>
                <Button
                  v-if="notificationsStore.items.some((i) => i.readAt === null)"
                  type="link"
                  size="small"
                  @click="handleMarkAllRead"
                >
                  Прочитать все
                </Button>
              </div>

              <Spin v-if="notificationsStore.isLoading" size="small" />

              <Empty
                v-else-if="notificationsStore.items.length === 0"
                class="navigation__notifications-empty"
                description="Пока пусто"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />

              <ul
                v-else
                class="navigation__notifications-list"
                role="list"
              >
                <li
                  v-for="n in notificationsStore.items"
                  :key="n.id"
                  role="listitem"
                  class="navigation__notifications-item"
                  :class="{
                    'navigation__notifications-item--unread': n.readAt === null,
                  }"
                  @click="handleNotificationClick(n)"
                >
                  <span class="navigation__notifications-text">{{
                    summary(n)
                  }}</span>
                  <span class="navigation__notifications-time">{{
                    new Date(n.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}</span>
                </li>
              </ul>
            </div>
          </template>
        </a-dropdown>
      </a-menu-item>

      <a-menu-item class="navigation__sign-out" key="signout">
        <a-button type="primary" @click.prevent="signOut" aria-label="Sign out">
          Выход
        </a-button>
      </a-menu-item>
    </a-menu>

    <a-menu
      v-else
      theme="dark"
      mode="horizontal"
      :selected-keys="selectedKeys"
      :style="{ lineHeight: '64px' }"
    >
      <a-menu-item key="login" @click="router.push('/login')">
        Login
      </a-menu-item>
    </a-menu>
  </a-layout-header>
</template>

<style lang="scss">
.navigation {
  box-sizing: border-box;
  width: 100%;

  .ant-menu-overflow-item.ant-menu-item {
    border-radius: 0;
  }

  &__notifications {
    margin-left: auto !important;
  }

  &__sign-out {
    margin-left: 0 !important;
  }

  &__tour-anchor {
    display: inline-block;
    vertical-align: middle;
  }

  &__bell-wrap {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    padding: 0 4px;
    color: var(--nav-accent-icon);

    :deep(.ant-badge .anticon),
    :deep(.anticon) {
      color: var(--nav-accent-icon);
    }

    :deep(.anticon svg) {
      fill: currentColor;
    }
  }

  &__bell-icon {
    font-size: 18px;
    color: var(--nav-accent-icon);
    vertical-align: middle;

    :deep(svg) {
      fill: currentColor;
    }
  }

  &__notifications-panel {
    width: min(360px, calc(100vw - 24px));
    max-height: 70vh;
    padding: 12px;
    overflow: auto;
    background: var(--color-bg-container, #fff);
    color: rgba(0, 0, 0, 0.88);
    border-radius: 8px;
    box-shadow:
      0 6px 16px 0 rgba(0, 0, 0, 0.08),
      0 3px 6px -4px rgba(0, 0, 0, 0.12),
      0 9px 28px 8px rgba(0, 0, 0, 0.05);
  }

  &__notifications-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__notifications-title {
    font-weight: 600;
    font-size: 14px;
  }

  &__notifications-empty {
    margin: 16px 0;
  }

  &__notifications-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__notifications-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 8px;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    &--unread {
      background: rgba(22, 119, 255, 0.08);
    }
  }

  &__notifications-text {
    font-size: 13px;
    line-height: 1.35;
    word-break: break-word;
  }

  &__notifications-time {
    font-size: 11px;
    opacity: 0.55;
  }
}
</style>
