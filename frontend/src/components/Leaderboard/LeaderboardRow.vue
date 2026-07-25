<script lang="ts" setup>
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  rank: number;
  title: string;
  subtitle?: string;
  /** Значение пилюли справа (баллы / средняя оценка) */
  metric: string | number;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: "",
  clickable: false,
});

const emit = defineEmits<{ (e: "open"): void }>();

const medalTone = computed<"gold" | "silver" | "bronze" | "default">(() => {
  if (props.rank === 1) {
    return "gold";
  }

  if (props.rank === 2) {
    return "silver";
  }

  if (props.rank === 3) {
    return "bronze";
  }

  return "default";
});
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="lb-row"
    :class="{ 'lb-row--clickable': clickable }"
    @click="clickable && emit('open')"
  >
    <div class="lb-row__left">
      <span class="lb-row__place" :class="`lb-row__place--${medalTone}`">
        {{ rank }}
      </span>
      <div class="lb-row__media">
        <slot name="media" />
      </div>
      <div class="lb-row__text">
        <div class="lb-row__title">{{ title }}</div>
        <div v-if="subtitle" class="lb-row__subtitle">{{ subtitle }}</div>
      </div>
    </div>

    <div class="lb-row__metric">
      <BaseIcon
        class="lb-row__metric-star"
        name="ph:star"
        :width="16"
        :height="16"
      />
      <span>{{ metric }}</span>
    </div>
  </component>
</template>

<style lang="scss" scoped>
.lb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-bottom: 1px solid var(--fv-color-border);
  background: transparent;
  font: inherit;
  text-align: left;
  color: inherit;

  &:last-child {
    border-bottom: none;
  }

  &--clickable {
    cursor: pointer;
    border-radius: var(--fv-radius-sm);
    transition: background 0.15s ease;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  &__place {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: 500;
    font-size: 15px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);

    // Медали призовых мест (фиксированные цвета — читаются в любой теме)
    &--gold {
      background: #fff3d1;
      color: #8c6d07;
    }

    &--silver {
      background: #eaedf2;
      color: #5b6472;
    }

    &--bronze {
      background: #f6e0cc;
      color: #8a5a2b;
    }
  }

  &__media {
    flex-shrink: 0;
    display: flex;
  }

  &__text {
    min-width: 0;
  }

  &__title {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__subtitle {
    margin-top: 2px;
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__metric {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
    font-weight: 600;
    font-size: 0.9rem;
  }

  &__metric-star {
    color: var(--fv-color-warning);
  }
}
</style>
