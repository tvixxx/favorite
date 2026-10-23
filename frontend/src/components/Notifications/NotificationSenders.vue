<script setup lang="ts">
import { Input } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import NotificationPager from "./NotificationPager.vue";
import type { NotificationSender } from "./center.types";
import { avatarGradient, avatarLetter } from "@/composable/useAvatarGradient";
import { pluralize } from "@/utils/plural.utils";
defineProps<{
  items: NotificationSender[];
  total: number;
  current: number;
  query: string;
  selectedId?: string;
  loading: boolean;
  error: string;
  disabled: boolean;
}>();

defineEmits<{
  "update:query": [value: string];
  page: [value: number];
  choose: [sender: NotificationSender];
  retry: [];
}>();
</script>
<template>
  <aside class="notification-senders" aria-label="Отправители">
    <header>
      <h2>Отправители</h2>
      <Input
        :value="query"
        aria-label="Найти отправителя"
        placeholder="Найти человека"
        :maxlength="200"
        allow-clear
        @update:value="$emit('update:query', $event)"
      >
        <template #prefix
          ><BaseIcon name="ph:magnifying-glass" :width="18"
        /></template>
      </Input>
      <p>
        {{ pluralize(total, ["отправитель", "отправителя", "отправителей"]) }} ·
        сначала активные
      </p>
    </header>
    <div v-if="error" class="notification-senders__error" role="alert">
      {{ error }}
      <button type="button" @click="$emit('retry')">Повторить</button>
    </div>
    <div class="notification-senders__list" :aria-busy="loading">
      <template v-if="loading && !items.length"
        ><SkeletonBar
          v-for="n in 6"
          :key="n"
          width="100%"
          height="62px"
          radius="10px"
      /></template>
      <button
        v-for="sender in items"
        :key="sender.id"
        type="button"
        class="sender"
        :class="{ 'is-selected': sender.id === selectedId }"
        :disabled="disabled"
        :aria-pressed="sender.id === selectedId"
        :aria-label="'Открыть события ' + sender.name"
        :data-sender="sender.id"
        @click="$emit('choose', sender)"
      >
        <span
          class="sender__avatar"
          :style="{ background: avatarGradient(sender.id) }"
          >{{ avatarLetter(sender.name) }}</span
        >
        <span class="sender__text"
          ><strong>{{ sender.name }}</strong
          ><small>{{ sender.preview }}</small></span
        >
        <span
          class="sender__count"
          :class="{ 'is-unread': sender.unread > 0 }"
          :aria-label="
            sender.unread
              ? 'Непрочитанных: ' + sender.unread
              : 'Всего событий: ' + sender.total
          "
          >{{ sender.unread || sender.total }}</span
        >
      </button>
      <p
        v-if="!loading && !error && !items.length"
        class="notification-senders__empty"
      >
        {{
          query
            ? "Никого не нашли. Проверьте имя."
            : "Событий от пользователей пока нет."
        }}
      </p>
    </div>
    <NotificationPager
      :current="current"
      :total="total"
      :page-size="6"
      label="отправителей"
      :disabled="disabled"
      @change="$emit('page', $event)"
    />
  </aside>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.skel {
  animation: notification-loading-delay 0s 250ms both;
}

@keyframes notification-loading-delay {
  from {
    visibility: hidden;
  }
  to {
    visibility: visible;
  }
}

.notification-senders {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: color-mix(
    in srgb,
    var(--fv-color-bg-primary) 70%,
    var(--fv-color-bg-secondary)
  );
  border-right: 1px solid var(--fv-color-border);
  header {
    padding: 18px 16px 12px;
  }
  h2 {
    font-size: 17px;
    margin: 0 0 12px;
  }
  header p {
    font-size: 11px;
    color: var(--fv-color-text-secondary);
    margin: 10px 0 0;
  }
  &__list {
    padding: 0 8px 8px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  &__empty,
  &__error {
    padding: 16px;
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }
  &__error button {
    color: var(--fv-color-link);
    background: none;
    border: 0;
    cursor: pointer;
  }
}
.sender {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 70px;
  padding: 12px 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--fv-color-text-primary);
  text-align: left;
  cursor: pointer;
  &:hover {
    background: var(--fv-color-bg-hover);
  }
  &:disabled {
    cursor: default;
    opacity: 0.65;
  }
  &.is-selected {
    border-color: color-mix(
      in srgb,
      var(--fv-color-brand) 25%,
      var(--fv-color-border)
    );
    background: color-mix(
      in srgb,
      var(--fv-color-brand) 7%,
      var(--fv-color-bg-primary)
    );
  }
  &__avatar {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    color: white;
    font-weight: 700;
  }
  &__text {
    flex: 1;
    min-width: 0;
  }
  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  strong {
    font-size: 14px;
  }
  small {
    font-size: 12px;
    color: var(--fv-color-text-secondary);
    margin-top: 3px;
  }
  &__count {
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--fv-color-bg-secondary);
    font-size: 11px;
    flex-shrink: 0;
  }
  &__count.is-unread {
    color: var(--fv-color-brand);
    font-weight: 700;
    background: color-mix(
      in srgb,
      var(--fv-color-brand) 9%,
      var(--fv-color-bg-primary)
    );
  }
}
@include mediaMax(767px) {
  .notification-senders {
    border-right: 0;
    background: var(--fv-color-bg-primary);
  }
}
</style>
