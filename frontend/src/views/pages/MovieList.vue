<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { type UserMovie, useUserMoviesStore, WatchStatus } from "@/stores";
import type { MovieApiResponse } from "@/stores/movies/types";
import { useMainStore } from "@/state/state";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import { formatDate, formatYear } from "@/utils";
import { ERROR_FETCH_MOVIES_TEXT } from "@/state/constants";
import type { UserMoviesFilters } from "@/stores";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import MoviesFiltersPanel from "@/components/MoviesFiltersPanel/MoviesFiltersPanel.vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";

const router = useRouter();
const route = useRoute();
const userMoviesStore = useUserMoviesStore();
const mainStore = useMainStore();

interface QuickAddOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const QUICK_ADD_MIN_QUERY_LENGTH = 2;
const QUICK_ADD_DEBOUNCE_MS = 280;
const QUICK_ADD_OPTIONS_LIMIT = 10;

const imageErrors = ref<Set<string>>(new Set());
const quickAddQuery = ref("");
const quickAddOptions = ref<QuickAddOption[]>([]);
const isQuickAddLoading = ref(false);
const isQuickAddPanelOpen = ref(false);
const quickAddFabRoot = ref<HTMLElement | null>(null);
let quickAddDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const userId = computed(() => mainStore.userData?.id || "");
const hasMovies = computed(() => userMoviesStore.currentList.length !== 0);
const totalMovies = computed(() => userMoviesStore.currentList.length);
const userMovieIds = computed(() => {
  return new Set(userMoviesStore.userMovies.map((item) => item.movieId));
});
const shouldFetchMovies = computed(
  () => !hasMovies.value && mainStore.isLoggedIn && userId.value
);
const showPaginator = computed(
  () =>
    !!totalMovies.value &&
    totalMovies.value > 0 &&
    !userMoviesStore.isError &&
    !userMoviesStore.isLoading
);

const emptyMoviesDescription = computed(() => {
  if (
    userMoviesStore.hasActiveFilters &&
    userMoviesStore.currentList.length === 0
  ) {
    return "Фильмы не найдены";
  }

  return "Фильмов пока нет...";
});

const clearCollectionFilters = async () => {
  userMoviesStore.clearSearch();
  userMoviesStore.setFilters({});
  userMoviesStore.setCurrentPage(1);

  if (!userId.value) {
    return;
  }

  await userMoviesStore.fetchUserMovies(userId.value);
};

const goToCatalog = () => {
  router.push("/library/catalog");
};

const goToCreate = () => {
  router.push("/create");
};

const getPosterSrc = (item: UserMovie) => {
  return imageErrors.value.has(item.movieId)
    ? FALLBACK_IMAGE_URL
    : item.movie.imageUrl || FALLBACK_IMAGE_URL;
};

const handleImageError = (movieId: string) => {
  imageErrors.value.add(movieId);
};

const removeMovie = async (item: UserMovie) => {
  try {
    await userMoviesStore.removeUserMovie(userId.value, item.movieId);
    message.success(`${item.movie.title} удален`);
  } catch {
    message.error(`Не удалось удалить: ${item.movie.title}`);
  }
};

const addToFavorite = async (item: UserMovie) => {
  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      isFavorite: true,
    });
    message.success(`${item.movie.title} добавлен в избранное`);
  } catch {
    message.error(`Не удалось добавить в избранное: ${item.movie.title}`);
  }
};

const removeFromFavorite = async (item: UserMovie) => {
  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      isFavorite: false,
    });
    message.success(`${item.movie.title} удален из избранного`);
  } catch {
    message.error(`Не удалось удалить из избранного: ${item.movie.title}`);
  }
};

const toggleSeeLater = async (item: UserMovie) => {
  const newValue = !item.seeLater;

  try {
    await userMoviesStore.updateUserMovie(userId.value, item.movieId, {
      seeLater: newValue,
    });

    if (userMoviesStore.filters.seeLater && !newValue) {
      userMoviesStore.removeFromSearchResults(item.movieId);
    }

    message.success(
      newValue
        ? `${item.movie.title} добавлен в «Смотреть позже»`
        : `${item.movie.title} убран из «Смотреть позже»`
    );
  } catch {
    message.error("Не удалось обновить статус");
  }
};

const getQueryValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return null;
};

const normalizeWatchStatus = (value: string | null): WatchStatus | undefined => {
  if (!value) {
    return undefined;
  }

  const allowed = Object.values(WatchStatus);

  if (allowed.includes(value as WatchStatus)) {
    return value as WatchStatus;
  }

  return undefined;
};

