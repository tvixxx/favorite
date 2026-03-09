<script setup lang="ts">
import { ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";

const DEFAULT_DEBOUNCE_TIME = 300;

const modelValue = defineModel<[number, number]>({
  default: () => [0, 10],
});

const localRange = ref<[number, number]>([...modelValue.value]);

const debouncedUpdate = useDebounceFn((value: [number, number]) => {
  modelValue.value = value;
}, DEFAULT_DEBOUNCE_TIME);

watch(
  localRange,
  (value) => {
    debouncedUpdate([...value]);
  },
  { deep: true }
);

watch(
  modelValue,
  (value) => {
    if (value[0] !== localRange.value[0] || value[1] !== localRange.value[1]) {
      localRange.value = [...value];
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="rate-filter">
    <span class="rate-filter__label">Рейтинг</span>
    <a-slider
      v-model:value="localRange"
      range
      :min="0"
      :max="10"
      :step="1"
      :marks="{ 0: '0', 5: '5', 10: '10' }"
      class="rate-filter__slider"
    />
  </div>
</template>

<style lang="scss" scoped>
.rate-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 200px;

  &__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
}
</style>
