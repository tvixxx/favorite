<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";

import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { useMainStore } from "@/state/state";
import { useUserListsStore } from "@/stores";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { formatYear } from "@/utils";
import type { UserListItem, UserListSummary } from "@/stores/userLists/types";

const router = useRouter();
const route = useRoute();
const mainStore = useMainStore();
const userListsStore = useUserListsStore();

type MediaTypeFilter = "all" | "movies" | "serials";
const DESKTOP_BREAKPOINT = 1280;
const DESKTOP_INLINE_LABELS_LIMIT = 8;
const COMPACT_INLINE_LABELS_LIMIT = 5;

const userId = computed(() => mainStore.userData?.id ?? "");
const selectedListId = ref<string | null>(null);
const imageErrors = ref<Set<string>>(new Set());
const isItemRemoving = ref(false);
const isListDeleting = ref(false);
const titleQuery = ref("");
const mediaTypeFilter = ref<MediaTypeFilter>("all");
const activeLabelFilter = ref<string | null>(null);
const pendingRouteListId = ref<string | null>(null);
const isSyncingFromRoute = ref(false);
const isLabelsModalOpen = ref(false);
const viewportWidth = ref<number>(0);
const labelsSearchQuery = ref("");

const lists = computed<UserListSummary[]>(() => userListsStore.sortedLists);
const currentList = computed(() => userListsStore.currentList);
const hasLists = computed(() => lists.value.length > 0);
const allLabels = computed(() => {
  const labels = new Set<string>();

  for (const list of lists.value) {
    for (const label of list.labels) {
      labels.add(label);
    }
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b, "ru"));
});
const maxInlineLabels = computed(() => {
  if (viewportWidth.value >= DESKTOP_BREAKPOINT) {
    return DESKTOP_INLINE_LABELS_LIMIT;
  }

  return COMPACT_INLINE_LABELS_LIMIT;
});
const inlineLabels = computed(() => {
  const limit = maxInlineLabels.value;
  const source = allLabels.value;
  const clipped = source.slice(0, limit);

  if (!activeLabelFilter.value || clipped.includes(activeLabelFilter.value)) {
    return clipped;
  }

  if (clipped.length < limit) {
    return [...clipped, activeLabelFilter.value];
  }

  return [...clipped.slice(0, limit - 1), activeLabelFilter.value];
});
const hiddenLabelsCount = computed(() => {
  return Math.max(0, allLabels.value.length - inlineLabels.value.length);
});
const hasHiddenLabels = computed(() => hiddenLabelsCount.value > 0);
const hiddenActiveLabel = computed(() => {
  if (!activeLabelFilter.value) {
    return null;
  }

  if (inlineLabels.value.includes(activeLabelFilter.value)) {
    return null;
  }

  return activeLabelFilter.value;
});
const moreLabelsButtonText = computed(() => {
  const base = `+${hiddenLabelsCount.value} ещё`;

  if (!hiddenActiveLabel.value) {
    return base;
  }

  return `${base} • выбрано: ${hiddenActiveLabel.value}`;
});
const modalFilteredLabels = computed(() => {
  const query = labelsSearchQuery.value.trim().toLowerCase();

  if (!query) {
    return allLabels.value;
  }

  return allLabels.value.filter((label) => label.toLowerCase().includes(query));
});
const syncViewportWidth = () => {
  if (typeof window === "undefined") {
    return;
  }

  viewportWidth.value = window.innerWidth;
};

const filteredLists = computed(() => {
  const activeLabel = activeLabelFilter.value;

  if (!activeLabel) {
    return lists.value;
  }

  return lists.value.filter((list) => list.labels.includes(activeLabel));
});

