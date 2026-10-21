<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import { useUserListsStore } from "@/stores";
import {
  DEFAULT_LIST_COLOR,
  LIST_COLOR_SWATCHES,
} from "@/constants/listColors";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";
import { FETCH_METHOD, useFetch } from "@/composable";
import { PLURAL, pluralize } from "@/utils";
import { parseListLabels } from "@/utils/list-labels";
import type { UserListDetail, UserListSummary } from "@/stores/userLists/types";
import { createRequestGuard } from "@/utils/requestGuard";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ userId: string; movieId: string | null }>();
const userListsStore = useUserListsStore();
const newListName = ref("");
const newListLabelsInput = ref("");
const newListColor = ref<string>(DEFAULT_LIST_COLOR);
const isListActionLoading = ref(false);
const listIdsWithCurrentMovie = ref<Set<string>>(new Set());
const presenceRequests = createRequestGuard();
const addedListIds = new Set<string>();
let contextRevision = 0;
const availableUserLists = computed<UserListSummary[]>(() => {
  return userListsStore.sortedLists;
});

const isMovieAlreadyInList = (listId: string): boolean => {
  return listIdsWithCurrentMovie.value.has(listId);
};

const formatTitlesCount = (count: number): string =>
  pluralize(count, PLURAL.title);

const loadLists = async (): Promise<void> => {
  if (!props.userId) {
    return;
  }

  const revision = contextRevision;

  try {
    await userListsStore.fetchLists(props.userId);
    if (revision !== contextRevision) return;
    await refreshMoviePresenceInLists();
  } catch {
    if (revision === contextRevision)
      message.error(userListsStore.isError || "Не удалось загрузить списки");
  }
};

const refreshMoviePresenceInLists = async (): Promise<void> => {
  const { userId, movieId } = props;
  const isCurrent = presenceRequests.begin();

  if (!userId || !movieId) {
    listIdsWithCurrentMovie.value = new Set();

    return;
  }

  const nextPresence = new Set<string>();

  await Promise.all(
    availableUserLists.value.map(async (list) => {
      try {
        const response = await useFetch<UserListDetail>(
          `/users/${userId}/lists/${list.id}`,
          {
            method: FETCH_METHOD.get,
          }
        );

        if (response.status !== 200) {
          return;
        }

        const containsMovie = response.data.items.some(
          (item) => item.movieId === movieId
        );

        if (containsMovie) {
          nextPresence.add(list.id);
        }
      } catch {
        /* ignore one broken list fetch and continue others */
      }
    })
  );

  if (isCurrent()) {
    listIdsWithCurrentMovie.value = new Set([...nextPresence, ...addedListIds]);
  }
};

const createListFromModal = async (): Promise<void> => {
  if (!props.userId || !newListName.value.trim()) {
    message.warning("Введите название списка");

    return;
  }

  isListActionLoading.value = true;

  const revision = contextRevision;

  try {
    const created = await userListsStore.createList(props.userId, {
      name: newListName.value.trim(),
      color: newListColor.value,
      labels: parseListLabels(newListLabelsInput.value),
    });

    if (revision !== contextRevision) return;

    newListName.value = "";
    newListLabelsInput.value = "";
    newListColor.value = DEFAULT_LIST_COLOR;
    await refreshMoviePresenceInLists();
    if (revision === contextRevision)
      message.success(`Список «${created.name}» создан`);
  } catch (error: unknown) {
    if (revision !== contextRevision) return;

    const text = getApiResponseMessage(error);

    message.error(text || "Не удалось создать список");
  } finally {
    if (revision === contextRevision) isListActionLoading.value = false;
  }
};

const addMovieToList = async (listId: string): Promise<void> => {
  if (!props.userId || !props.movieId) {
    return;
  }

  isListActionLoading.value = true;

  const revision = contextRevision;
  const { userId, movieId } = props;

  try {
    await userListsStore.addMovieToList(userId, listId, movieId);

    if (revision !== contextRevision) return;
    addedListIds.add(listId);

    listIdsWithCurrentMovie.value = new Set([
      ...listIdsWithCurrentMovie.value,
      listId,
    ]);

    await userListsStore.fetchLists(userId);
    if (revision === contextRevision)
      message.success("Произведение добавлено в список");
  } catch (error: unknown) {
    if (revision !== contextRevision) return;
    if (isApiConflictError(error)) {
      addedListIds.add(listId);
      listIdsWithCurrentMovie.value = new Set([
        ...listIdsWithCurrentMovie.value,
        listId,
      ]);

      message.warning("Произведение уже есть в этом списке");

      return;
    }

    const text = getApiResponseMessage(error);

    message.error(text || "Не удалось добавить фильм в список");
  } finally {
    if (revision === contextRevision) isListActionLoading.value = false;
  }
};

