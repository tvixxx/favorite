<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { LIBRARY_NAV_ITEMS } from "@/constants/libraryNav";
import type { LibraryHeroMeta } from "@/router/libraryHeroMeta";
import { useMainStore } from "@/state/state";
import { useActorsStore, useUserMoviesStore } from "@/stores";
import { PLURAL, pluralize } from "@/utils";

const route = useRoute();
const router = useRouter();
const mainStore = useMainStore();
const userMoviesStore = useUserMoviesStore();
const actorsStore = useActorsStore();

const { currentList } = storeToRefs(userMoviesStore);

const userId = computed(() => mainStore.userData?.id || "");
const isCollection = computed(() => route.name === "library-collection");
const isActors = computed(() => route.name === "library-actors");
const isLists = computed(() => route.name === "library-lists");

// «Новый список» в шапке открывает модалку создания в MyListsPage через query-флаг
const openNewList = (): void => {
  void router.push({ query: { ...route.query, create: "1" } });
};

const loadCollectionStats = (): void => {
  if (userId.value) {
    void userMoviesStore.fetchUserMoviesStats(userId.value).catch(() => {});
  }
};

onMounted(() => {
  void actorsStore.prefetchActorsTotal().catch(() => {});
  loadCollectionStats();
});

watch(userId, () => loadCollectionStats());

watch(
  () => {
    const name = route.name;
    const raw = route.params.actorId;
    const actorId = typeof raw === "string" ? raw : "";

    return { name, actorId };
  },
  async ({ name, actorId }) => {
    if (name === "library-actor" && actorId) {
      await actorsStore.fetchActorById(actorId);
    } else {
      actorsStore.clearDetailActor();
    }
  },
  { immediate: true },
);

const heroMeta = computed((): LibraryHeroMeta | undefined => {
  if (route.name === "library-actor") {
    const id = route.params.actorId;
    const actorId = typeof id === "string" ? id : "";
    const actor =
      actorsStore.detailActor?.id === actorId ? actorsStore.detailActor : null;

    return {
      title: actor ? `Фильмы: ${actor.name}` : "Фильмы актёра",
      subtitle:
        "Общий каталог приложения с фильтром по выбранному актёру — откройте карточку, чтобы добавить фильм к себе",
      badgeText: "Медиатека",
      iconName: "ph:user",
    };
  }

  const raw = route.meta.libraryHero;
  if (raw && typeof raw === "object") {
    return raw as LibraryHeroMeta;
  }

  return undefined;
});

const collectionCount = computed(
  () => userMoviesStore.stats?.totalMovies ?? currentList.value.length,
);

const heroSubtitle = computed(() => {
  const meta = heroMeta.value;
  if (!meta) {
    return "";
  }

  if (isCollection.value) {
    const n = collectionCount.value;

    return `${pluralize(n, PLURAL.title)} · ${meta.subtitle}`;
  }

  return meta.subtitle;
});

interface HeroStat {
  value: number;
  label: string;
  accent?: boolean;
}

const heroStats = computed<HeroStat[]>(() => {
  if (!isCollection.value) {
    return [];
  }

  const s = userMoviesStore.stats;
  if (!s) {
    return [];
  }

  return [
    { value: s.totalCompleted, label: "Просмотрено" },
    { value: s.totalWatching, label: "Смотрю", accent: true },
    { value: s.totalSeeLater, label: "Позже" },
  ];
});

function isLibraryNavActive(to: string): boolean {
  if (to === "/library/actors") {
    return route.path.startsWith("/library/actors");
  }

  return route.path === to;
}
</script>

