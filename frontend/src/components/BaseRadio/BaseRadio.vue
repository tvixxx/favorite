<script setup lang="ts">
/**
 * Радио-группа по эталону MTS Granat.
 *  variant="card"  — выбираемые карточки (активная: синяя рамка + soft-фон)
 *  variant="plain" — обычные радио-строки (точка 22px + подпись)
 * Точка: рамка 2px (grey в покое / accent активная) + внутренний залитый круг.
 */
type RadioValue = string | number;

interface RadioOption {
  value: RadioValue;
  label: string;
  /** Пояснение серым после label (напр. «— требует подтверждения») */
  hint?: string;
}

withDefaults(
  defineProps<{
    modelValue: RadioValue;
    options: RadioOption[];
    variant?: "card" | "plain";
  }>(),
  { variant: "card" },
);

const emit = defineEmits<{ "update:modelValue": [RadioValue] }>();
</script>

<template>
  <div class="base-radio" :class="`base-radio--${variant}`" role="radiogroup">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="radio"
      :aria-checked="opt.value === modelValue"
      class="base-radio__item"
      :class="{ 'base-radio__item--active': opt.value === modelValue }"
      @click="emit('update:modelValue', opt.value)"
    >
      <span class="base-radio__dot" aria-hidden="true"></span>
      <span class="base-radio__text">
        {{ opt.label
        }}<span v-if="opt.hint" class="base-radio__hint"> {{ opt.hint }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.base-radio {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
      border-radius: 14px;
    }
  }

  &__dot {
    position: relative;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--fv-color-border);
    transition: border-color var(--fv-motion-fast) var(--fv-ease);
  }

  &__item--active &__dot {
    border-color: var(--fv-color-accent);

    &::after {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: var(--fv-color-accent);
    }
  }

  &__text {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__hint {
    font-weight: 400;
    color: var(--fv-color-text-secondary);
  }

  /* ── card ─────────────────────────────────────────────── */
  &--card &__item {
    padding: 14px 16px;
    border: 1.5px solid var(--fv-color-border);
    border-radius: 14px;
    background: var(--fv-color-bg-primary);
    transition:
      border-color var(--fv-motion-fast) var(--fv-ease),
      background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      border-color: color-mix(
        in srgb,
        var(--fv-color-accent) 40%,
        var(--fv-color-border)
      );
    }
  }

  &--card &__item--active {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
  }

  /* ── plain ────────────────────────────────────────────── */
  &--plain &__dot {
    width: 22px;
    height: 22px;
  }
}
</style>
