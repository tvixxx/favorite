<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import { LEADERBOARD_PATHS } from "@/constants/leaderboardNav";
import { getLeaderboardHeroMeta } from "@/router/leaderboardHeroMeta";

const route = useRoute();
const router = useRouter();

const heroMeta = computed(() => getLeaderboardHeroMeta(route));

const segmentOptions = [
  { label: "Пользователи", value: LEADERBOARD_PATHS.users },
  { label: "Фильмы", value: LEADERBOARD_PATHS.movies },
];

const activeSegment = computed<string>(() =>
  route.path.startsWith(LEADERBOARD_PATHS.movies)
    ? LEADERBOARD_PATHS.movies
    : LEADERBOARD_PATHS.users,
);

const onSegmentChange = (value: string | number): void => {
  const path = String(value);

  if (path !== route.path) {
    void router.push(path);
  }
};
</script>

<template>
  <div class="leaderboard-app-layout">
    <HeroHeader
      v-if="heroMeta"
      :title="heroMeta.title"
      :subtitle="heroMeta.subtitle"
      :badge-text="heroMeta.badgeText"
      :icon-name="heroMeta.iconName"
      icon-tone="warning"
    >
      <template #aside>
        <a-segmented
          :value="activeSegment"
          :options="segmentOptions"
          size="large"
          @change="onSegmentChange"
        />
      </template>
    </HeroHeader>

    <div class="leaderboard-app-layout__body">
      <main class="leaderboard-app-layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;

.leaderboard-app-layout {
  @include pageShell(4rem);
  display: flex;
  flex-direction: column;
  width: 100%;

  &__body {
    @include pageContentContainer;
  }

  &__main {
    width: 100%;
    min-width: 0;
  }
}
</style>
