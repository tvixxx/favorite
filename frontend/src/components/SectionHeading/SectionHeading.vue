<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

withDefaults(
  defineProps<{
    title: string;
    icon: string;
    tag?: "h2" | "h3";
    compact?: boolean;
    count?: number;
  }>(),
  { tag: "h2" }
);
</script>

<template>
  <div class="section-heading" :class="{ 'section-heading_compact': compact }">
    <component :is="tag" class="section-heading__title">
      <BaseIcon
        :name="icon"
        :width="compact ? 24 : 28"
        :height="compact ? 24 : 28"
        aria-hidden="true"
      />
      <span>{{ title }}</span>
      <span v-if="count !== undefined" class="section-heading__count">{{
        count
      }}</span>
    </component>
    <div v-if="$slots.actions" class="section-heading__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.section-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;

  &__title {
    display: flex;
    flex: 1 1 160px;
    align-items: center;
    gap: 10px;
    min-width: 0;
    margin: 0;
    color: var(--fv-color-text-primary);
    font-family: var(--fv-font-display);
    font-size: 18px;
    font-weight: 500;
    line-height: 1.25;

    > span:first-of-type {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    :deep(svg) {
      display: block;
      flex: none;
      color: var(--fv-color-accent);
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    margin-inline-start: auto;

    :deep(button) {
      max-width: 100%;
      white-space: normal;
    }
  }

  &__count {
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
    font-size: 11px;
  }

  &_compact &__title {
    font-family: var(--fv-font-ui);
    font-size: 14px;
  }

  @include mediaMax(500px) {
    &:not(.section-heading_compact) &__title {
      font-size: 17px;
    }
  }
}
</style>
