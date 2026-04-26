<script setup lang="ts">
import { computed } from 'vue';
import type { Badge } from '@/stores/badges';

const props = defineProps<{
  badge: Badge;
}>();

const tierColor = computed(() => {
  const colors = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  };
  return colors[props.badge.tier];
});
</script>

<template>
  <a-tooltip :title="badge.description" placement="top">
    <div
      class="badge-item"
      :class="{ 'badge-item--locked': !badge.isUnlocked }"
    >
      <div class="badge-item__icon" :style="{ borderColor: tierColor }">
        {{ badge.icon }}
      </div>
      <div class="badge-item__info">
        <div class="badge-item__title">{{ badge.title }}</div>
        <div v-if="!badge.isUnlocked && badge.progress !== undefined" class="badge-item__progress">
          <a-progress
            :percent="badge.progress"
            :show-info="false"
            size="small"
            :stroke-color="tierColor"
          />
          <span class="badge-item__progress-text">
            {{ badge.currentValue }} / {{ badge.requirement }}
          </span>
        </div>
      </div>
    </div>
  </a-tooltip>
</template>

<style scoped lang="scss">
.badge-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &--locked {
    opacity: 0.5;
    filter: grayscale(0.8);
  }

  &__icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    border: 3px solid;
    background: var(--bg-primary);
  }

  &__info {
    flex: 1;
  }

  &__title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  &__progress-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
}
</style>
