<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = defineProps<{
  current: number;
  total: number;
  pageSize: number;
  label: string;
  disabled?: boolean;
}>();

defineEmits<{ change: [page: number] }>();

const pages = computed(() =>
  Math.max(1, Math.ceil(props.total / props.pageSize))
);
const start = computed(() =>
  props.total ? (props.current - 1) * props.pageSize + 1 : 0
);
</script>
<template>
  <nav class="notification-pager" :aria-label="label">
    <span
      >{{ start }}–{{ Math.min(current * pageSize, total) }} из
      {{ total }}</span
    >
    <div>
      <button
        type="button"
        :disabled="disabled || current <= 1"
        :aria-label="'Предыдущая страница ' + label"
        @click="$emit('change', current - 1)"
      >
        <BaseIcon name="ph:caret-left" :width="16" />
      </button>
      <span>{{ current }} / {{ pages }}</span>
      <button
        type="button"
        :disabled="disabled || current >= pages"
        :aria-label="'Следующая страница ' + label"
        @click="$emit('change', current + 1)"
      >
        <BaseIcon name="ph:caret-right" :width="16" />
      </button>
    </div>
  </nav>
</template>
<style scoped lang="scss">
.notification-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border-top: 1px solid var(--fv-color-border);
  color: var(--fv-color-text-secondary);
  font-size: 12px;
  > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 40px;
    border: 1px solid var(--fv-color-border);
    border-radius: 8px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
}
</style>
