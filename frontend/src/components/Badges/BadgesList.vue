<script setup lang="ts">
import type { Badge } from "@/stores/badges";
import BadgeItem from "./BadgeItem.vue";

defineProps<{
  badges: Badge[];
  showLocked?: boolean;
}>();
</script>

<template>
  <div class="badges-list">
    <div v-if="badges.length === 0" class="badges-list__empty">
      <span v-if="showLocked">Все бейджи открыты! 🎉</span>
      <span v-else>Пока нет открытых бейджей. Начните добавлять фильмы!</span>
    </div>

    <BadgeItem v-for="badge in badges" :key="badge.id" :badge="badge" />
  </div>
</template>

<style scoped lang="scss">
.badges-list {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__empty {
    text-align: center;
    padding: 2rem;
    color: var(--fv-color-text-secondary);
    font-size: 1rem;
  }
}
</style>
