<script setup lang="ts">
import { Button as AButton } from "ant-design-vue";

withDefaults(
  defineProps<{ count: number; loading?: boolean; label?: string }>(),
  {
    loading: false,
    label: "Показать ещё",
  }
);

const emit = defineEmits<{ loadMore: [] }>();
</script>

<template>
  <AButton
    size="large"
    class="load-more-button"
    :loading="loading"
    @click="emit('loadMore')"
  >
    {{ label }}
    <span class="load-more-button__count">{{ count }}</span>
  </AButton>
</template>

<style scoped lang="scss">
.load-more-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 22px;
  border-radius: var(--fv-radius-control);
  font-weight: 500;

  &__count {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
}
</style>