watch(
  [open, () => props.userId, () => props.movieId],
  ([value, userId, movieId], previous) => {
    contextRevision++;
    presenceRequests.invalidate();
    addedListIds.clear();
    isListActionLoading.value = false;
    if (userId !== previous?.[1] || movieId !== previous?.[2]) {
      listIdsWithCurrentMovie.value = new Set();
    }

    if (value) void loadLists();
  },
  { immediate: true, flush: "sync" }
);

onBeforeUnmount(() => {
  contextRevision++;
  presenceRequests.invalidate();
});
</script>

<template>
  <BaseModal v-model="open" layout="detail">
    <template #title>Добавить в пользовательский список</template>

    <template #body>
      <div class="lists-modal">
        <div class="lists-modal__create">
          <div
            class="lists-modal__preview"
            :style="{ background: newListColor }"
          >
            {{ newListName.trim() || "Новый список" }}
          </div>
          <a-input
            v-model:value="newListName"
            placeholder="Название списка"
            :maxlength="80"
            size="large"
          />
          <a-input
            v-model:value="newListLabelsInput"
            placeholder="Метки списка через запятую"
            :maxlength="140"
            size="large"
          />
          <div
            class="lists-modal__swatches"
            role="radiogroup"
            aria-label="Цвет обложки"
          >
            <button
              v-for="swatch in LIST_COLOR_SWATCHES"
              :key="swatch"
              type="button"
              class="lists-modal__swatch"
              :class="{
                'lists-modal__swatch--active': newListColor === swatch,
              }"
              :style="{ background: swatch }"
              :aria-label="`Цвет ${swatch}`"
              :aria-checked="newListColor === swatch"
              role="radio"
              @click="newListColor = swatch"
            ></button>
          </div>
          <a-button
            type="primary"
            :loading="isListActionLoading"
            :disabled="!newListName.trim()"
            @click="createListFromModal"
          >
            Создать список
          </a-button>
        </div>

        <RowsSkeleton
          v-if="userListsStore.isLoading"
          :count="3"
          :badge="false"
        />

        <div v-else-if="availableUserLists.length" class="lists-modal__list">
          <div
            v-for="list in availableUserLists"
            :key="list.id"
            class="lists-modal__list-item"
          >
            <div class="lists-modal__list-main">
              <div class="lists-modal__list-title">{{ list.name }}</div>
              <div class="lists-modal__list-meta">
                {{ formatTitlesCount(list._count.items) }}
              </div>
              <div v-if="list.labels.length" class="lists-modal__labels">
                <span
                  v-for="label in list.labels"
                  :key="`${list.id}-${label}`"
                  class="lists-modal__label"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <a-button
              v-if="!isMovieAlreadyInList(list.id)"
              size="small"
              :loading="isListActionLoading"
              @click="addMovieToList(list.id)"
            >
              Добавить
            </a-button>
          </div>
        </div>

        <div v-else class="lists-modal__empty">
          Пока нет списков. Создайте первый выше.
        </div>
      </div>
    </template>

    <template #footer>
      <a-button @click="open = false">Закрыть</a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.lists-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__create {
    display: grid;
    gap: 0.75rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid
      color-mix(in srgb, var(--fv-color-border) 65%, transparent);
  }

  &__preview {
    display: flex;
    align-items: flex-end;
    min-height: 64px;
    padding: 0.75rem 1rem;
    border-radius: var(--fv-radius-md);
    color: #fff;
    font-family: var(--fv-font-display);
    font-weight: 500;
    font-size: 1.1rem;
    text-align: left;
    box-shadow: var(--fv-shadow-low);
    transition: background var(--fv-motion-slow) var(--fv-ease);
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  &__swatch {
    width: 30px;
    height: 30px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 999px;
    cursor: pointer;
    outline-offset: 2px;
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--fv-color-text-primary) 12%, transparent);
    transition: transform var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      transform: scale(1.08);
    }

    &--active {
      border-color: var(--fv-color-bg-primary);
      box-shadow: 0 0 0 2px var(--fv-color-text-primary);
    }
  }

  &__list {
    display: grid;
    gap: 0.75rem;
  }

  &__list-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid var(--fv-color-border);
    background: color-mix(
      in srgb,
      var(--fv-color-bg-secondary) 75%,
      transparent
    );
  }

  &__list-main {
    display: grid;
    gap: 0.25rem;
  }

  &__list-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__list-meta {
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
  }

  &__labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    border: 1px solid
      color-mix(in srgb, var(--fv-color-accent) 35%, transparent);
    background: color-mix(
      in srgb,
      var(--fv-color-accent) 10%,
      var(--fv-color-bg-primary)
    );
    color: var(--fv-color-accent);
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.15rem 0.55rem;
    line-height: 1.3;
  }

  &__empty {
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px dashed var(--fv-color-border);
    color: var(--fv-color-text-secondary);
  }
}
</style>
