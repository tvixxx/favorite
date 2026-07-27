<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { onClickOutside } from "@vueuse/core";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { WatchStatus } from "@/stores";

/**
 * Селект статуса просмотра (эталон, вариант 1c): строка-триггер 46px с цветной
 * точкой + выпадающее меню из четырёх статусов. Заменяет сегмент-контрол и
 * сетку 2×2 (отклонённые варианты).
 */

const modelValue = defineModel<WatchStatus>({ required: true });

const { disabled = false } = defineProps<{ disabled?: boolean }>();

const STATUS_ITEMS: Array<{ value: WatchStatus; label: string; dot: string }> = [
  {
    value: WatchStatus.NOT_STARTED,
    label: "Не начато",
    dot: "var(--fv-color-text-tertiary)",
  },
  {
    value: WatchStatus.WATCHING,
    label: "Смотрю",
    dot: "var(--fv-color-accent)",
  },
  {
    value: WatchStatus.COMPLETED,
    label: "Просмотрено",
    dot: "var(--fv-color-positive)",
  },
  {
    value: WatchStatus.DROPPED,
    label: "Брошено",
    dot: "var(--fv-color-negative)",
  },
];

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const listboxId = useId();

const current = computed(
  () =>
    STATUS_ITEMS.find((item) => item.value === modelValue.value) ??
    STATUS_ITEMS[0],
);

onClickOutside(root, () => {
  isOpen.value = false;
});

const toggle = (): void => {
  if (disabled) {
    return;
  }

  isOpen.value = !isOpen.value;
};

const pick = (value: WatchStatus): void => {
  isOpen.value = false;

  if (value !== modelValue.value) {
    modelValue.value = value;
  }
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && isOpen.value) {
    isOpen.value = false;
  }
};
</script>

<template>
  <div ref="root" class="wss" @keydown="onKeydown">
    <button
      type="button"
      class="wss__trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span
        class="wss__dot"
        :style="{ background: current.dot }"
        aria-hidden="true"
      />
      <span class="wss__value">{{ current.label }}</span>
      <BaseIcon
        class="wss__caret"
        :name="isOpen ? 'ph:caret-up' : 'ph:caret-down'"
        :width="16"
        :height="16"
      />
    </button>

    <div v-if="isOpen" :id="listboxId" class="wss__menu" role="listbox">
      <button
        v-for="item in STATUS_ITEMS"
        :key="item.value"
        type="button"
        role="option"
        class="wss__option"
        :class="{ 'wss__option--active': item.value === modelValue }"
        :aria-selected="item.value === modelValue"
        @click="pick(item.value)"
      >
        <span
          class="wss__dot"
          :style="{ background: item.dot }"
          aria-hidden="true"
        />
        {{ item.label }}
        <BaseIcon
          v-if="item.value === modelValue"
          class="wss__check"
          name="ph:check"
          :width="16"
          :height="16"
        />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wss {
  position: relative;

  &__trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border: 1.5px solid var(--fv-color-accent);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-accent-soft);
    font: inherit;
    font-size: 15px;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }
  }

  &__dot {
    flex-shrink: 0;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  &__value {
    color: var(--fv-color-accent);
    font-weight: 500;
  }

  &__caret {
    margin-inline-start: auto;
    color: var(--fv-color-accent);
  }

  &__menu {
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    z-index: 30;
    padding: 6px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-high);
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 6%,
        transparent
      );
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }

    &--active {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
      font-weight: 500;

      &:hover {
        background: var(--fv-color-accent-soft);
      }
    }
  }

  &__check {
    margin-inline-start: auto;
  }
}
</style>
