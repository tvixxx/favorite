<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";

import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ConfirmDialog from "@/components/ConfirmDialog/ConfirmDialog.vue";
import MovieCard from "@/components/MovieCard/MovieCard.vue";
import PosterGridSkeleton from "@/components/Skeleton/PosterGridSkeleton.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { useMainStore } from "@/state/state";
import { useUserListsStore } from "@/stores";
import { DEFAULT_LIST_COLOR, LIST_COLOR_SWATCHES } from "@/constants/listColors";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { movieCardMeta, movieCardTitle } from "@/utils";
import type { UserListItem, UserListSummary } from "@/stores/userLists/types";

const router = useRouter();
const route = useRoute();
const mainStore = useMainStore();
const userListsStore = useUserListsStore();

const userId = computed(() => mainStore.userData?.id ?? "");

/* ---------------------------------------------------------------- Списки */
const lists = computed<UserListSummary[]>(() => userListsStore.sortedLists);
const hasLists = computed(() => lists.value.length > 0);
const activeLabelFilter = ref<string | null>(null);

// min-display скелетона карточек списков
const showSkeleton = useMinLoading(
  () => userListsStore.isLoading && !hasLists.value,
);

const allLabels = computed(() => {
  const labels = new Set<string>();

  for (const list of lists.value) {
    for (const label of list.labels) {
      labels.add(label);
    }
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b, "ru"));
});

const filteredLists = computed(() => {
  const activeLabel = activeLabelFilter.value;

  if (!activeLabel) {
    return lists.value;
  }

  return lists.value.filter((list) => list.labels.includes(activeLabel));
});

const setLabelFilter = (label: string): void => {
  activeLabelFilter.value = activeLabelFilter.value === label ? null : label;
};

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

/* ---------------------------------------------------------- Загрузка */
const loadLists = async (): Promise<void> => {
  if (!userId.value) {
    return;
  }

  try {
    await userListsStore.fetchLists(userId.value);
  } catch {
    message.error(userListsStore.isError || "Не удалось загрузить списки");
  }
};

const repeatLoad = (): Promise<void> => loadLists();

/* ------------------------------------------------- Детальная модалка */
const detailListId = ref<string | null>(null);
const isDetailOpen = ref(false);
const imageErrors = ref<Set<string>>(new Set());
const isItemRemoving = ref(false);

const currentList = computed(() => userListsStore.currentList);
const displayedList = computed(() => {
  if (!detailListId.value || currentList.value?.id !== detailListId.value) {
    return null;
  }

  return currentList.value;
});

const currentListItems = computed<UserListItem[]>(
  () => displayedList.value?.items ?? [],
);

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

const openListDetail = async (listId: string): Promise<void> => {
  detailListId.value = listId;
  isDetailOpen.value = true;

  try {
    await userListsStore.fetchListById(userId.value, listId);
  } catch {
    message.error(userListsStore.isError || "Не удалось загрузить список");
  }
};

const closeListDetail = (): void => {
  isDetailOpen.value = false;
};

watch(isDetailOpen, (open) => {
  if (!open) {
    detailListId.value = null;
  }
});

// «Добавить кино»: список пополняется со страницы фильма («В список») — ведём в каталог
const addMovieToCurrentList = (): void => {
  closeListDetail();
  void router.push("/library/catalog");
};

const removeMovieFromList = async (movieId: string): Promise<void> => {
  if (!userId.value || !detailListId.value) {
    return;
  }

  isItemRemoving.value = true;

  try {
    await userListsStore.removeMovieFromList(
      userId.value,
      detailListId.value,
      movieId,
    );
    await userListsStore.fetchLists(userId.value);
    message.success("Тайтл удалён из списка");
  } catch {
    message.error(userListsStore.isError || "Не удалось удалить тайтл из списка");
  } finally {
    isItemRemoving.value = false;
  }
};

/* --------------------------------------------------------- Удаление */
const isListDeleting = ref(false);

const deleteListById = async (
  listId: string,
  listName: string,
): Promise<void> => {
  if (!userId.value) {
    return;
  }

  isListDeleting.value = true;

  try {
    await userListsStore.deleteList(userId.value, listId);
    message.success(`Список «${listName}» удалён`);

    if (detailListId.value === listId) {
      isDetailOpen.value = false;
    }
  } catch {
    message.error(userListsStore.isError || "Не удалось удалить список");
  } finally {
    isListDeleting.value = false;
  }
};

