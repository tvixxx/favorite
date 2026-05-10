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

.stats {
  padding: 0.7rem;
  background: color-mix(in srgb, var(--bg-secondary) 65%, transparent);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  &__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.45rem 0.65rem;
    background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 2px 8px
        color-mix(in srgb, var(--ant-color-primary) 15%, transparent);
    }
  }

  &__item-title {
    margin: 0;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.88rem;
  }

  &__item-value {
    margin: 0;
    font-weight: 700;
    color: var(--text-primary);
    font-size: 0.96rem;
    background: color-mix(in srgb, var(--ant-color-primary) 10%, transparent);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
  }

  @include mediaTablet {
    padding: 0.8rem;

    &__item {
      padding: 0.55rem 0.8rem;
    }

    &__item-title {
      font-size: 0.92rem;
    }

    &__item-value {
      font-size: 1rem;
    }
  }
}
</style>
