<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

export interface StateAction {
  label: string;
  /** Полное phosphor-имя, напр. "ph:plus" */
  icon?: string;
  kind?: "primary" | "secondary" | "ghost";
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface Props {
  variant?: "empty" | "error";
  /** Полное phosphor-имя, напр. "ph:film-reel" */
  icon?: string;
  title: string;
  description?: string;
  /** Код над иконкой (напр. «ОШИБКА 500») */
  code?: string;
  actions?: StateAction[];
  /** Компактная версия (меньше отступы/иконка) — для модалок/узких мест */
  compact?: boolean;
}

const {
  variant = "empty",
  icon = "ph:tray",
  actions = [],
  compact = false,
} = defineProps<Props>();
</script>

<template>
  <div
    class="stateblock"
    :class="[`stateblock--${variant}`, { 'stateblock--compact': compact }]"
  >
    <div v-if="code" class="stateblock__code">{{ code }}</div>

    <div class="stateblock__ico">
      <BaseIcon :name="icon" :width="compact ? 34 : 42" :height="compact ? 34 : 42" />
    </div>

    <h3 class="stateblock__title">{{ title }}</h3>
    <p v-if="description" class="stateblock__desc">{{ description }}</p>

    <div v-if="actions.length" class="stateblock__actions">
      <button
        v-for="(action, index) in actions"
        :key="index"
        type="button"
        class="stateblock__btn"
        :class="`stateblock__btn--${action.kind ?? 'primary'}`"
        :disabled="action.loading || action.disabled"
        @click="action.onClick"
      >
        <span v-if="action.loading" class="stateblock__spin" aria-hidden="true" />
        <BaseIcon
          v-else-if="action.icon"
          :name="action.icon"
          :width="18"
          :height="18"
        />
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.stateblock {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 24px;
  width: 100%;
  // Центрируем в доступной области экрана (эталон: .esinner flex:1 center)
  min-height: 46vh;

  &--compact {
    padding: 24px 16px;
    min-height: 0;
  }

  &__code {
    margin-bottom: 10px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--fv-color-text-tertiary);
  }

  &__ico {
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    margin-bottom: 18px;
    border-radius: 50%;

    @include mediaMax(640px) {
      width: 78px;
      height: 78px;
    }
  }

  &--compact &__ico {
    width: 64px;
    height: 64px;
    margin-bottom: 14px;
  }

  &--empty &__ico {
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
  }

  &--error &__ico {
    background: color-mix(in srgb, var(--fv-color-negative) 12%, transparent);
    color: var(--fv-color-negative);
  }

  &__title {
    margin: 0 0 7px;
    font-size: 1.2rem;
    font-weight: 500;
    line-height: 1.25;
    color: var(--fv-color-text-primary);
  }

  &--compact &__title {
    font-size: 1.05rem;
  }

  &__desc {
    margin: 0 0 18px;
    max-width: 255px;
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--fv-color-text-secondary);
    text-wrap: pretty;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 42px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--fv-radius-control);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      opacity var(--fv-motion-fast) var(--fv-ease);

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &--primary {
      background: var(--fv-color-brand);
      color: #fff;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
      }
    }

    &--secondary {
      background: var(--fv-color-bg-secondary);
      color: var(--fv-color-text-primary);

      &:hover:not(:disabled) {
        background: color-mix(
          in srgb,
          var(--fv-color-text-primary) 6%,
          var(--fv-color-bg-secondary)
        );
      }
    }

    &--ghost {
      padding: 0 12px;
      background: transparent;
      color: var(--fv-color-text-secondary);

      &:hover:not(:disabled) {
        background: color-mix(
          in srgb,
          var(--fv-color-text-primary) 6%,
          transparent
        );
      }
    }
  }

  &__spin {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2.5px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    animation: stateblock-spin 0.7s linear infinite;
  }
}

@keyframes stateblock-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stateblock__spin {
    animation: none;
  }
}
</style>
