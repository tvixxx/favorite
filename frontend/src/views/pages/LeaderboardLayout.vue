<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import { LEADERBOARD_NAV_ITEMS } from "@/constants/leaderboardNav";
import { getLeaderboardHeroMeta } from "@/router/leaderboardHeroMeta";
import { useLeaderboardMoviesStore, useLeaderboardStore } from "@/stores";

const route = useRoute();
const leaderboardStore = useLeaderboardStore();
const leaderboardMoviesStore = useLeaderboardMoviesStore();
const { total: usersTotal } = storeToRefs(leaderboardStore);
const { total: moviesTotal } = storeToRefs(leaderboardMoviesStore);

const heroMeta = computed(() => getLeaderboardHeroMeta(route));

const heroBadgeCount = computed(() => {
  const meta = heroMeta.value;
  if (!meta) {
    return undefined;
  }
  return meta.kind === "movies" ? moviesTotal.value : usersTotal.value;
});
</script>

<template>
  <div class="leaderboard-app-layout">
    <HeroHeader
      v-if="heroMeta"
      class="leaderboard-app-layout__hero"
      :title="heroMeta.title"
      :subtitle="heroMeta.subtitle"
      :badge-text="heroMeta.badgeText"
      :badge-count="heroBadgeCount"
      :icon-name="heroMeta.iconName"
    />

    <div class="leaderboard-app-layout__body">
      <aside
        class="leaderboard-app-layout__aside"
        aria-label="Разделы топа"
      >
        <p class="leaderboard-app-layout__aside-title">Раздел</p>
        <nav class="leaderboard-nav">
          <RouterLink
            v-for="item in LEADERBOARD_NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="leaderboard-nav__link"
            active-class="leaderboard-nav__link--active"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </aside>
      <main class="leaderboard-app-layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;
@use "@/styles/media" as *;

.leaderboard-app-layout {
  @include pageShell(4rem);
  display: flex;
  flex-direction: column;
  width: 100%;

  &__hero {
    width: 100%;
    flex-shrink: 0;

    :deep(.hero-header__subtitle) {
      max-width: min(72ch, 100%);
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: calc(var(--page-max-width) + 260px);
    margin: 0 auto;
    padding: 1.75rem var(--page-content-padding-x) 0;
    flex: 1;
    align-items: stretch;

    @include mediaTablet {
      flex-direction: row;
      align-items: flex-start;
      gap: 1.75rem;
      padding-top: 2rem;
    }

    @include mediaDesktopS {
      padding-left: var(--page-content-padding-x-desktop);
      padding-right: var(--page-content-padding-x-desktop);
    }
  }

  &__aside {
    flex-shrink: 0;
    width: 100%;
    padding: 1rem 0.85rem;
    border-radius: var(--radius-lg, 14px);
    background: var(--bg-primary);
    border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
    box-shadow:
      0 1px 2px color-mix(in srgb, #000 6%, transparent),
      0 12px 32px color-mix(in srgb, #000 8%, transparent);

    @include mediaTablet {
      position: sticky;
      top: 5.5rem;
      width: 240px;
      padding: 1.1rem 0.9rem;
    }
  }

  &__aside-title {
    margin: 0 0 0.65rem 0.15rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  &__main {
    flex: 1;
    min-width: 0;
    width: 100%;
  }
}

.leaderboard-nav {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.45rem;

  @include mediaTablet {
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 0.4rem;
  }

  &__link {
    display: block;
    padding: 0.7rem 0.95rem;
    border-radius: var(--radius-md, 10px);
    font-weight: 600;
    font-size: 0.88rem;
    line-height: 1.35;
    color: var(--text-secondary);
    text-decoration: none;
    border: 1px solid transparent;
    background: color-mix(in srgb, var(--bg-secondary) 55%, var(--bg-primary));
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      color: var(--ant-color-primary);
      border-color: color-mix(in srgb, var(--ant-color-primary) 28%, var(--border-color));
      background: var(--bg-primary);
    }

    &--active {
      color: var(--ant-color-primary);
      border-color: color-mix(in srgb, var(--ant-color-primary) 42%, transparent);
      background: color-mix(in srgb, var(--ant-color-primary) 10%, var(--bg-primary));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--ant-color-primary) 12%, transparent);
    }
  }
}
</style>