// Подтверждение удаления списка (диалог/шторка вместо popconfirm)
const isDeleteConfirmOpen = ref(false);

const deleteConfirmDescription = computed(() => {
  const list = displayedList.value;

  if (!list) {
    return "";
  }

  return list.items.length
    ? `«${list.name}» и тайтлы в нём. Тайтлы останутся в коллекции, но пропадут из списка.`
    : `«${list.name}» будет удалён безвозвратно.`;
});

const confirmDeleteList = async (): Promise<void> => {
  const list = displayedList.value;

  if (!list) {
    return;
  }

  await deleteListById(list.id, list.name);
  isDeleteConfirmOpen.value = false;
};

/* --------------------------------------------- Создание / изменение */
const isFormOpen = ref(false);
const editingListId = ref<string | null>(null);
const formName = ref("");
const formDescription = ref("");
const formLabelsInput = ref("");
const formColor = ref<string>(DEFAULT_LIST_COLOR);
const isFormSubmitting = ref(false);

const isEditing = computed(() => editingListId.value !== null);
const formTitle = computed(() =>
  isEditing.value ? "Редактировать список" : "Новый список",
);
const formSubmitText = computed(() =>
  isEditing.value ? "Сохранить" : "Создать список",
);

const parseListLabels = (raw: string): string[] => {
  const unique = new Set<string>();

  for (const chunk of raw.split(",")) {
    const normalized = chunk.trim();

    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
};

const openCreateForm = (): void => {
  editingListId.value = null;
  formName.value = "";
  formDescription.value = "";
  formLabelsInput.value = "";
  formColor.value = DEFAULT_LIST_COLOR;
  isFormOpen.value = true;
};

const openEditForm = (list: {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  labels: string[];
}): void => {
  editingListId.value = list.id;
  formName.value = list.name;
  formDescription.value = list.description ?? "";
  formLabelsInput.value = list.labels.join(", ");
  formColor.value = list.color || DEFAULT_LIST_COLOR;
  isDetailOpen.value = false;
  isFormOpen.value = true;
};

const closeForm = (): void => {
  isFormOpen.value = false;
};

// Синхронизируем query-флаг ?create=1 (кнопка «Новый список» в шапке медиатеки)
watch(isFormOpen, (open) => {
  if (!open && route.query.create) {
    const nextQuery = { ...route.query };
    delete nextQuery.create;
    void router.replace({ query: nextQuery });
  }
});

const submitForm = async (): Promise<void> => {
  const name = formName.value.trim();

  if (!userId.value || !name) {
    return;
  }

  isFormSubmitting.value = true;

  const payload = {
    name,
    description: formDescription.value.trim() || undefined,
    color: formColor.value,
    labels: parseListLabels(formLabelsInput.value),
  };

  try {
    if (editingListId.value) {
      await userListsStore.updateList(userId.value, editingListId.value, payload);
      message.success("Список обновлён");
    } else {
      const created = await userListsStore.createList(userId.value, payload);
      message.success(`Список «${created.name}» создан`);
    }

    await userListsStore.fetchLists(userId.value);
    closeForm();
  } catch {
    message.error(userListsStore.isError || "Не удалось сохранить список");
  } finally {
    isFormSubmitting.value = false;
  }
};

watch(
  () => route.query.create,
  (value) => {
    if (value && !isFormOpen.value) {
      openCreateForm();
    }
  },
  { immediate: true },
);

onMounted(() => {
  void loadLists();
});
</script>

<template>
  <div class="my-lists-page">
    <StateBlock
      v-if="userListsStore.isError && !hasLists"
      v-bind="STATE_PRESETS.listsError"
      :actions="[
        {
          label: 'Повторить',
          icon: 'ph:arrow-clockwise',
          kind: 'primary',
          onClick: repeatLoad,
        },
      ]"
    />

    <div v-else-if="showSkeleton" class="my-lists-page__grid">
      <div
        v-for="skel in 6"
        :key="`skel-${skel}`"
        class="list-card list-card--skel"
      >
        <SkeletonBar height="128px" radius="0" />
        <span class="list-card__body">
          <SkeletonBar height="18px" width="70%" radius="6px" />
          <SkeletonBar height="13px" width="90%" radius="6px" />
          <SkeletonBar height="13px" width="40%" radius="6px" />
        </span>
      </div>
    </div>

    <StateBlock
      v-else-if="!hasLists"
      v-bind="STATE_PRESETS.listsEmpty"
      :actions="[
        {
          label: 'Создать список',
          icon: 'ph:plus',
          kind: 'primary',
          onClick: openCreateForm,
        },
      ]"
    />

    <template v-else>
      <div v-if="allLabels.length" class="my-lists-page__labels-bar">
        <button
          v-for="label in allLabels"
          :key="`filter-${label}`"
          type="button"
          class="my-lists-page__label-chip"
          :class="{
            'my-lists-page__label-chip--active': activeLabelFilter === label,
          }"
          @click="setLabelFilter(label)"
        >
          {{ label }}
        </button>

        <button
          v-if="activeLabelFilter"
          type="button"
          class="my-lists-page__labels-reset"
          @click="activeLabelFilter = null"
        >
          Сбросить
        </button>
      </div>

      <div class="my-lists-page__grid">
        <button
          v-for="list in filteredLists"
          :key="list.id"
          type="button"
          class="list-card"
          @click="openListDetail(list.id)"
        >
          <span
            class="list-card__band"
            :style="{ background: list.color || 'var(--fv-color-brand)' }"
            aria-hidden="true"
          >
            <BaseIcon
              name="ph:bookmarks-simple-fill"
              class="list-card__icon"
              :width="40"
              :height="40"
            />
            <span class="list-card__count">
              {{ formatTitlesCount(list._count.items) }}
            </span>
          </span>

          <span class="list-card__body">
            <span class="list-card__name">{{ list.name }}</span>
            <span v-if="list.description" class="list-card__desc">
              {{ list.description }}
            </span>

            <span class="list-card__open">Открыть список →</span>
          </span>
        </button>

        <button
          type="button"
          class="list-card list-card--create"
          @click="openCreateForm"
        >
          <span class="list-card--create__icon">
            <BaseIcon name="ph:plus" :width="28" :height="28" />
          </span>
          <span class="list-card--create__title">Создать список</span>
          <span class="list-card--create__hint">
            Соберите свою подборку фильмов и сериалов
          </span>
        </button>
      </div>

      <div
        v-if="hasLists && activeLabelFilter && !filteredLists.length"
        class="my-lists-page__hint"
      >
        По выбранной метке списков нет — сбросьте фильтр или выберите другую метку.
      </div>
    </template>

    <BaseModal v-model="isFormOpen" layout="form">
      <template #title>{{ formTitle }}</template>

      <template #body>
        <div class="list-form">
          <div class="list-form__preview" :style="{ background: formColor }">
            <BaseIcon
              name="ph:bookmarks-simple-fill"
              class="list-form__preview-icon"
              :width="24"
              :height="24"
            />
            <span class="list-form__preview-name">
              {{ formName.trim() || "Новый список" }}
            </span>
          </div>

          <label class="list-form__field">
            <span class="list-form__label">Название</span>
            <a-input
              v-model:value="formName"
              placeholder="Например, Вечер выходного"
              :maxlength="80"
              size="large"
            />
          </label>

          <label class="list-form__field">
            <span class="list-form__label">
              Описание <span class="list-form__label-hint">— необязательно</span>
            </span>
            <a-textarea
              v-model:value="formDescription"
              placeholder="Пара слов о подборке"
              :maxlength="240"
              :auto-size="{ minRows: 2, maxRows: 4 }"
            />
          </label>

          <label class="list-form__field">
            <span class="list-form__label">
              Метки <span class="list-form__label-hint">— через запятую</span>
            </span>
            <a-input
              v-model:value="formLabelsInput"
              placeholder="уютно, с друзьями"
              :maxlength="140"
              size="large"
            />
          </label>

          <div class="list-form__field">
            <span class="list-form__label">Цвет обложки</span>
            <div
              class="list-form__swatches"
              role="radiogroup"
              aria-label="Цвет обложки"
            >
              <button
                v-for="swatch in LIST_COLOR_SWATCHES"
                :key="swatch"
                type="button"
                class="list-form__swatch"
                :class="{ 'list-form__swatch--active': formColor === swatch }"
                :style="{ background: swatch }"
                :aria-label="`Цвет ${swatch}`"
                :aria-checked="formColor === swatch"
                role="radio"
                @click="formColor = swatch"
              >
                <BaseIcon
                  v-if="formColor === swatch"
                  name="ph:check-bold"
                  :width="18"
                  :height="18"
                />
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <a-button @click="closeForm">Отмена</a-button>
        <a-button
          type="primary"
          :loading="isFormSubmitting"
          :disabled="!formName.trim()"
          @click="submitForm"
        >
          {{ formSubmitText }}
        </a-button>
      </template>
    </BaseModal>

    <BaseModal v-model="isDetailOpen" headerless>
      <template #body>
        <div class="list-detail-modal">
          <header
            class="list-detail-modal__cover"
            :style="{
              background: displayedList?.color || 'var(--fv-color-brand)',
            }"
          >
            <div class="list-detail-modal__cover-actions">
              <button
                v-if="displayedList"
                type="button"
                class="list-detail-modal__icon-btn"
                aria-label="Изменить список"
                @click="openEditForm(displayedList)"
              >
                <BaseIcon name="ph:pencil-simple" :width="18" :height="18" />
              </button>
              <button
                type="button"
                class="list-detail-modal__icon-btn"
                aria-label="Закрыть"
                @click="closeListDetail"
              >
                <BaseIcon name="ph:x" :width="18" :height="18" />
              </button>
            </div>

            <h3 class="list-detail-modal__title">
              {{ displayedList?.name || "Список" }}
            </h3>
            <p class="list-detail-modal__subtitle">
              <template v-if="displayedList?.description"
                >{{ displayedList.description }} · </template
              >{{ formatTitlesCount(currentListItems.length) }}
            </p>
          </header>

          <div class="list-detail-modal__content">
            <PosterGridSkeleton
              v-if="userListsStore.isLoading && !displayedList"
              :count="4"
              :min-width="128"
            />

            <StateBlock
              v-else-if="displayedList && !currentListItems.length"
              compact
              v-bind="STATE_PRESETS.listInsideEmpty"
            />

            <div v-else-if="displayedList" class="list-detail-modal__row">
              <MovieCard
                v-for="item in currentListItems"
                :key="item.id"
                :poster-src="getPosterSrc(item)"
                :title="movieCardTitle(item.movie)"
                :meta="movieCardMeta(item.movie)"
                deletable
                @open="openMovieDetail(item.movieId)"
                @delete="removeMovieFromList(item.movieId)"
                @poster-error="handleImageError(item.movieId)"
              />
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="list-detail-modal__footer">
          <button
            v-if="displayedList"
            type="button"
            class="list-detail-modal__btn list-detail-modal__btn--danger"
            :disabled="isListDeleting"
            @click="isDeleteConfirmOpen = true"
          >
            <AppSpinner v-if="isListDeleting" :size="18" />
            <BaseIcon v-else name="ph:trash" :width="18" :height="18" />
            Удалить
          </button>

          <button
            type="button"
            class="list-detail-modal__btn list-detail-modal__btn--primary"
            @click="addMovieToCurrentList"
          >
            <BaseIcon name="ph:plus" :width="18" :height="18" />
            Добавить кино
          </button>
        </div>
      </template>
    </BaseModal>

    <ConfirmDialog
      v-model="isDeleteConfirmOpen"
      title="Удалить этот список?"
      :description="deleteConfirmDescription"
      :loading="isListDeleting"
      @confirm="confirmDeleteList"
    />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/layout" as *;
