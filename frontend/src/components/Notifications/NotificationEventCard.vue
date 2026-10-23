<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { Tooltip } from "ant-design-vue";
import { useMediaQuery } from "@vueuse/core";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useDateTime } from "@/composable/useDateTime";
import type { NotificationEvent } from "./center.types";
import { safeNotificationActions } from "./notification-actions";

const props = defineProps<{
  item: NotificationEvent;
  disabled?: boolean;
  compact?: boolean;
}>();

defineEmits<{
  read: [item: NotificationEvent];
  update: [item: NotificationEvent];
  full: [item: NotificationEvent];
  navigate: [item: NotificationEvent, path: string];
}>();

const text = ref<HTMLElement | null>(null);
const truncated = ref(false);
const desktopPointer = useMediaQuery("(hover: hover) and (pointer: fine)");
const actions = computed(() => safeNotificationActions(props.item.actions));
const { formatInstant } = useDateTime();
const kind = computed(() =>
  props.item.source === "system"
    ? { NEWS: "Новости", SERVICE: "Работа сервиса", RELEASE: "Обновление" }[
        props.item.category ?? "NEWS"
      ]
    : props.item.type === "CHAT_MESSAGE"
    ? "Сообщение"
    : "Дружба"
);
let observer: ResizeObserver | undefined;

function measure(): void {
  truncated.value =
    !!text.value && text.value.scrollHeight > text.value.clientHeight + 1;
}

onMounted(() => {
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(measure);
    if (text.value) observer.observe(text.value);
  }

  measure();
});

watch(
  [() => props.item.body, () => props.compact],
  () => void nextTick(measure)
);

onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <article
    class="notification-event"
    :class="{ 'is-read': !!item.readAt, 'is-compact': compact }"
  >
    <span
      class="notification-event__dot"
      :aria-label="item.readAt ? 'Прочитано' : 'Непрочитано'"
    />
    <div class="notification-event__body">
      <div class="notification-event__meta">
        <span>{{ kind }}</span
        ><time :datetime="item.createdAt">{{
          formatInstant(item.createdAt, {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        }}</time>
      </div>
      <h3 v-if="item.source === 'system'">{{ item.title }}</h3>
      <Tooltip
        :title="truncated && desktopPointer ? item.body : undefined"
        placement="topLeft"
        :trigger="['hover', 'focus']"
        :overlay-style="{
          maxWidth: 'min(480px, calc(100vw - 32px))',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }"
      >
        <p
          ref="text"
          class="notification-event__text"
          :tabindex="truncated ? 0 : undefined"
        >
          {{ item.body }}
        </p>
      </Tooltip>
      <div class="notification-event__actions">
        <button
          v-if="truncated"
          type="button"
          :disabled="disabled"
          @click="$emit('full', item)"
        >
          Полный текст
        </button>
        <button
          v-for="action in actions"
          :key="action.path"
          type="button"
          :disabled="disabled"
          @click="$emit('navigate', item, action.path)"
        >
          {{ action.label }}
        </button>
        <button
          v-if="item.category === 'RELEASE'"
          type="button"
          :disabled="disabled"
          @click="$emit('update', item)"
        >
          Проверить обновление
        </button>
      </div>
    </div>
    <button
      v-if="!item.readAt"
      type="button"
      class="notification-event__read"
      aria-label="Отметить событие прочитанным"
      title="Отметить прочитанным"
      :disabled="disabled"
      @click="$emit('read', item)"
    >
      <BaseIcon name="ph:check" :width="18" />
    </button>
  </article>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.notification-event {
  display: grid;
  grid-template-columns: 6px minmax(0, 1fr) auto;
  gap: 10px;
  padding: 18px 0;
  border-bottom: 1px solid var(--fv-color-border);
  color: var(--fv-color-text-primary);
  min-width: 0;
  &:last-child {
    border-bottom: 0;
  }
  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fv-color-brand);
    margin-top: 8px;
  }
  &.is-read &__dot {
    background: var(--fv-color-border);
  }
  &__meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    color: var(--fv-color-text-secondary);
    font-size: 11px;
    margin-bottom: 6px;
  }
  h3 {
    font-size: 14px;
    margin: 0 0 6px;
  }
  &__text {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
  }
  &.is-read &__text {
    color: var(--fv-color-text-secondary);
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-top: 6px;
  }
  &__actions button {
    padding: 4px 0;
    background: transparent;
    border: 0;
    color: var(--fv-color-link);
    font: inherit;
    font-size: 12px;
    min-height: 32px;
    text-align: left;
    cursor: pointer;
  }
  &__read {
    display: grid;
    place-items: center;
    width: 34px;
    height: 36px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &.is-compact {
    padding: 11px 0;
  }
  &.is-compact &__text {
    -webkit-line-clamp: 2;
    font-size: 13px;
  }
}
@include mediaMax(767px) {
  .notification-event {
    gap: 8px;
    &__text {
      font-size: 13px;
    }
    &__read {
      width: 28px;
    }
  }
}
</style>
