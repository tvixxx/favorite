<script setup lang="ts">
import type { NotificationDto } from "@/stores/notifications/types";
import { notificationText } from "@/utils/notificationText";
import { useDateTime } from "@/composable/useDateTime";

defineProps<{ items: NotificationDto[] }>();
defineEmits<{ open: [item: NotificationDto] }>();

const { formatInstant } = useDateTime();
</script>

<template>
  <ul class="notification-list">
    <li v-for="item in items" :key="item.id">
      <button
        type="button"
        class="notification-list__item"
        :class="{ 'is-unread': item.readAt === null }"
        @click="$emit('open', item)"
      >
        <span>{{ notificationText(item) }}</span>
        <time :datetime="item.createdAt">{{
          formatInstant(item.createdAt, {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        }}</time>
      </button>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.notification-list {
  list-style: none;
  margin: 0;
  padding: 0;
  min-width: 0;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 12px;
    border: 0;
    border-radius: 8px;
    color: var(--fv-color-text-primary);
    background: transparent;
    text-align: left;
    font: inherit;
    font-size: 14px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    cursor: pointer;

    &.is-unread {
      background: var(--fv-color-bg-active-soft);
    }
    &:hover {
      background: var(--fv-color-bg-secondary);
    }
    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }

    time {
      font-size: 12px;
      color: var(--fv-color-text-secondary);
    }
  }
}
</style>
