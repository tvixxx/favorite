<script setup lang="ts">
import { computed } from 'vue';
import type { Badge } from '@/stores/badges';
import BadgeItem from './BadgeItem.vue';

const props = defineProps<{
  badges: Badge[];
  showLocked?: boolean;
}>();

const categoryTitles: Record<string, string> = {
  movies: 'Просмотры',
  favorites: 'Избранное',
  completed: 'Завершённые',
  serials: 'Сериалы',
  ratings: 'Оценки',
  time: 'Временные достижения',
};

const groupedBadges = computed(() => {
  const groups: Record<string, Badge[]> = {};
  props.badges.forEach(badge => {
    if (!groups[badge.category]) {
      groups[badge.category] = [];
    }

    groups[badge.category].push(badge);
  });

  return groups;
});
</script>

<template>
  <div class="badges-list">
    <div v-if="badges.length === 0" class="badges-list__empty">
      <span v-if="showLocked">Все бейджи открыты! 🎉</span>
      <span v-else>Пока нет открытых бейджей. Начните добавлять фильмы!</span>
    </div>
    <div v-for="(badges, category) in groupedBadges" :key="category" class="badges-category">
      <h4 class="badges-category__title">{{ categoryTitles[category] }}</h4>
      <div class="badges-category__items">
        <BadgeItem
          v-for="badge in badges"
          :key="badge.id"
          :badge="badge"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.badges-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  &__empty {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-size: 1rem;
  }
}

.badges-category {
  &__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  &__items {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;

    @media (min-width: 768px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }
}
</style>