@use "@/styles/media" as *;

.my-lists-page {
  @include pageContentContainer;
  align-items: stretch; // содержимое во всю ширину контейнера, не по центру
  gap: 1.25rem;
  text-align: left; // перебиваем глобальный #app { text-align: center }

  &__labels-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }

  &__label-chip {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      border-color: var(--fv-color-accent);
      color: var(--fv-color-accent);
    }

    &--active {
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
      border-color: transparent;
    }
  }

  &__labels-reset {
    margin-left: auto;
    border: 0;
    background: none;
    color: var(--fv-color-accent);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }

  &__hint {
    margin: 0;
    color: var(--fv-color-text-secondary);
    font-size: 0.95rem;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    width: 100%;
  }
}

/* Карточка списка (эталон): цветная шапка + тело */
.list-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  padding: 0;
  border: 1px solid
    color-mix(in srgb, var(--fv-color-border) 55%, transparent);
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-card);
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: var(--fv-shadow-elevated);
  }

  // Скелетон карточки списка — без интерактива
  &--skel {
    cursor: default;

    &:hover {
      transform: none;
      box-shadow: var(--fv-shadow-card);
    }
  }

  &__band {
    position: relative;
    height: 128px;
    padding: 16px;
    color: #fff;
  }

  &__icon {
    position: absolute;
    top: 16px;
    right: 16px;
    color: rgba(255, 255, 255, 0.85);
  }

  &__count {
    position: absolute;
    left: 16px;
    bottom: 16px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: rgba(0, 0, 0, 0.72);
    font-size: 0.8rem;
    font-weight: 600;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    padding: 16px 18px 18px;
  }

  &__name {
    font-size: 1.2rem;
    font-weight: 500;
    line-height: 1.3;
    color: var(--fv-color-text-primary);
  }

  &__desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--fv-color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  &__open {
    margin-top: auto;
    padding-top: 6px;
    color: var(--fv-color-accent);
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Карточка «Создать список» — пунктирная */
  &--create {
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 220px;
    padding: 24px;
    text-align: center;
    background: color-mix(in srgb, var(--fv-color-bg-secondary) 55%, transparent);
    border: 1.5px dashed
      color-mix(in srgb, var(--fv-color-border) 85%, transparent);
    box-shadow: none;

    &:hover {
      border-color: var(--fv-color-accent);
      transform: translateY(-4px);
    }

    &__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--fv-color-bg-primary);
      color: var(--fv-color-accent);
    }

    &__title {
      font-family: var(--fv-font-display);
      font-size: 1.05rem;
      font-weight: 500;
      color: var(--fv-color-text-primary);
    }

    &__hint {
      max-width: 15rem;
      color: var(--fv-color-text-secondary);
      font-size: 0.85rem;
      line-height: 1.4;
    }
  }
}

