<script setup lang="ts">
import { computed } from "vue";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { Badge } from "@/stores/badges";

const props = defineProps<{
  badge: Badge;
}>();

const progressPercent = computed(() => {
  const { currentValue, requirement } = props.badge;

  if (!requirement) {
    return 0;
  }

  return Math.min(100, Math.round((currentValue / requirement) * 100));
});

const hasProgress = computed(
  () => !props.badge.isUnlocked && props.badge.progress !== undefined
);
</script>

<template>
  <a-tooltip
    :title="badge.description"
    placement="top"
    :mouse-enter-delay="0.4"
    :mouse-leave-delay="0.1"
  >
    <div
      class="badge-item"
      :class="{ 'badge-item--locked': !badge.isUnlocked }"
    >
      <span class="badge-item__icon">
        <BaseIcon
          :name="badge.isUnlocked ? 'ph:trophy' : 'ph:lock-simple'"
          :width="18"
          :height="18"
        />
      </span>

      <div class="badge-item__info">
        <div class="badge-item__title">{{ badge.title }}</div>
        <div v-if="badge.description" class="badge-item__desc">
          {{ badge.description }}
          <template v-if="hasProgress">
            · {{ badge.currentValue }} из {{ badge.requirement }}
          </template>
        </div>

        <div v-if="hasProgress" class="badge-item__bar">
          <span
            class="badge-item__bar-fill"
            :style="{ width: `${progressPercent}%` }"
          ></span>
        </div>
        <span class="badge-item__status">
          {{ badge.isUnlocked ? "✓ Получено" : "Закрыто" }}
        </span>
      </div>
    </div>
  </a-tooltip>
</template>

<style scoped lang="scss">
.badge-item {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 10px;
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-secondary);

  &--locked {
    .badge-item__icon {
      background: var(--fv-color-bg-primary);
      border: 1px solid var(--fv-color-border);
      color: var(--fv-color-text-tertiary);
    }
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-sizing: border-box;
    width: 34px;
    height: 34px;
    border-radius: var(--fv-radius-control);
    background: color-mix(
      in srgb,
      var(--fv-color-accent) 12%,
      var(--fv-color-bg-primary)
    );
    color: var(--fv-color-accent);
  }

  &__info {
    flex: 1;
    min-width: 0;
    // Длинные названия ачивок переносим, а не растягиваем карточку
    overflow-wrap: anywhere;
  }

  &__title {
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__desc {
    margin-top: 2px;
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--fv-color-text-secondary);
  }

  &__status {
    color: var(--fv-color-text-secondary);
    font-size: 0.6875rem;
  }

  &__bar {
    margin-top: 8px;
    height: 6px;
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    overflow: hidden;
  }

  &__bar-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--fv-color-accent);
  }
}
</style>
