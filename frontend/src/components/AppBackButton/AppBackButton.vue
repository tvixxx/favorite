<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import {
  useNavigateBack,
  type NavigateBackPayload,
} from "@/composable/useNavigateBack";

const props = withDefaults(
  defineProps<
    NavigateBackPayload & {
      label?: string;
    }
  >(),
  {
    label: "Назад",
    mode: "history",
  },
);

const { navigateBack } = useNavigateBack();

async function onClick() {
  await navigateBack({
    fallback: props.fallback,
    mode: props.mode,
    beforeNavigate: props.beforeNavigate,
  });
}
</script>

<template>
  <button
    type="button"
    class="app-back-btn"
    :aria-label="label"
    @click="onClick"
  >
    <BaseIcon name="mdi:arrow-left" :width="20" :height="20" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
.app-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 1.5rem 0;
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--ant-color-primary);
    color: var(--ant-color-primary);
    transform: translateX(-4px);
  }
}
</style>
