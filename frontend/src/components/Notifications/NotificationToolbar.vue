<script setup lang="ts">
import { Input } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { NotificationSection, NotificationView } from "./center.types";
defineProps<{
  section: NotificationSection;
  query: string;
  view: NotificationView;
  kind: string;
  category: string;
  unreadOnly: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  "update:query": [value: string];
  "update:view": [value: NotificationView];
  "update:kind": [value: string];
  "update:category": [value: string];
  "update:unreadOnly": [value: boolean];
}>();

const views = [
  { id: "list", label: "Список", icon: "ph:list-bullets" },
  { id: "compact", label: "Компактно", icon: "ph:rows" },
  { id: "grid", label: "Карточки", icon: "ph:squares-four" },
] as const;
</script>
<template>
  <div class="notification-toolbar">
    <div class="notification-toolbar__top">
      <Input
        :value="query"
        placeholder="Текст события"
        aria-label="Поиск по событиям"
        :maxlength="200"
        allow-clear
        @update:value="$emit('update:query', $event)"
        ><template #prefix
          ><BaseIcon name="ph:magnifying-glass" :width="18" /></template
      ></Input>
      <div
        class="notification-toolbar__views"
        role="group"
        aria-label="Вид событий"
      >
        <button
          v-for="option in views"
          :key="option.id"
          type="button"
          :aria-label="option.label"
          :title="option.label"
          :aria-pressed="view === option.id"
          @click="$emit('update:view', option.id)"
        >
          <BaseIcon :name="option.icon" :width="18" />
        </button>
      </div>
    </div>
    <div class="notification-toolbar__bottom">
      <div class="notification-toolbar__filters">
        <template v-if="section === 'people'"
          ><button
            v-for="option in [
              { id: '', label: 'Все события' },
              { id: 'chat', label: 'Сообщения' },
              { id: 'friends', label: 'Дружба' },
            ]"
            :key="option.id"
            type="button"
            :disabled="disabled"
            :aria-pressed="kind === option.id"
            @click="$emit('update:kind', option.id)"
          >
            {{ option.label }}
          </button></template
        >
        <template v-else
          ><button
            v-for="option in [
              { id: '', label: 'Все' },
              { id: 'NEWS', label: 'Новости' },
              { id: 'SERVICE', label: 'Работа сервиса' },
              { id: 'RELEASE', label: 'Обновления' },
            ]"
            :key="option.id"
            type="button"
            :disabled="disabled"
            :aria-pressed="category === option.id"
            @click="$emit('update:category', option.id)"
          >
            {{ option.label }}
          </button></template
        >
      </div>
      <label
        ><input
          type="checkbox"
          :checked="unreadOnly"
          :disabled="disabled"
          @change="
            $emit(
              'update:unreadOnly',
              ($event.target as HTMLInputElement).checked
            )
          "
        />Только непрочитанные</label
      >
    </div>
  </div>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.notification-toolbar {
  padding: 18px 22px 14px;
  &__top {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    align-items: center;
  }
  &__top > .ant-input-affix-wrapper {
    min-width: 0;
    max-width: 330px;
  }
  &__views {
    display: flex;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--fv-color-border);
    border-radius: 10px;
    flex-shrink: 0;
  }
  &__views button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 34px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
  }
  &__views button[aria-pressed="true"],
  &__filters button[aria-pressed="true"] {
    background: var(--fv-color-text-primary);
    color: var(--fv-color-bg-primary);
  }
  &__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  &__filters button {
    min-height: 34px;
    border: 1px solid var(--fv-color-border);
    border-radius: 7px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    padding: 4px 9px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: var(--fv-color-text-secondary);
    min-height: 32px;
  }
  input[type="checkbox"] {
    accent-color: var(--fv-color-brand);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
@include mediaMax(767px) {
  .notification-toolbar {
    padding: 14px;
    &__filters button,
    label {
      font-size: 11px;
    }
    &__views button {
      width: 28px;
    }
  }
}
</style>
