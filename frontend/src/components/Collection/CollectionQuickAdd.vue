<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useUserMoviesStore } from "@/stores";
import type { MovieApiResponse } from "@/stores/movies/types";
import { FETCH_METHOD, useFetch } from "@/composable";
import { useEscapeKey } from "@/composable/useEscapeKey";
import { formatYear } from "@/utils";
import { contentTypeLabel } from "@/utils/content-kind";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";

const props = defineProps<{
  userId: string;
  enabled: boolean;
  watchTonightEnabled: boolean;
}>();
const emit = defineEmits<{ watchTonight: [] }>();
const userMoviesStore = useUserMoviesStore();

interface QuickAddOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const QUICK_ADD_MIN_QUERY_LENGTH = 2;
const QUICK_ADD_DEBOUNCE_MS = 280;
const QUICK_ADD_OPTIONS_LIMIT = 10;

type QuickAddMovie = Pick<
  MovieApiResponse,
  "id" | "title" | "isSerial" | "contentKind" | "publishDate"
> & { inCollection: boolean };

let quickAddRequest = 0;

const quickAddQuery = ref("");
const quickAddOptions = ref<QuickAddOption[]>([]);
const isQuickAddLoading = ref(false);
const isQuickAddPanelOpen = ref(false);
const quickAddFabRoot = ref<HTMLElement | null>(null);
let quickAddDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const resetQuickAddState = (): void => {
  quickAddRequest++;
  quickAddQuery.value = "";
  quickAddOptions.value = [];
  isQuickAddLoading.value = false;

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }
};

const openQuickAddPanel = (): void => {
  isQuickAddPanelOpen.value = true;
};

const closeQuickAddPanel = (): void => {
  resetQuickAddState();
  isQuickAddPanelOpen.value = false;
};

watch(
  () => props.enabled,
  (visible) => {
    if (!visible) closeQuickAddPanel();
  }
);

useEscapeKey(isQuickAddPanelOpen, closeQuickAddPanel);

const toggleQuickAddPanel = (): void => {
  if (isQuickAddPanelOpen.value) {
    closeQuickAddPanel();
  } else {
    openQuickAddPanel();
  }
};

const buildQuickAddOptionLabel = (
  movie: QuickAddMovie,
  isExisting: boolean
): string => {
  const mediaType = contentTypeLabel(movie).toLowerCase();
  const year = movie.publishDate
    ? formatYear(movie.publishDate)
    : "год не указан";
  const suffix = isExisting ? " • уже в коллекции" : "";

  return `${movie.title} • ${mediaType} • ${year}${suffix}`;
};

const fetchQuickAddOptions = async (query: string): Promise<void> => {
  const request = ++quickAddRequest;
  const q = query.trim();

  if (!q || q.length < QUICK_ADD_MIN_QUERY_LENGTH) {
    quickAddOptions.value = [];
    isQuickAddLoading.value = false;

    return;
  }

  isQuickAddLoading.value = true;

  try {
    const endpoint = `/movies/suggestions?q=${encodeURIComponent(
      q
    )}&limit=${QUICK_ADD_OPTIONS_LIMIT}`;
    const { data, status } = await useFetch<QuickAddMovie[]>(endpoint, {
      method: FETCH_METHOD.get,
    });

    if (status !== 200) {
      throw new Error("Не удалось загрузить подсказки");
    }

    if (request !== quickAddRequest) return;

    const prepared = data.map((movie) => {
      const isExisting = movie.inCollection;

      return {
        value: movie.id,
        label: buildQuickAddOptionLabel(movie, isExisting),
        disabled: isExisting,
      };
    });

    quickAddOptions.value = prepared;
  } catch {
    if (request === quickAddRequest) quickAddOptions.value = [];
  } finally {
    if (request === quickAddRequest) isQuickAddLoading.value = false;
  }
};

const handleQuickAddSearch = (value: string): void => {
  quickAddRequest++;
  quickAddQuery.value = value;
  quickAddOptions.value = [];

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }

  const q = value.trim();

  if (!q || q.length < QUICK_ADD_MIN_QUERY_LENGTH) {
    quickAddOptions.value = [];
    isQuickAddLoading.value = false;

    return;
  }

  quickAddDebounceTimer = setTimeout(() => {
    void fetchQuickAddOptions(value);
  }, QUICK_ADD_DEBOUNCE_MS);

  isQuickAddLoading.value = true;
};

const handleQuickAddSelect = async (movieId: string): Promise<void> => {
  if (!props.userId) {
    return;
  }

  try {
    await userMoviesStore.addUserMovie(props.userId, movieId, {});
    message.success("Тайтл добавлен в коллекцию");
    closeQuickAddPanel();
  } catch (error: unknown) {
    if (isApiConflictError(error)) {
      message.warning(
        getApiResponseMessage(error) ?? "Этот тайтл уже есть в коллекции"
      );

      return;
    }

    message.error(getApiResponseMessage(error) ?? "Не удалось добавить тайтл");
  }
};

const onGlobalPointerDown = (event: MouseEvent): void => {
  if (!isQuickAddPanelOpen.value) {
    return;
  }

  const root = quickAddFabRoot.value;
  const target = event.target;

  if (!root || !(target instanceof Node)) {
    return;
  }

  if (!root.contains(target)) {
    closeQuickAddPanel();
  }
};

onMounted(() => window.addEventListener("mousedown", onGlobalPointerDown));
onBeforeUnmount(() => {
  resetQuickAddState();
  window.removeEventListener("mousedown", onGlobalPointerDown);
});
</script>

