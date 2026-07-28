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
    <BaseIcon name="ph:arrow-left" :width="20" :height="20" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped lang="scss">
.app-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 1.5rem 0;
  padding: 10px 18px;
  border-radius: 12px;
  border: none;
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-low);
  color: var(--fv-color-text-primary);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--fv-motion-slow) var(--fv-ease),
    transform var(--fv-motion-slow) var(--fv-ease),
    box-shadow var(--fv-motion-slow) var(--fv-ease);

  &:hover {
    color: var(--fv-color-accent);
    box-shadow: var(--fv-shadow-elevated);
    transform: translateX(-2px);
  }
}
</style>
