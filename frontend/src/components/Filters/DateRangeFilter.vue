<script setup lang="ts">
import type { Dayjs } from "dayjs";

const dateRange = defineModel<[Dayjs, Dayjs] | null>();

defineProps<{
  label: string;
  placeholder?: [string, string];
}>();
</script>

<template>
  <div class="date-range-filter">
    <span class="date-range-filter__label">{{ label }}</span>
    <a-range-picker
      v-model:value="dateRange"
      picker="month"
      :placeholder="placeholder ?? ['От', 'До']"
      size="large"
      class="date-range-filter__picker"
      :allow-clear="true"
    />
  </div>
</template>

<style lang="scss" scoped>
.date-range-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__picker {
    min-width: 240px;
  }
}
</style>
