<script setup lang="ts">
interface Props {
  /** Диаметр, px */
  size?: number;
  /** На цветной/тёмной кнопке — белая дуга */
  onDark?: boolean;
}

const { size = 20, onDark = false } = defineProps<Props>();
</script>

<template>
  <span
    class="app-spinner"
    :class="{ 'app-spinner--on-dark': onDark }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="status"
    aria-label="Загрузка"
  ></span>
</template>

<style scoped lang="scss">
/* Точечный спиннер (эталон): трек grey + дуга text-primary */
.app-spinner {
  display: inline-block;
  flex-shrink: 0;
  border: 2.5px solid rgba(188, 195, 208, 0.5);
  border-top-color: var(--fv-color-text-primary);
  border-radius: 50%;
  animation: app-spin 0.75s linear infinite;

  &--on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }
}

@keyframes app-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-spinner {
    animation-duration: 1.4s;
  }
}
</style>
