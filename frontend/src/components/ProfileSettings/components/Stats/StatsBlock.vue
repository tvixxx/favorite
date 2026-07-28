<script lang="ts" setup>
import type { StatsBlock } from "@/shared";

const props = defineProps<StatsBlock>();
</script>

<template>
  <div class="stats">
    <ul class="stats__list">
      <li class="stats__item" v-for="item in props.items" :key="item.type">
        <p class="stats__item-title">{{ item.title }}</p>
        <p class="stats__item-value">{{ item.value }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/theme-variables.scss" as *;
@use "@/styles/screen-sizes" as *;
@use "@/styles/media" as *;

// Эталон: строки «label — пилюля счётчика», разделённые линиями
.stats {
  &__list {
    display: flex;
    flex-direction: column;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 13px 0;
    border-bottom: 1px solid var(--fv-color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__item-title {
    margin: 0;
    color: var(--fv-color-text-secondary);
    font-size: 0.95rem;
  }

  &__item-value {
    font-variant-numeric: tabular-nums;
    margin: 0;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    font-size: 0.9rem;
    background: var(--fv-color-bg-secondary);
    padding: 2px 12px;
    border-radius: 999px;
  }
}
</style>