const hasFilteredLists = computed(() => filteredLists.value.length > 0);
const displayedCurrentList = computed(() => {
  if (!selectedListId.value) {
    return null;
  }

  if (currentList.value?.id !== selectedListId.value) {
    return null;
  }

  return currentList.value;
});
const isCurrentListTrulyEmpty = computed(() => {
  return (displayedCurrentList.value?.items.length ?? 0) === 0;
});
const currentListFilteredItems = computed<UserListItem[]>(() => {
  const source = displayedCurrentList.value?.items ?? [];
  const query = titleQuery.value.trim().toLowerCase();

  return source.filter((item) => {
    if (mediaTypeFilter.value === "movies" && item.movie.isSerial) {
      return false;
    }

    if (mediaTypeFilter.value === "serials" && !item.movie.isSerial) {
      return false;
    }

    if (!query) {
      return true;
    }

    return item.movie.title.toLowerCase().includes(query);
  });
});

const formatTitlesCount = (count: number): string => {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} тайтл`;
  }

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} тайтла`;
  }

  return `${count} тайтлов`;
};

const getPosterSrc = (item: UserListItem): string => {
  if (imageErrors.value.has(item.movieId)) {
    return FALLBACK_IMAGE_URL;
  }

  return item.movie.poster?.url || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string): void => {
  imageErrors.value.add(movieId);
};

const openMovieDetail = (movieId: string): void => {
  void router.push(`/detail/${movieId}`);
};

const getQueryStringValue = (input: unknown): string | null => {
  if (typeof input === "string") {
    return input;
  }

  if (Array.isArray(input) && typeof input[0] === "string") {
    return input[0];
  }

  return null;
};

const normalizeMediaType = (raw: string | null): MediaTypeFilter => {
  if (raw === "movies" || raw === "serials") {
    return raw;
  }

  return "all";
};

const applyStateFromRouteQuery = (): void => {
  isSyncingFromRoute.value = true;

  const nextTitle = getQueryStringValue(route.query.q);
  const nextLabel = getQueryStringValue(route.query.label);
  const nextType = normalizeMediaType(getQueryStringValue(route.query.type));
  const nextListId = getQueryStringValue(route.query.list);

  titleQuery.value = nextTitle ?? "";
  activeLabelFilter.value = nextLabel ?? null;
  mediaTypeFilter.value = nextType;

  if (nextListId) {
    const exists = lists.value.some((list) => list.id === nextListId);

    if (exists) {
      selectedListId.value = nextListId;
      pendingRouteListId.value = null;
    } else {
      pendingRouteListId.value = nextListId;
    }
  } else {
    pendingRouteListId.value = null;
  }

  isSyncingFromRoute.value = false;
};

const syncRouteQueryFromState = async (): Promise<void> => {
  if (isSyncingFromRoute.value) {
    return;
  }

  const currentList = getQueryStringValue(route.query.list) ?? "";
  const currentLabel = getQueryStringValue(route.query.label) ?? "";
  const currentQuery = getQueryStringValue(route.query.q) ?? "";
  const currentType = normalizeMediaType(getQueryStringValue(route.query.type));

  const nextList = selectedListId.value ?? "";
  const nextLabel = activeLabelFilter.value ?? "";
  const nextQuery = titleQuery.value.trim();
  const nextType = mediaTypeFilter.value;

  const sameList = currentList === nextList;
  const sameLabel = currentLabel === nextLabel;
  const sameQuery = currentQuery === nextQuery;
  const sameType = currentType === nextType;

  if (sameList && sameLabel && sameQuery && sameType) {
    return;
  }

  const mergedQuery = {
    ...route.query,
    list: nextList || undefined,
    label: nextLabel || undefined,
    q: nextQuery || undefined,
    type: nextType === "all" ? undefined : nextType,
  };

  await router.replace({ query: mergedQuery });
};

const setLabelFilter = (label: string): void => {
  if (activeLabelFilter.value === label) {
    activeLabelFilter.value = null;
  } else {
    activeLabelFilter.value = label;
  }
};

const clearListFilters = (): void => {
  activeLabelFilter.value = null;
};

const openLabelsModal = (): void => {
  labelsSearchQuery.value = "";
  isLabelsModalOpen.value = true;
};

const closeLabelsModal = (): void => {
  labelsSearchQuery.value = "";
  isLabelsModalOpen.value = false;
};

