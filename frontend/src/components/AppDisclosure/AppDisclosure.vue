<script setup lang="ts">
import BaseIcon from '@/components/BaseIcon/BaseIcon.vue';
defineProps<{ label: string; open?: boolean }>();
</script>

<template>
  <details class="app-disclosure" :open="open">
    <summary class="app-disclosure__summary">
      <span>{{ label }}</span>
      <BaseIcon class="app-disclosure__icon" name="ph:caret-down" :width="18" :height="18" aria-hidden="true" />
    </summary>
    <div class="app-disclosure__body"><slot /></div>
  </details>
</template>

<style scoped lang="scss">
.app-disclosure {
  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    padding: 8px 0;
    list-style: none;
    color: var(--fv-color-text-primary);
    font-weight: 500;
    cursor: pointer;
    &::-webkit-details-marker { display: none; }
    &::marker { content: ''; }
    &:focus-visible { outline: 2px solid var(--fv-color-accent); outline-offset: 3px; border-radius: 4px; }
  }
  &__icon { flex-shrink: 0; color: var(--fv-color-text-secondary); }
  &[open] > summary .app-disclosure__icon { transform: rotate(180deg); }
  &__body { padding-top: 12px; }
}
</style>