<template>
  <div
    v-if="enabled || watchTonightEnabled"
    ref="quickAddFabRoot"
    class="quick-add-fab"
  >
    <Transition name="quick-add-fab-panel">
      <div
        v-if="enabled && isQuickAddPanelOpen"
        class="quick-add-fab__panel"
        @click.stop
      >
        <div class="quick-add-fab__panel-head">
          <h3 class="quick-add-fab__panel-title">Быстрый ввод</h3>
          <span class="quick-add-fab__panel-hint">
            Добавление тайтла из каталога
          </span>
        </div>
        <a-auto-complete
          v-model:value="quickAddQuery"
          :options="quickAddOptions"
          :filter-option="false"
          :get-popup-container="(trigger: HTMLElement) => trigger.parentElement ?? trigger"
          placement="topLeft"
          :not-found-content="
            quickAddQuery.trim().length >= QUICK_ADD_MIN_QUERY_LENGTH &&
            !isQuickAddLoading
              ? 'Ничего не найдено'
              : undefined
          "
          @search="handleQuickAddSearch"
          @select="handleQuickAddSelect"
        >
          <a-input
            size="large"
            :maxlength="120"
            placeholder="Например: Рекрут, Интерстеллар, Dark..."
          >
            <template #prefix>
              <BaseIcon name="ph:magnifying-glass" :width="16" :height="16" />
            </template>
          </a-input>
        </a-auto-complete>
      </div>
    </Transition>

    <div
      class="quick-add-fab__actions"
      role="group"
      aria-label="Быстрые действия с коллекцией"
    >
      <button
        v-if="watchTonightEnabled"
        type="button"
        class="quick-add-fab__watch-tonight"
        aria-label="Что посмотреть сегодня?"
        @click.stop="
          closeQuickAddPanel();
          emit('watchTonight');
        "
      >
        <BaseIcon name="ph:shuffle" :width="20" :height="20" />
        <span class="quick-add-fab__watch-label">Что посмотреть?</span>
        <span class="quick-add-fab__watch-label-mobile">Подбор</span>
      </button>
      <button
        v-if="enabled"
        data-tour="tour-quick-add"
        type="button"
        class="quick-add-fab__button"
        :class="{ 'quick-add-fab__button_active': isQuickAddPanelOpen }"
        aria-label="Быстрый ввод"
        :aria-expanded="isQuickAddPanelOpen"
        @click.stop="toggleQuickAddPanel"
      >
        <BaseIcon
          :name="isQuickAddPanelOpen ? 'ph:x' : 'ph:plus'"
          :width="22"
          :height="22"
        />
        <span class="quick-add-fab__button-text">Быстрый ввод</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.quick-add-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1000;
  display: grid;
  gap: 0.7rem;
  justify-items: end;

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--fv-space-12);
  }

  &__watch-tonight {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--fv-space-8);
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    box-shadow: var(--fv-shadow-elevated);
    font: inherit;
    font-size: var(--fv-text-p4-size);
    font-weight: var(--fv-weight-medium);
    cursor: pointer;

    &:hover {
      background: var(--fv-color-bg-secondary);
    }
  }

  &__watch-label-mobile {
    display: none;
  }

  &__watch-tonight:focus-visible,
  &__button:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
  }

  &__panel {
    width: min(420px, calc(100vw - 2rem));
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem;
    border-radius: 16px;
    border: 1px solid var(--fv-color-border);
    background: color-mix(in srgb, var(--fv-color-bg-primary) 92%, transparent);
    box-shadow: var(--fv-shadow-elevated);
    backdrop-filter: blur(8px);

    :deep(.ant-select) {
      width: 100%;
    }
  }

  &__panel-head {
    display: grid;
    gap: 0.1rem;
  }

  &__panel-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__panel-hint {
    font-size: 0.78rem;
    color: var(--fv-color-text-secondary);
  }

  &__button {
    border: 1px solid color-mix(in srgb, var(--fv-color-brand) 35%, transparent);
    background: linear-gradient(
      135deg,
      var(--fv-color-brand),
      color-mix(in srgb, var(--fv-color-brand), #000 12%)
    );
    color: #fff;
    border-radius: 999px;
    padding: 0.58rem 0.92rem;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    cursor: pointer;
    box-shadow: var(--fv-shadow-brand-md);
    transition: transform var(--fv-motion-slow) var(--fv-ease),
      box-shadow var(--fv-motion-slow) var(--fv-ease);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px
        color-mix(in srgb, var(--fv-color-brand) 40%, transparent);
    }

    &_active {
      background: color-mix(in srgb, var(--fv-color-brand) 92%, #1f3b87);
    }
  }

  &__button-text {
    font-size: 0.86rem;
    font-weight: 500;
  }

  @include mediaMax(768px) {
    right: 0.85rem;
    // поднимаем над мобильным таб-баром (82px + safe-area)
    bottom: calc(82px + env(safe-area-inset-bottom, 0px) + 0.85rem);

    &__button {
      padding: 0.55rem 0.8rem;
    }

    &__button-text,
    &__watch-label {
      display: none;
    }

    &__watch-label-mobile {
      display: inline;
    }
  }
}

.quick-add-fab-panel-enter-active,
.quick-add-fab-panel-leave-active {
  transition: all var(--fv-motion-slow) var(--fv-ease);
}

.quick-add-fab-panel-enter-from,
.quick-add-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