const clearItemFilters = (): void => {
  titleQuery.value = "";
  mediaTypeFilter.value = "all";
};

const loadLists = async (): Promise<void> => {
  if (!userId.value) {
    return;
  }

  try {
    await userListsStore.fetchLists(userId.value);

    if (pendingRouteListId.value) {
      const byRoute = userListsStore.sortedLists.find(
        (list) => list.id === pendingRouteListId.value
      );

      if (byRoute) {
        selectedListId.value = byRoute.id;
        pendingRouteListId.value = null;
      }
    }

    if (!selectedListId.value && filteredLists.value.length > 0) {
      selectedListId.value = filteredLists.value[0].id;
    }
  } catch {
    message.error(userListsStore.isError || "Не удалось загрузить списки");
  }
};

const loadSelectedList = async (listId: string): Promise<void> => {
  if (!userId.value) {
    return;
  }

  try {
    await userListsStore.fetchListById(userId.value, listId);
  } catch {
    message.error(userListsStore.isError || "Не удалось загрузить список");
  }
};

const removeMovieFromList = async (movieId: string): Promise<void> => {
  if (!userId.value || !selectedListId.value) {
    return;
  }

  isItemRemoving.value = true;

  try {
    await userListsStore.removeMovieFromList(
      userId.value,
      selectedListId.value,
      movieId
    );
    await userListsStore.fetchLists(userId.value);
    message.success("Тайтл удалён из списка");
  } catch {
    message.error(userListsStore.isError || "Не удалось удалить тайтл из списка");
  } finally {
    isItemRemoving.value = false;
  }
};

const repeatLoad = () => {
  return loadLists();
};

const deleteListById = async (listId: string, listName: string): Promise<void> => {
  if (!userId.value) {
    return;
  }

  isListDeleting.value = true;

  try {
    await userListsStore.deleteList(userId.value, listId);
    message.success(`Список «${listName}» удалён`);
  } catch {
    message.error(userListsStore.isError || "Не удалось удалить список");
  } finally {
    isListDeleting.value = false;
  }
};

watch(
  () => route.query,
  () => {
    applyStateFromRouteQuery();
  },
  { immediate: true }
);

watch(
  () => [
    selectedListId.value,
    activeLabelFilter.value,
    titleQuery.value,
    mediaTypeFilter.value,
  ],
  () => {
    void syncRouteQueryFromState();
  }
);

watch(
  () => selectedListId.value,
  (nextId) => {
    if (!nextId) {
      return;
    }

    void loadSelectedList(nextId);
  }
);

watch(
  () => filteredLists.value,
  (nextLists) => {
    if (nextLists.length === 0) {
      selectedListId.value = null;

      return;
    }

    if (!selectedListId.value) {
      selectedListId.value = nextLists[0].id;

      return;
    }

    const stillExists = nextLists.some((list) => list.id === selectedListId.value);
    if (!stillExists) {
      selectedListId.value = nextLists[0].id;
    }
  }
);

onMounted(() => {
  if (typeof window !== "undefined") {
    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);
  }

  void loadLists();
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", syncViewportWidth);
  }
});
</script>

