<script setup lang="ts">
import { computed, ref } from "vue";
import { onClickOutside } from "@vueuse/core";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

/**
 * Поле множественного выбора с чипами внутри (эталон): выбранное лежит синими
 * пилюлями в самом поле, справа от них — ввод для поиска по списку.
 */
type Option = { value: string; label: string };

const selected = defineModel<string[]>({ default: () => [] });

const props = defineProps<{
  options: Option[];
  label: string;
  placeholder: string;
}>();

const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const query = ref("");
const isOpen = ref(false);

const labelOf = (value: string): string =>
  props.options.find((o) => o.value === value)?.label ?? value;

const matches = computed(() => {
  const q = query.value.trim().toLowerCase();

  return props.options.filter(
    (o) =>
      !selected.value.includes(o.value) &&
      (!q || o.label.toLowerCase().includes(q)),
  );
});

const add = (value: string): void => {
  selected.value = [...selected.value, value];
  query.value = "";
  input.value?.focus();
};

const remove = (value: string): void => {
  selected.value = selected.value.filter((v) => v !== value);
};

const onBackspace = (): void => {
  if (!query.value && selected.value.length) {
    remove(selected.value[selected.value.length - 1]);
  }
};

const onEnter = (): void => {
  const first = matches.value[0];

  if (first) {
    add(first.value);
  }
};

onClickOutside(root, () => {
  isOpen.value = false;
});
</script>

<template>
  <div ref="root" class="msfield">
    <span class="msfield__label">{{ label }}</span>

    <div
      class="msfield__control"
      :class="{ 'msfield__control--open': isOpen }"
      @click="
        isOpen = true;
        input?.focus();
      "
    >
      <button
        v-for="value in selected"
        :key="value"
        type="button"
        class="msfield__chip"
        :aria-label="`Убрать ${labelOf(value)}`"
        @click.stop="remove(value)"
      >
        {{ labelOf(value) }}
        <BaseIcon name="ph:x" :width="13" :height="13" />
      </button>

      <input
        ref="input"
        v-model="query"
        class="msfield__input"
        type="text"
        :placeholder="selected.length ? '' : placeholder"
        @focus="isOpen = true"
        @keydown.enter.prevent="onEnter"
        @keydown.delete="onBackspace"
        @keydown.esc="isOpen = false"
      />

      <BaseIcon
        class="msfield__caret"
        :name="isOpen ? 'ph:caret-up' : 'ph:caret-down'"
        :width="16"
        :height="16"
      />
    </div>

    <div v-if="isOpen" class="msfield__menu">
      <button
        v-for="option in matches"
        :key="option.value"
        type="button"
        class="msfield__option"
        @click="add(option.value)"
      >
        <BaseIcon name="ph:plus" :width="15" :height="15" />
        {{ option.label }}
      </button>

      <p v-if="!matches.length" class="msfield__empty">Ничего не найдено</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/scrollbar" as *;

.msfield {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__label {
    font-size: 13px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__control {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 46px;
    padding: 6px 12px;
    border: 1.5px solid transparent;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    cursor: text;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      border-color var(--fv-motion-fast) var(--fv-ease);

    &--open {
      border-color: var(--fv-color-accent);
      background: var(--fv-color-bg-primary);
    }
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 7px 0 11px;
    border: 0;
    border-radius: 999px;
    background: var(--fv-color-bg-active-soft);
    color: var(--fv-color-link);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;

    svg {
      opacity: 0.65;
    }

    &:hover svg {
      opacity: 1;
    }
  }

  &__input {
    flex: 1;
    min-width: 60px;
    border: 0;
    background: none;
    outline: none;
    font: inherit;
    font-size: 15px;
    color: var(--fv-color-text-primary);

    &::placeholder {
      color: var(--fv-color-text-tertiary);
    }
  }

  &__caret {
    flex-shrink: 0;
    color: var(--fv-color-text-tertiary);
  }

  &__menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 20;
    max-height: 220px;
    padding: 6px;
    overflow-y: auto;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-high);

    @include customScrollbar();
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 13px;
    border: 0;
    border-radius: 9px;
    background: none;
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 15px;
    text-align: left;
    cursor: pointer;

    svg {
      flex-shrink: 0;
      color: var(--fv-color-accent);
    }

    &:hover {
      background: var(--fv-color-bg-secondary);
    }
  }

  &__empty {
    margin: 0;
    padding: 12px 13px;
    color: var(--fv-color-text-tertiary);
    font-size: 14px;
  }
}
</style>