const applyRoutePresetFilters = async () => {
  const watchStatus = normalizeWatchStatus(getQueryValue(route.query.watchStatus));
  const isSerialRaw = getQueryValue(route.query.isSerial);
  const seeLaterRaw = getQueryValue(route.query.seeLater);
  const hasPreset =
    watchStatus !== undefined || isSerialRaw !== null || seeLaterRaw !== null;

  if (!hasPreset || !userId.value) {
    return;
  }

  const isSerial =
    isSerialRaw === null
      ? undefined
      : isSerialRaw === "true"
        ? true
        : isSerialRaw === "false"
          ? false
          : undefined;
  const seeLater =
    seeLaterRaw === null
      ? undefined
      : seeLaterRaw === "true"
        ? true
        : seeLaterRaw === "false"
          ? false
          : undefined;

  userMoviesStore.setFilters({
    ...userMoviesStore.filters,
    watchStatus,
    isSerial,
    seeLater,
  });

  try {
    await userMoviesStore.fetchUserMovies(userId.value);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

const goToMovie = (item: UserMovie) => {
  router.push(`/detail/${item.movieId}`);
};

const resetQuickAddState = () => {
  quickAddQuery.value = "";
  quickAddOptions.value = [];
  isQuickAddLoading.value = false;

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }
};

const openQuickAddPanel = () => {
  isQuickAddPanelOpen.value = true;
};

const closeQuickAddPanel = () => {
  isQuickAddPanelOpen.value = false;
};

const toggleQuickAddPanel = () => {
  if (isQuickAddPanelOpen.value) {
    closeQuickAddPanel();
  } else {
    openQuickAddPanel();
  }
};

const buildQuickAddOptionLabel = (movie: MovieApiResponse, isExisting: boolean) => {
  const mediaType = movie.isSerial ? "сериал" : "фильм";
  const year = movie.publishDate ? formatYear(movie.publishDate) : "год не указан";
  const suffix = isExisting ? " • уже в коллекции" : "";

  return `${movie.title} • ${mediaType} • ${year}${suffix}`;
};

const fetchQuickAddOptions = async (query: string) => {
  const q = query.trim();

  if (!q || q.length < QUICK_ADD_MIN_QUERY_LENGTH) {
    quickAddOptions.value = [];
    isQuickAddLoading.value = false;

    return;
  }

  isQuickAddLoading.value = true;

  try {
    const endpoint = `/movies/search?q=${encodeURIComponent(q)}`;
    const { data, status } = await useFetch<MovieApiResponse[]>(endpoint, {
      method: FETCH_METHOD.get,
    });

    if (status !== 200) {
      throw new Error("Не удалось загрузить подсказки");
    }

    const prepared = data.slice(0, QUICK_ADD_OPTIONS_LIMIT).map((movie) => {
      const isExisting = userMovieIds.value.has(movie.id);

      return {
        value: movie.id,
        label: buildQuickAddOptionLabel(movie, isExisting),
        disabled: isExisting,
      };
    });

    quickAddOptions.value = prepared;
  } catch {
    quickAddOptions.value = [];
  } finally {
    isQuickAddLoading.value = false;
  }
};

const handleQuickAddSearch = (value: string) => {
  quickAddQuery.value = value;

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
};

const handleQuickAddSelect = async (movieId: string) => {
  if (!userId.value) {
    return;
  }

  try {
    await userMoviesStore.addUserMovie(userId.value, movieId, {});
    message.success("Тайтл добавлен в коллекцию");
    resetQuickAddState();
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

const onGlobalPointerDown = (event: MouseEvent) => {
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

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isQuickAddPanelOpen.value) {
    closeQuickAddPanel();
  }
};

const handleFiltersUpdate = async (filters: UserMoviesFilters) => {
  userMoviesStore.setFilters(filters);

  if (!userId.value) {
    return;
  }

  try {
    if (userMoviesStore.searchQuery.trim()) {
      await userMoviesStore.searchUserMovies(
        userId.value,
        userMoviesStore.searchQuery
      );
    } else {
      userMoviesStore.clearSearch();
      await userMoviesStore.fetchUserMovies(userId.value);
    }
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

const findMovie = async (value: string) => {
  if (!userId.value) {
    return;
  }

  try {
    await userMoviesStore.searchUserMovies(userId.value, value);
  } catch {
    message.error(ERROR_FETCH_MOVIES_TEXT);
  }
};

onMounted(async () => {
  window.addEventListener("mousedown", onGlobalPointerDown);
  window.addEventListener("keydown", onGlobalKeydown);

  if (shouldFetchMovies.value) {
    try {
      await userMoviesStore.fetchUserMovies(userId.value);
    } catch {
      message.error(ERROR_FETCH_MOVIES_TEXT);
    }
  }

  await applyRoutePresetFilters();
});

onBeforeUnmount(() => {
  window.removeEventListener("mousedown", onGlobalPointerDown);
  window.removeEventListener("keydown", onGlobalKeydown);

  if (quickAddDebounceTimer) {
    clearTimeout(quickAddDebounceTimer);
    quickAddDebounceTimer = null;
  }
});

const repeatFetchMovies = () => {
  if (userId.value) {
    return userMoviesStore.fetchUserMovies(userId.value);
  }
};

watch(
  () => userMoviesStore.searchQuery,
  () => {
    userMoviesStore.setCurrentPage(1);
  }
);

watch(
  () => route.query,
  () => {
    void applyRoutePresetFilters();
  }
);
</script>

<template>
  <div class="movie-list">
    <div class="movie-list__content">
      <MoviesFiltersPanel
        :search-handler="findMovie"
        @update:filters="handleFiltersUpdate"
      />
      <ListError
        v-if="userMoviesStore.isError"
        :is-error="userMoviesStore.isError"
        :repeat-fn="repeatFetchMovies"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="userMoviesStore.isLoading"
        :center="true"
        loading-text="Загружаем фильмы..."
        size="large"
      />

      <div v-else-if="!totalMovies" class="movie-list__empty-state">
        <a-empty :description="emptyMoviesDescription" />

        <div class="movie-list__empty-actions">
          <template v-if="userMoviesStore.hasActiveFilters">
            <a-button type="primary" @click="clearCollectionFilters">
              Сбросить фильтры и поиск
            </a-button>
          </template>

          <template v-else>
            <a-button type="primary" @click="goToCatalog">
              Открыть каталог
            </a-button>

            <a-button @click="goToCreate">Добавить фильм вручную</a-button>
          </template>
        </div>

        <p v-if="!userMoviesStore.hasActiveFilters" class="movie-list__empty-hint">
          Подсказка: справа снизу есть быстрое добавление тайтла из каталога.
        </p>
      </div>

      <div v-else class="movie-list__grid">
        <div
          v-for="item in userMoviesStore.paginatedUserMovies"
          :key="item.id"
          class="movie-card"
          @click="goToMovie(item)"
        >
          <div class="movie-card__header">
            <img
              :alt="`${item.movie.title} постер`"
              :src="getPosterSrc(item)"
              class="movie-card__poster"
              loading="lazy"
              @error="handleImageError(item.movieId)"
            />
            <div class="movie-card__favorite">
              <BaseIcon
                :height="22"
                :name="item.isFavorite ? 'mdi:heart' : 'mdi:heart-outline'"
                :width="22"
                @click.stop="
                  () =>
                    item.isFavorite
                      ? removeFromFavorite(item)
                      : addToFavorite(item)
                "
              />
            </div>
          </div>

          <div class="movie-card__content">
            <div class="movie-card__rating">{{ item.personalRate || 0 }}/10</div>

            <button
              class="movie-card__delete"
              @click.stop="() => removeMovie(item)"
            >
              <BaseIcon :height="18" :width="18" name="pajamas:remove" />
            </button>

            <h3 class="movie-card__title">
              {{ item.movie.title }} <span v-if="item.movie.isSerial">(сериал)</span>
            </h3>

            <div class="movie-card__meta">
              <div class="movie-card__meta-item">
                <BaseIcon class="movie-card__meta-icon" name="mdi:eye" />
                <span class="movie-card__meta-item-text">
                  Дата добавления: {{ formatDate(item.addedAt) }}
                </span>
              </div>
              <div class="movie-card__meta-item">
                <BaseIcon class="movie-card__meta-icon" name="mdi:filmstrip" />
                <span class="movie-card__meta-item-text"
                  >Дата выхода: {{ formatYear(item.movie.publishDate) }}</span
                >
              </div>
              <div
                v-if="item.movie.countryCodes?.length"
                class="movie-card__meta-item"
              >
                <BaseIcon class="movie-card__meta-icon" name="mdi:earth" />
                <span class="movie-card__meta-item-text">{{
                  countriesLabelsRu(item.movie.countryCodes)
                }}</span>
              </div>
            </div>

            <div class="movie-card__see-later" @click.stop>
              <a-switch
                :checked="item.seeLater"
                size="small"
                @change="() => toggleSeeLater(item)"
              />
              <span class="movie-card__see-later-label">Смотреть позже</span>
            </div>

            <div class="movie-card__share" @click.stop>
              <MovieShareButton
                :movie-id="item.movieId"
                :movie-title="item.movie.title"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showPaginator && totalMovies > userMoviesStore.pageSize"
        class="movie-list__pagination"
      >
        <a-pagination
          v-model:current="userMoviesStore.currentPage"
          :page-size="userMoviesStore.pageSize"
          :page-size-options="['6', '12', '18', '24']"
          :total="totalMovies"
          show-size-changer
          @change="userMoviesStore.setCurrentPage"
          @showSizeChange="(_, size: number) => userMoviesStore.setPageSize(size)"
        />
      </div>
    </div>

    <div ref="quickAddFabRoot" class="quick-add-fab" data-tour="tour-quick-add">
      <Transition name="quick-add-fab-panel">
        <div
          v-if="isQuickAddPanelOpen"
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
                <BaseIcon name="mdi:magnify" :width="16" :height="16" />
              </template>
            </a-input>
          </a-auto-complete>
        </div>
      </Transition>

      <button
        type="button"
        class="quick-add-fab__button"
        :class="{ 'quick-add-fab__button_active': isQuickAddPanelOpen }"
        @click.stop="toggleQuickAddPanel"
      >
        <BaseIcon
          :name="isQuickAddPanelOpen ? 'mdi:close' : 'mdi:plus'"
          :width="22"
          :height="22"
        />
        <span class="quick-add-fab__button-text">Быстрый ввод</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/card" as *;
@use "@/styles/antd-overrides" as *;

.movie-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;

  &__content {
    @include pageContentContainer;
  }

  &__grid {
    @include cardsGrid;
  }

  &__pagination {
    display: flex;
    justify-content: center;
    margin-top: 4rem;
    padding: 2rem 0;
  }

  &__empty-state {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
    width: 100%;

    @include antEmptyTypography;
  }

  &__empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 1.25rem;
  }

  &__empty-hint {
    margin: 1rem 0 0;
    max-width: 26rem;
    font-size: 0.88rem;
    line-height: 1.45;
    opacity: 0.9;
  }
}

.quick-add-fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1000;
  display: grid;
  gap: 0.7rem;
  justify-items: end;

  &__panel {
    width: min(420px, calc(100vw - 2rem));
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
    box-shadow: var(--shadow-elevated);
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
    font-weight: 700;
    color: var(--text-primary);
  }

  &__panel-hint {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  &__button {
    border: 1px solid color-mix(in srgb, var(--ant-color-primary) 35%, transparent);
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      color-mix(in srgb, var(--ant-color-primary) 85%, #6a8dff)
    );
    color: #fff;
    border-radius: 999px;
    padding: 0.58rem 0.92rem;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    cursor: pointer;
    box-shadow: var(--shadow-primary-md);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px color-mix(in srgb, var(--ant-color-primary) 40%, transparent);
    }

    &_active {
      background: color-mix(in srgb, var(--ant-color-primary) 92%, #1f3b87);
    }
  }

  &__button-text {
    font-size: 0.86rem;
    font-weight: 700;
  }

  @include mediaMax(767px) {
    right: 0.85rem;
    bottom: 0.95rem;

    &__button {
      padding: 0.55rem 0.8rem;
    }

    &__button-text {
      display: none;
    }
  }
}

.quick-add-fab-panel-enter-active,
.quick-add-fab-panel-leave-active {
  transition: all 0.2s ease;
}

.quick-add-fab-panel-enter-from,
.quick-add-fab-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.movie-card {
  @include clickableCard(var(--radius-md));

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      var(--ant-color-primary),
      color-mix(in srgb, var(--ant-color-primary) 50%, var(--bg-secondary))
    );
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1;
  }

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.2);
    border-color: color-mix(in srgb, var(--ant-color-primary) 40%, transparent);

    &::before {
      opacity: 1;
    }

    .movie-card__poster {
      transform: scale(1.05);
    }
  }

  &__header {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    transition: transform 0.4s ease;
  }

  &__favorite {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2;
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.1);
      background: white;
    }

    svg {
      width: 20px;
      height: 20px;
      color: var(--ant-color-primary);
    }
  }

  &__content {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  &__rating {
    align-self: flex-end;
    background: var(--ant-color-primary);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 16px;
    font-size: 0.8rem;
    font-weight: 700;
    box-shadow: 0 2px 8px
      color-mix(in srgb, var(--ant-color-primary) 30%, transparent);
  }

  &__delete {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
    border: 1px solid color-mix(in srgb, var(--text-secondary) 50%, transparent);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px);
    opacity: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 2;

    .movie-card:hover & {
      opacity: 1;
    }

    @media (max-width: 899px) {
      opacity: 0.9;
    }

    &:hover {
      background: #ef4444;
      border-color: #dc2626;
      color: white;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  &__title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--text-primary);
    flex-grow: 1;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  &__meta-icon {
    width: 14px;
    height: 14px;
    color: var(--ant-color-primary);
  }

  &__meta-item-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__see-later {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }

  &__see-later-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__share {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 40%, transparent);
  }
}
</style>