<template>
  <div class="library-app-layout">
    <div class="library-app-layout__body">
      <div v-if="heroMeta" class="library-hero">
        <section class="library-hero__card">
          <div class="library-hero__text">
            <p class="library-hero__eyebrow">{{ heroMeta.badgeText }}</p>
            <h1 class="library-hero__title">{{ heroMeta.title }}</h1>
            <p class="library-hero__subtitle">{{ heroSubtitle }}</p>
          </div>

          <div v-if="heroStats.length" class="library-hero__stats">
            <div
              v-for="stat in heroStats"
              :key="stat.label"
              class="library-hero__stat"
            >
              <span
                class="library-hero__stat-num"
                :class="{ 'library-hero__stat-num--accent': stat.accent }"
              >
                {{ stat.value }}
              </span>
              <span class="library-hero__stat-label">{{ stat.label }}</span>
            </div>
          </div>

          <label v-else-if="isActors" class="library-hero__search">
            <BaseIcon name="ph:magnifying-glass" :width="20" :height="20" />
            <input
              v-model="actorsStore.actorsSearchQ"
              type="text"
              placeholder="Поиск актёров"
            />
          </label>

          <button
            v-else-if="isLists"
            type="button"
            class="library-hero__new-list"
            @click="openNewList"
          >
            <BaseIcon name="ph:plus-bold" :width="18" :height="18" />
            Новый список
          </button>
        </section>
      </div>

      <div class="library-subnav-wrap">
        <nav class="library-subnav" aria-label="Разделы медиатеки">
          <RouterLink
            v-for="item in LIBRARY_NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="library-subnav__chip"
            :class="{
              'library-subnav__chip--active': isLibraryNavActive(item.to),
            }"
          >
            {{ item.label }}
          </RouterLink>

          <button
            v-if="isCollection"
            type="button"
            class="library-subnav__add"
            @click="router.push('/create')"
          >
            <BaseIcon name="ph:plus-bold" :width="18" :height="18" />
            Добавить
          </button>
        </nav>
      </div>

      <main class="library-app-layout__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/styles/layout" as *;
@use "@/styles/scrollbar" as *;
@use "@/styles/media" as *;

.library-app-layout {
  @include pageShell(4rem);
  display: flex;
  flex-direction: column;
  width: 100%;

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    padding-top: 1.75rem;
    flex: 1;
  }

  &__main {
    width: 100%;
    min-width: 0;
  }
}

// Hero-карточка медиатеки (эталон): eyebrow + заголовок + подзаголовок + статы
.library-hero {
  @include pageContentContainer;

  &__card {
    display: flex;
    align-items: center;
    gap: 24px;
    width: 100%;
    padding: 1.75rem 2rem;
    border-radius: var(--fv-radius-lg);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-card);
    border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);

    @include mediaMax(640px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      padding: 1.5rem;
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__eyebrow {
    margin: 0 0 8px;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.6rem, 4vw, 2.25rem);
    font-weight: 500;
    line-height: 1.1;
    color: var(--fv-color-text-primary);
  }

  &__subtitle {
    margin: 8px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: 0.95rem;
  }

  &__stats {
    display: flex;
    gap: 12px;
    flex-shrink: 0;

    @include mediaMax(640px) {
      width: 100%;
    }
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 92px;
    padding: 14px 20px;
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-secondary);

    @include mediaMax(640px) {
      flex: 1;
      min-width: 0;
    }
  }

  &__stat-num {
    font-family: var(--fv-font-display);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1;
    color: var(--fv-color-text-primary);

    &--accent {
      color: var(--fv-color-accent);
    }
  }

  &__stat-label {
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
  }

  // Актёры: поиск справа в шапке
  &__search {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    width: 320px;
    max-width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    border: 1.5px solid transparent;
    color: var(--fv-color-text-tertiary);
    transition: border-color var(--fv-motion-fast) var(--fv-ease);

    &:focus-within {
      border-color: var(--fv-color-accent);
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      outline: none;
      font: inherit;
      font-size: 1rem;
      color: var(--fv-color-text-primary);
    }

    @include mediaMax(640px) {
      width: 100%;
    }
  }

  // Мои списки: кнопка «Новый список» справа в шапке (эталон, brand-акцент)
  &__new-list {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    height: 44px;
    padding: 0 22px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-brand);
    color: #fff;
    font: inherit;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
    }

    @include mediaMax(640px) {
      width: 100%;
      justify-content: center;
    }
  }
}

.library-subnav-wrap {
  @include pageContentContainer;
}

/* Подразделы медиатеки — строка чипов (эталон): активный = тёмная ink-плашка */
.library-subnav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;

  // Мобилка: чипы в один ряд с горизонтальным скроллом (без переноса, эталон)
  @include mediaMax(768px) {
    flex-wrap: nowrap;
    overflow-x: auto;

    @include hideScrollbar();
  }

  &__chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease),
      border-color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 6%,
        var(--fv-color-bg-secondary)
      );
    }

    &--active {
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
      border-color: transparent;
    }
  }

  &__add {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    margin-left: auto;
    padding: 0 22px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-brand);
    color: #fff;
    font: inherit;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
    }

    // На мобиле добавление — через центральный FAB нижнего таб-бара
    @include mediaMax(768px) {
      display: none;
    }
  }
}
</style>
