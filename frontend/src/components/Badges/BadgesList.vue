<script setup lang="ts">
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import type { Badge } from "@/stores/badges";
import BadgeItem from "./BadgeItem.vue";

defineProps<{
  badges: Badge[];
  showLocked?: boolean;
}>();
</script>

<template>
  <div class="badges-list">
    <StateBlock
      v-if="badges.length === 0"
      compact
      variant="empty"
      :icon="showLocked ? 'ph:confetti' : 'ph:trophy'"
      :title="showLocked ? 'Все ачивки открыты' : 'Пока нет открытых ачивок'"
      :description="
        showLocked
          ? 'Вы прошли все испытания коллекции.'
          : 'Добавляйте фильмы и ставьте оценки — ачивки будут открываться сами.'
      "
    />

    <BadgeItem v-for="badge in badges" :key="badge.id" :badge="badge" />
  </div>
</template>

<style scoped lang="scss">
.badges-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
