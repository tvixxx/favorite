<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import WatchDiary from "@/components/WatchDiary/WatchDiary.vue";
import type { DiaryStats } from "@/services/watch-diary";
import { useMainStore } from "@/state/state";
import { useUserMoviesStore } from "@/stores";

const route = useRoute(),
  router = useRouter();
const emit = defineEmits<{ diaryStats: [stats: DiaryStats | null] }>();
const movieId = computed(() =>
  typeof route.query.movieId === "string" ? route.query.movieId : undefined
);
const main = useMainStore(),
  collection = useUserMoviesStore();

function refreshCollection(): void {
  if (main.userData?.id) void collection.refreshAfterImport(main.userData.id);
}
</script>

<template>
  <div class="watch-diary-page">
    <WatchDiary
      :movie-id-filter="movieId"
      @stats="emit('diaryStats', $event)"
      @collection-updated="refreshCollection"
      @clear-filter="router.replace({ query: {} })"
    />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/layout" as *;

.watch-diary-page {
  @include pageContentContainer;
  align-items: stretch;
}
</style>
