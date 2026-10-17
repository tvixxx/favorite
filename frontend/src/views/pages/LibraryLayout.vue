<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";

import CollectionImportModal from "@/components/CollectionImport/CollectionImportModal.vue";
import CollectionExportModal from "@/components/CollectionExport/CollectionExportModal.vue";
import {
  Dropdown as ADropdown,
  Menu as AMenu,
  MenuItem as AMenuItem,
} from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { LIBRARY_NAV_ITEMS } from "@/constants/libraryNav";
import type { LibraryHeroMeta } from "@/router/libraryHeroMeta";
import { useMainStore } from "@/state/state";
import { useActorsStore, useUserMoviesStore } from "@/stores";
import { PLURAL, pluralize } from "@/utils";
import { getUserPreference } from "@/utils/userPreferences";

const route = useRoute();
const router = useRouter();
const mainStore = useMainStore();
const userMoviesStore = useUserMoviesStore();
const actorsStore = useActorsStore();

const { totalCount } = storeToRefs(userMoviesStore);

const userId = computed(() => mainStore.userData?.id || "");
const isCollection = computed(() => route.name === "library-collection");
const importOpen = ref(false);
const exportOpen = ref(false);
const filesButton = ref<HTMLButtonElement | null>(null);
const showCollectionFiles = computed(() => getUserPreference(mainStore.userData, "collectionFilesEnabled"));
watch(showCollectionFiles, (visible) => {
  if (!visible) {
    importOpen.value = false;
    exportOpen.value = false;
  }
});
watch(isCollection, (value) => {
  if (!value) {
    importOpen.value = false;
    exportOpen.value = false;
  }
});
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
  { immediate: true }
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
  () => userMoviesStore.stats?.totalMovies ?? totalCount.value
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
        </nav>
        <div
          v-if="isCollection"
          class="library-actions"
          :class="{ 'library-actions--without-files': !showCollectionFiles }"
          role="group"
          aria-label="Действия с коллекцией"
        >
          <ADropdown
            v-if="showCollectionFiles"
            :trigger="['click']"
            overlay-class-name="collection-files-menu"
          >
            <button
              ref="filesButton"
              type="button"
              class="library-actions__import"
              aria-label="Файлы коллекции"
            >
              <BaseIcon name="ph:folder" :width="18" :height="18" />
              <span class="library-actions__desktop-label">Файлы</span>
              <span class="library-actions__mobile-label"
                >Импорт и экспорт</span
              >
              <BaseIcon name="ph:caret-down" :width="14" :height="14" />
            </button>
            <template #overlay
              ><AMenu>
                <AMenuItem
                  key="import"
                  @click="
                    filesButton?.focus();
                    importOpen = true;
                  "
                  ><BaseIcon name="ph:upload-simple" :width="18" :height="18" />
                  Импорт коллекции</AMenuItem
                >
                <AMenuItem
                  key="export"
                  @click="
                    filesButton?.focus();
                    exportOpen = true;
                  "
                  ><BaseIcon
                    name="ph:download-simple"
                    :width="18"
                    :height="18"
                  />
                  Скачать коллекцию</AMenuItem
                >
              </AMenu></template
            >
          </ADropdown>
          <button
            type="button"
            class="library-subnav__add"
            @click="router.push('/create')"
          >
            <BaseIcon name="ph:plus-bold" :width="18" :height="18" />
            Добавить
          </button>
        </div>
      </div>

      <CollectionImportModal
        v-if="isCollection && showCollectionFiles"
        v-model="importOpen"
        @imported="userMoviesStore.refreshAfterImport(userId)"
      />
      <CollectionExportModal v-if="isCollection && showCollectionFiles" v-model="exportOpen" />

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
    border: 1px solid
      color-mix(in srgb, var(--fv-color-border) 55%, transparent);

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
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  @include mediaMax(960px) {
    flex-direction: column;
    align-items: stretch;
  }
}
.library-actions__mobile-label {
  display: none;
}
.library-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  @include mediaMax(960px) {
    justify-content: flex-end;
  }
  @include mediaMax(768px) {
    &--without-files { display: none; }
    &__import {
      width: 100%;
    }
    &__desktop-label {
      display: none;
    }
    &__mobile-label {
      display: inline;
    }
  }
}
.library-actions__import {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    background: var(--fv-color-bg-secondary);
  }
  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
  }
  @include mediaMax(400px) {
    padding: 0 12px;
  }
}

/* Подразделы медиатеки — строка чипов (эталон): активный = тёмная ink-плашка */
.library-subnav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
  @include mediaMax(960px) {
    flex: none;
  }

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
    transition: background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease),
      border-color var(--fv-motion-fast) var(--fv-ease);

    &:hover:not(.library-subnav__chip--active) {
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

<style lang="scss">
.collection-files-menu {
  min-width: 220px;
  max-width: calc(100vw - 32px);
  .ant-dropdown-menu-item {
    white-space: nowrap;
  }
  .ant-dropdown-menu-title-content {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
