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
  () => !props.badge.isUnlocked && props.badge.progress !== undefined,
);
</script>

<template>
  <a-tooltip
    :title="badge.description"
    placement="top"
    :mouse-enter-delay="0.4"
    :mouse-leave-delay="0.1"
  >
    <div class="badge-item" :class="{ 'badge-item--locked': !badge.isUnlocked }">
      <span class="badge-item__icon">
        <BaseIcon
          :name="badge.isUnlocked ? 'ph:film-slate-fill' : 'ph:lock-simple'"
          :width="22"
          :height="22"
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
      </div>
    </div>
  </a-tooltip>
</template>

<style scoped lang="scss">
.badge-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--fv-radius-md);
  background: var(--fv-color-bg-secondary);

  &--locked {
    .badge-item__icon {
      background: var(--fv-color-bg-primary);
      border: 1px solid var(--fv-color-border);
      color: var(--fv-color-text-tertiary);
    }
  }

  // Открытая ачивка — иконка на тёплой подложке (эталон), а не эмодзи в рамке тира
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-sizing: border-box;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--fv-color-warning-soft);
    color: #8c6d07;
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
    font-size: 13.5px;
    line-height: 1.45;
    color: var(--fv-color-text-secondary);
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