/* Модалка создания / редактирования */
.list-form {
  display: flex;
  flex-direction: column;
  gap: 14px;

  &__preview {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 80px;
    padding: 14px;
    border-radius: var(--fv-radius-md);
    color: #fff;
    overflow: hidden;
  }

  &__preview-icon {
    position: absolute;
    top: 14px;
    right: 14px;
    color: rgba(255, 255, 255, 0.85);
  }

  // Бледно-красная плашка-название — компактная (эталон)
  &__preview-name {
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.2;
    word-break: break-word;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fv-color-text-primary);
  }

  &__label-hint {
    font-weight: 400;
    color: var(--fv-color-text-tertiary);
  }

  &__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: var(--fv-radius-sm);
    border: 0;
    color: #fff;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      transform: scale(1.06);
    }

    &--active {
      box-shadow:
        0 0 0 2px var(--fv-color-bg-primary),
        0 0 0 4px var(--fv-color-text-primary);
    }
  }
}

/* Модалка деталей списка */
/* Модалка деталей списка (эталон): цветная обложка + постеры + футер */
.list-detail-modal {
  display: flex;
  flex-direction: column;

  &__cover {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 116px;
    padding: 22px 24px 20px;
    color: #fff;
    // верхние углы скругляются overflow:hidden на .modal
  }

  &__cover-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
  }

  &__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.24);
    backdrop-filter: blur(4px);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.38);
    }
  }

  &__title {
    margin: 0;
    padding-right: 88px; // не заезжаем под кнопки
    font-family: var(--fv-font-display);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1.15;
    word-break: break-word;
  }

  &__subtitle {
    margin: 6px 0 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.85);
  }

  &__content {
    padding: 20px 24px 8px;
  }

  // Ряд постеров (эталон): компактные карточки, перенос по строкам
  &__row {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 14px;

    :deep(.movie-card) {
      flex: 0 0 128px;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 46px;
    padding: 0 22px;
    border: 0;
    border-radius: var(--fv-radius-sm);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background 0.15s ease,
      opacity 0.15s ease;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &--danger {
      background: color-mix(in srgb, var(--fv-color-brand) 12%, transparent);
      color: var(--fv-color-brand);

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fv-color-brand) 20%, transparent);
      }
    }

    &--primary {
      background: var(--fv-color-brand);
      color: #fff;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
      }
    }
  }
}
</style>
