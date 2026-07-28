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
    <div class="rate-filter__head">
      <span class="rate-filter__label">Рейтинг</span>
      <span class="rate-filter__value">
        {{ localRange[0] }} – {{ localRange[1] }}
      </span>
    </div>
    <a-slider
      v-model:value="localRange"
      range
      :min="0"
      :max="10"
      :step="1"
      class="rate-filter__slider"
    />
  </div>
</template>

<style lang="scss" scoped>
.rate-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  // Текущий диапазон — синяя пилюля справа от лейбла (эталон)
  &__value {
    padding: 1px 10px;
    border-radius: 999px;
    background: var(--fv-color-bg-active-soft);
    color: var(--fv-color-link);
    font-size: 13px;
    font-weight: 500;
  }

  /* Слайдер рейтинга — функциональный синий (эталон UI-кит §08), а не красный primary */
  &__slider {
    margin: 0 8px;

    :deep(.ant-slider-rail) {
      height: 6px;
      border-radius: 999px;
      background: var(--fv-color-bg-secondary);
    }

    :deep(.ant-slider-track) {
      height: 6px;
      background-color: var(--fv-color-accent) !important;
    }

    :deep(.ant-slider-handle::after) {
      box-shadow: 0 0 0 2px var(--fv-color-accent) !important;
    }

    &:hover {
      :deep(.ant-slider-track) {
        background-color: var(--fv-color-accent) !important;
      }

      :deep(.ant-slider-handle::after) {
        box-shadow: 0 0 0 4px var(--fv-color-accent) !important;
      }
    }
  }
}
</style>
