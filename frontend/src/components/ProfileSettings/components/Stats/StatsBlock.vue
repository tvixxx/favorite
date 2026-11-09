<script lang="ts" setup>
import type { StatsBlock } from "@/shared";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";

const props = defineProps<StatsBlock & { loading?: boolean }>();
</script>

<template>
  <div class="stats" :aria-busy="props.loading || undefined">
    <ul class="stats__list">
      <li class="stats__item" v-for="item in props.items" :key="item.type">
        <span class="stats__item-title">{{ item.title }}</span>
        <strong v-if="!props.loading" class="stats__item-value">{{
          item.value
        }}</strong>
        <SkeletonBar
          v-else
          width="27px"
          height="16px"
          radius="5px"
          aria-hidden="true"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
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
    flex-wrap: wrap;
    gap: 4px 0.75rem;
    padding: 9px 0;
    min-height: 43px;
    border-bottom: 1px solid var(--fv-color-border);

    &:last-child {
      border-bottom: none;
    }
  }

  &__item-title {
    color: var(--fv-color-text-secondary);
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }

  &__item-value {
    margin-inline-start: auto;
    min-width: 0;
    text-align: end;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
    font-family: var(--fv-font-display);
    font-weight: 700;
    font-size: 1.5rem;
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--fv-color-text-primary);
  }
}
</style>