<template>
  <div class="my-lists-page">
    <ListError
      v-if="userListsStore.isError && !hasLists"
      :is-error="userListsStore.isError"
      :repeat-fn="repeatLoad"
      repeat-text="Повторить"
    />

    <ListLoading
      v-else-if="userListsStore.isLoading && !hasLists"
      :center="true"
      loading-text="Загружаем ваши списки..."
      size="large"
    />

    <div v-else-if="!hasLists" class="my-lists-page__empty">
      <a-empty description="Пока нет пользовательских списков">
        <template #description>
          Создайте первый список из карточки фильма или сериала через кнопку
          «В список».
        </template>
      </a-empty>
    </div>

    <div v-else class="my-lists-page__layout">
      <aside class="my-lists-page__aside">
        <div v-if="allLabels.length" class="my-lists-page__labels-filter">
          <div class="my-lists-page__labels-filter-head">
            <p class="my-lists-page__labels-filter-title">Фильтр по меткам</p>
            <a-button
              v-if="activeLabelFilter"
              type="link"
              size="small"
              @click="clearListFilters"
            >
              Сброс
            </a-button>
          </div>

          <div class="my-lists-page__labels-filter-list">
            <button
              v-for="label in inlineLabels"
              :key="`label-filter-${label}`"
              type="button"
              class="my-lists-page__labels-filter-chip"
              :class="{
                'my-lists-page__labels-filter-chip_active': activeLabelFilter === label,
              }"
              @click="setLabelFilter(label)"
            >
              {{ label }}
            </button>

            <button
              v-if="hasHiddenLabels"
              type="button"
              class="my-lists-page__labels-filter-more-btn"
              @click="openLabelsModal"
            >
              {{ moreLabelsButtonText }}
            </button>
          </div>
        </div>

        <div v-if="!hasFilteredLists" class="my-lists-page__aside-empty">
          По выбранной метке списков нет
        </div>

        <div
          v-for="list in filteredLists"
          :key="list.id"
          class="my-lists-page__list-tab-row"
        >
          <button
            type="button"
            class="my-lists-page__list-tab"
            :class="{
              'my-lists-page__list-tab_active': selectedListId === list.id,
            }"
            @click="selectedListId = list.id"
          >
            <span class="my-lists-page__list-tab-title">{{ list.name }}</span>
            <span class="my-lists-page__list-tab-count">
              {{ formatTitlesCount(list._count.items) }}
            </span>
          </button>

          <a-popconfirm
            title="Удалить этот список?"
            :description="
              list._count.items > 0
                ? 'Тайтлы останутся в вашей коллекции, но пропадут из списка.'
                : 'Пустой список будет удалён безвозвратно.'
            "
            ok-text="Удалить"
            cancel-text="Отмена"
            ok-type="danger"
            :disabled="isListDeleting"
            @confirm="deleteListById(list.id, list.name)"
          >
            <button
              type="button"
              class="my-lists-page__list-tab-delete"
              :disabled="isListDeleting"
              :aria-label="`Удалить список «${list.name}»`"
              @click.stop
            >
              <BaseIcon name="mdi:delete-outline" :width="18" :height="18" />
            </button>
          </a-popconfirm>
        </div>
      </aside>

      <section class="my-lists-page__content">
        <div v-if="!hasFilteredLists" class="my-lists-page__empty-list">
          <a-empty description="По выбранной метке ничего не найдено">
            <template #description>
              Сбросьте фильтр по метке или выберите другую метку слева.
            </template>
          </a-empty>
        </div>

        <ListLoading
          v-else-if="userListsStore.isLoading && !displayedCurrentList"
          :center="true"
          loading-text="Загружаем список..."
          size="large"
        />

        <template v-else-if="displayedCurrentList">
          <div class="my-lists-page__head">
            <div class="my-lists-page__head-text">
              <h2 class="my-lists-page__title">{{ displayedCurrentList.name }}</h2>
              <p class="my-lists-page__meta">
                {{ formatTitlesCount(currentListFilteredItems.length) }}
              </p>
            </div>

            <a-popconfirm
              title="Удалить этот список?"
              :description="
                isCurrentListTrulyEmpty
                  ? 'Пустой список будет удалён безвозвратно.'
                  : 'Тайтлы останутся в вашей коллекции, но пропадут из списка.'
              "
              ok-text="Удалить"
              cancel-text="Отмена"
              ok-type="danger"
              :disabled="isListDeleting"
              @confirm="
                deleteListById(displayedCurrentList.id, displayedCurrentList.name)
              "
            >
              <a-button
                danger
                :loading="isListDeleting"
                class="my-lists-page__delete-list-btn"
                @click.stop
              >
                <BaseIcon name="mdi:delete-outline" :width="18" :height="18" />
                Удалить список
              </a-button>
            </a-popconfirm>
          </div>

          <div v-if="displayedCurrentList.labels.length" class="my-lists-page__labels">
            <button
              v-for="label in displayedCurrentList.labels"
              :key="`${displayedCurrentList.id}-${label}`"
              type="button"
              class="my-lists-page__label"
              :class="{ 'my-lists-page__label_active': activeLabelFilter === label }"
              @click="setLabelFilter(label)"
            >
              {{ label }}
            </button>
          </div>

          <div class="my-lists-page__filters">
            <a-input
              v-model:value="titleQuery"
              class="my-lists-page__search"
              size="middle"
              allow-clear
              placeholder="Поиск по названию в выбранном списке"
            />
            <a-segmented
              v-model:value="mediaTypeFilter"
              :options="[
                { label: 'Все', value: 'all' },
                { label: 'Фильмы', value: 'movies' },
                { label: 'Сериалы', value: 'serials' },
              ]"
            />
            <a-button size="small" @click="clearItemFilters">Сброс фильтров</a-button>
          </div>

          <div
            v-if="!currentListFilteredItems.length"
            class="my-lists-page__empty-list"
          >
            <a-empty
              :description="
                isCurrentListTrulyEmpty
                  ? 'В этом списке пока пусто'
                  : 'Ничего не найдено по текущим фильтрам'
              "
            />
          </div>

          <div v-else class="my-lists-page__grid">
            <article
              v-for="item in currentListFilteredItems"
              :key="item.id"
              class="list-item-card"
            >
              <button
                type="button"
                class="list-item-card__main"
                @click="openMovieDetail(item.movieId)"
              >
                <img
                  :src="getPosterSrc(item)"
                  :alt="`${item.movie.title} постер`"
                  class="list-item-card__poster"
                  loading="lazy"
                  @error="handleImageError(item.movieId)"
                />

                <div class="list-item-card__body">
                  <h3 class="list-item-card__title">
                    {{ item.movie.title }}
                    <span v-if="item.movie.isSerial" class="list-item-card__type">
                      (сериал)
                    </span>
                  </h3>
                  <div class="list-item-card__meta">
                    <BaseIcon name="mdi:calendar-blank-outline" />
                    <span>{{
                      item.movie.publishDate
                        ? formatYear(item.movie.publishDate)
                        : "Год не указан"
                    }}</span>
                  </div>
                </div>
              </button>

              <a-button
                size="small"
                danger
                :loading="isItemRemoving"
                @click="removeMovieFromList(item.movieId)"
              >
                Удалить
              </a-button>
            </article>
          </div>
        </template>

        <div v-else class="my-lists-page__empty-list">
          <a-empty description="Выберите список в левой колонке" />
        </div>
      </section>
    </div>
  </div>

  <BaseModal v-model="isLabelsModalOpen" layout="detail">
    <template #title>Выбор метки</template>

    <template #body>
      <div class="labels-modal">
        <div class="labels-modal__head">
          <span class="labels-modal__hint"
            >Показаны все доступные метки для фильтрации списков</span
          >
          <a-button
            v-if="activeLabelFilter"
            type="link"
            size="small"
            @click="clearListFilters"
          >
            Сбросить метку
          </a-button>
        </div>

        <a-input
          v-model:value="labelsSearchQuery"
          class="labels-modal__search"
          allow-clear
          placeholder="Поиск метки"
        />

        <div v-if="!modalFilteredLabels.length" class="labels-modal__empty">
          Ничего не найдено по запросу
        </div>

        <div class="labels-modal__chips">
          <button
            v-for="label in modalFilteredLabels"
            :key="`modal-label-${label}`"
            type="button"
            class="labels-modal__chip"
            :class="{ 'labels-modal__chip_active': activeLabelFilter === label }"
            @click="setLabelFilter(label)"
          >
            {{ label }}
          </button>
        </div>
      </div>
    </template>

    <template #footer>
      <a-button @click="closeLabelsModal">Готово</a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.my-lists-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__empty {
    border-radius: 16px;
    padding: 1.5rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  &__layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;

    @include mediaTablet {
      grid-template-columns: 280px 1fr;
      align-items: flex-start;
      gap: 1.25rem;
    }
  }

  &__aside {
    display: grid;
    gap: 0.6rem;
    border-radius: 16px;
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  &__labels-filter {
    display: grid;
    gap: 0.45rem;
    padding: 0.55rem;
    border: 1px dashed color-mix(in srgb, var(--border-color) 75%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-secondary) 55%, transparent);
  }

  &__labels-filter-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  &__labels-filter-title {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__labels-filter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  &__labels-filter-chip {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.52rem;
    cursor: pointer;

    &_active {
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 42%,
        transparent
      );
      color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
    }
  }

  &__labels-filter-more-btn {
    border: 1px dashed
      color-mix(in srgb, var(--ant-color-primary) 36%, var(--border-color));
    background: var(--bg-primary);
    color: var(--ant-color-primary);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.52rem;
    cursor: pointer;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__aside-empty {
    border: 1px dashed var(--border-color);
    border-radius: 12px;
    padding: 0.55rem;
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  &__list-tab-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.35rem;
    align-items: center;
  }

  &__list-tab-delete {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      color 0.2s ease,
      background 0.2s ease;

    &:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--ant-color-error) 45%, var(--border-color));
      color: var(--ant-color-error);
      background: color-mix(in srgb, var(--ant-color-error) 8%, var(--bg-primary));
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &__list-tab {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 0.65rem 0.75rem;
    background: var(--bg-secondary);
    display: grid;
    gap: 0.2rem;
    text-align: left;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
    cursor: pointer;

    &_active {
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 45%,
        var(--border-color)
      );
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
    }
  }

  &__list-tab-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  &__list-tab-count {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  &__content {
    border-radius: 16px;
    padding: 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  &__filters {
    margin-bottom: 0.9rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }

  &__search {
    width: min(420px, 100%);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__head-text {
    min-width: 0;
    flex: 1 1 auto;
  }

  &__delete-list-btn {
    flex-shrink: 0;
  }

  &__title {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  &__meta {
    margin: 0.35rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.88rem;
    font-weight: 600;
  }

  &__labels {
    margin-top: 0.7rem;
    margin-bottom: 0.9rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  &__label {
    appearance: none;
    border: 1px solid color-mix(in srgb, var(--ant-color-primary) 35%, transparent);
    background: color-mix(in srgb, var(--ant-color-primary) 10%, var(--bg-primary));
    color: var(--ant-color-primary);
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.18rem 0.55rem;
    cursor: pointer;

    &_active {
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 60%,
        transparent
      );
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 18%,
        var(--bg-primary)
      );
    }
  }

  &__empty-list {
    padding: 1.2rem 0.3rem;
  }

  &__grid {
    display: grid;
    gap: 0.75rem;
  }
}

.labels-modal {
  display: grid;
  gap: 0.75rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  &__hint {
    color: var(--text-secondary);
    font-size: 0.84rem;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  &__search {
    width: min(360px, 100%);
  }

  &__empty {
    color: var(--text-secondary);
    font-size: 0.84rem;
    border: 1px dashed var(--border-color);
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
    background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
  }

  &__chip {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.2rem 0.62rem;
    cursor: pointer;

    &_active {
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 50%,
        transparent
      );
      color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 12%,
        var(--bg-primary)
      );
    }
  }
}

.list-item-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-secondary) 65%, transparent);
  padding: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  &__main {
    border: none;
    width: 100%;
    background: transparent;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    text-align: left;
  }

  &__poster {
    width: 56px;
    height: 78px;
    border-radius: 8px;
    object-fit: cover;
    border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  }

  &__body {
    min-width: 0;
    display: grid;
    gap: 0.35rem;
  }

  &__title {
    margin: 0;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 700;
  }

  &__type {
    color: var(--text-secondary);
    font-weight: 500;
  }

  &__meta {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-secondary);
    font-size: 0.82rem;
  }
}
</style>
