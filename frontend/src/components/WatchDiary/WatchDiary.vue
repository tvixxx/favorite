<script setup lang="ts">
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Button as AButton,
  DatePicker as ADatePicker,
  Input as AInput,
  Pagination as APagination,
  message,
} from "ant-design-vue";
import dateLocale from "ant-design-vue/es/date-picker/locale/ru_RU";
import "dayjs/locale/ru";
import { useMainStore } from "@/state/state";
import { useDateTime } from "@/composable/useDateTime";
import { createRequestGuard } from "@/utils/requestGuard";
import { getApiResponseMessage } from "@/services/api";
import {
  createDiary,
  diaryMovies,
  listDiary,
  removeDiary,
  updateDiary,
} from "@/services/watch-diary-api";
import {
  diaryMonthRange,
  type DiaryEntry,
  type DiaryMovie,
  type DiaryStats,
  type DiaryValues,
} from "@/services/watch-diary";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import ConfirmDialog from "@/components/ConfirmDialog/ConfirmDialog.vue";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";
import DiaryForm from "./DiaryForm.vue";
import DiaryList from "./DiaryList.vue";

const props = defineProps<{
  compact?: boolean;
  movie?: DiaryMovie;
  movieIdFilter?: string;
}>();
const emit = defineEmits<{
  stats: [value: DiaryStats | null];
  collectionUpdated: [];
  clearFilter: [];
}>();
const main = useMainStore(),
  router = useRouter();
const { dateKey, timezone } = useDateTime();
const userId = computed(() => main.userData?.id ?? "");
const today = ref(dateKey(new Date()) ?? new Date().toISOString().slice(0, 10));
const period = ref<string | undefined>(
  props.compact || props.movieIdFilter ? undefined : today.value.slice(0, 7)
);
const search = ref(""),
  debouncedSearch = ref(""),
  rewatches = ref(false),
  page = ref(1);
const items = ref<DiaryEntry[]>([]),
  total = ref(0),
  loading = ref(false),
  loadError = ref("");
const formOpen = ref(false),
  formEpoch = ref(0),
  editing = ref<DiaryEntry | null>(null),
  duplicate = ref<DiaryEntry | null>(null);
const movies = ref<DiaryMovie[]>([]),
  moviesLoading = ref(false),
  saving = ref(false),
  formError = ref("");
const removal = ref<DiaryEntry | null>(null),
  deleteOpen = ref(false);
const readGuard = createRequestGuard(),
  movieGuard = createRequestGuard(),
  mutationGuard = createRequestGuard();
let readController: AbortController | undefined,
  movieController: AbortController | undefined,
  mutationController: AbortController | undefined;
let searchTimer: ReturnType<typeof setTimeout> | undefined,
  movieTimer: ReturnType<typeof setTimeout> | undefined;
const effectiveMovieId = computed(() => props.movie?.id ?? props.movieIdFilter);

async function load(): Promise<void> {
  const current = readGuard.begin();

  readController?.abort();
  if (!userId.value) {
    items.value = [];
    total.value = 0;
    loading.value = false;
    emit("stats", null);

    return;
  }

  readController = new AbortController();
  loading.value = true;
  loadError.value = "";
  try {
    const result = await listDiary(
      userId.value,
      {
        limit: props.compact ? 5 : 20,
        offset: props.compact ? 0 : (page.value - 1) * 20,
        movieId: effectiveMovieId.value,
        q: debouncedSearch.value || undefined,
        isRewatch: rewatches.value || undefined,
        ...(props.compact ? {} : diaryMonthRange(period.value ?? "")),
      },
      readController.signal
    );

    if (!current()) return;
    items.value = result.items;
    total.value = result.total;
    today.value = result.today;
    emit("stats", result.stats);
  } catch (error) {
    if (current()) {
      loadError.value =
        getApiResponseMessage(error) || "Не удалось загрузить дневник";

      emit("stats", null);
    }
  } finally {
    if (current()) loading.value = false;
  }
}

async function loadMovies(query = ""): Promise<void> {
  const current = movieGuard.begin();

  movieController?.abort();
  if (!formOpen.value || props.movie || editing.value || !userId.value) return;
  movieController = new AbortController();
  moviesLoading.value = true;
  try {
    const result = await diaryMovies(
      userId.value,
      query,
      movieController.signal
    );

    if (current()) movies.value = result;
  } catch (error) {
    if (current())
      formError.value =
        getApiResponseMessage(error) || "Не удалось загрузить коллекцию";
  } finally {
    if (current()) moviesLoading.value = false;
  }
}

function searchMovies(query: string): void {
  clearTimeout(movieTimer);
  movieGuard.invalidate();
  movieController?.abort();
  movieTimer = setTimeout(() => {
    void loadMovies(query);
  }, 250);
}

function openForm(entry: DiaryEntry | null = null): void {
  editing.value = entry;
  duplicate.value = null;
  formError.value = "";
  formEpoch.value++;
  formOpen.value = true;
  if (!entry && !props.movie) void loadMovies();
}

async function save(submission: {
  values: DiaryValues;
  movieId: string;
  requestId: string;
  allowDuplicate: boolean;
}): Promise<void> {
  if (saving.value || !userId.value) return;

  const owner = userId.value,
    entry = editing.value,
    current = mutationGuard.begin();

  mutationController?.abort();
  mutationController = new AbortController();
  saving.value = true;
  formError.value = "";
  try {
    const { viewedOn, scope, season, isRewatch, rating, note } =
      submission.values;
    const values = { viewedOn, scope, season, isRewatch, rating, note };
    const result = entry
      ? await updateDiary(
          owner,
          entry.id,
          {
            ...values,
            revision: entry.revision,
            allowDuplicate: submission.allowDuplicate,
          },
          mutationController.signal
        )
      : await createDiary(
          owner,
          {
            ...submission.values,
            movieId: submission.movieId,
            requestId: submission.requestId,
            allowDuplicate: submission.allowDuplicate,
          },
          mutationController.signal
        );

    if (!current()) return;
    if (result.status === "duplicate") {
      duplicate.value = result.entry;

      return;
    }

    formOpen.value = false;
    if (!props.compact) {
      period.value = result.entry.viewedOn.slice(0, 7);
      page.value = 1;
      rewatches.value = false;
      search.value = "";
      debouncedSearch.value = "";
    }

    if (result.collectionUpdated) emit("collectionUpdated");
    await load();
    if (current())
      message.success(
        entry ? "Запись обновлена" : "Просмотр добавлен в дневник"
      );
  } catch (error) {
    if (current())
      formError.value =
        getApiResponseMessage(error) || "Не удалось сохранить просмотр";
  } finally {
    if (current()) saving.value = false;
  }
}

function askRemove(entry: DiaryEntry): void {
  removal.value = entry;
  deleteOpen.value = true;
}

async function confirmRemove(): Promise<void> {
  if (saving.value || !removal.value || !userId.value) return;

  const entry = removal.value,
    current = mutationGuard.begin();

  mutationController = new AbortController();
  saving.value = true;
  try {
    await removeDiary(
      userId.value,
      entry.id,
      entry.revision,
      mutationController.signal
    );

    if (!current()) return;
    deleteOpen.value = false;
    if (page.value > 1 && items.value.length === 1) page.value--;
    else await load();
    if (current()) message.success("Запись удалена. Коллекция сохранена.");
  } catch (error) {
    if (current())
      message.error(
        getApiResponseMessage(error) || "Не удалось удалить запись"
      );
  } finally {
    if (current()) saving.value = false;
  }
}

function resetSession(): void {
  readGuard.invalidate();
  movieGuard.invalidate();
  mutationGuard.invalidate();
  readController?.abort();
  movieController?.abort();
  mutationController?.abort();
  clearTimeout(searchTimer);
  clearTimeout(movieTimer);
  items.value = [];
  total.value = 0;
  movies.value = [];
  formOpen.value = false;
  deleteOpen.value = false;
  editing.value = null;
  duplicate.value = null;
  saving.value = false;
  moviesLoading.value = false;
  loadError.value = "";
  formError.value = "";
  emit("stats", null);
}

watch(
  [userId, () => main.sessionRevision, effectiveMovieId],
  () => {
    resetSession();
    page.value = 1;
    void load();
  },
  { immediate: true, flush: "sync" }
);

watch([period, rewatches, debouncedSearch], () => {
  if (page.value !== 1) page.value = 1;
  else void load();
});

watch([page, timezone], () => {
  void load();
});

watch(search, (value) => {
  clearTimeout(searchTimer);
  readGuard.invalidate();
  readController?.abort();
  searchTimer = setTimeout(() => {
    if (debouncedSearch.value === value.trim()) void load();
    else debouncedSearch.value = value.trim();
  }, 250);
});

watch(formOpen, (value) => {
  if (!value) {
    movieGuard.invalidate();
    movieController?.abort();
    clearTimeout(movieTimer);
    moviesLoading.value = false;
  }
});

onBeforeUnmount(resetSession);
</script>

<template>
  <section
    class="watch-diary"
    :class="{ 'watch-diary_compact': compact }"
    :aria-busy="loading || saving"
    aria-label="Дневник просмотров"
  >
    <div class="watch-diary__toolbar">
      <div v-if="compact" class="watch-diary__heading">
        <SectionHeading title="Дневник просмотров" icon="ph:book-open-text" />
        <p>Записей: {{ total }} · история впечатлений</p>
      </div>
      <div v-else class="watch-diary__filters">
        <ADatePicker
          v-model:value="period"
          class="diary-date-picker"
          popup-class-name="diary-calendar-popup"
          picker="month"
          value-format="YYYY-MM"
          format="MM.YYYY"
          size="large"
          :allow-clear="false"
          :locale="dateLocale"
          :input-read-only="true"
          placeholder="Все месяцы"
          aria-label="Месяц дневника"
        >
          <template #suffixIcon>
            <BaseIcon name="ph:calendar-blank" :width="18" :height="18" />
            <button
              v-if="period"
              type="button"
              class="diary-field-clear"
              aria-label="Сбросить месяц"
              @mousedown.prevent.stop
              @keydown.stop
              @click.prevent.stop="period = undefined"
            >
              <BaseIcon name="ph:x" :width="16" :height="16" />
            </button>
          </template>
        </ADatePicker>
        <AButton
          :class="{ 'watch-diary__active': rewatches }"
          :aria-pressed="rewatches"
          @click="rewatches = !rewatches"
          ><BaseIcon
            name="ph:arrows-clockwise"
            :width="18"
            :height="18"
          />Пересмотры</AButton
        >
        <AInput
          v-model:value="search"
          aria-label="Поиск по дневнику"
          placeholder="Название произведения"
          :maxlength="200"
          ><template #prefix
            ><BaseIcon name="ph:magnifying-glass" :width="18" :height="18"
          /></template>
          <template #suffix>
            <button
              v-if="search"
              type="button"
              class="diary-field-clear"
              aria-label="Очистить поиск"
              @click="search = ''"
            >
              <BaseIcon name="ph:x" :width="16" :height="16" />
            </button>
          </template>
        </AInput>
      </div>
      <AButton
        data-diary-add
        :type="compact ? 'default' : 'primary'"
        :disabled="saving"
        @click="openForm()"
        ><BaseIcon
          :name="compact && total ? 'ph:arrows-clockwise' : 'ph:plus'"
          :width="18"
          :height="18"
        />{{
          compact && total ? "Записать пересмотр" : "Записать просмотр"
        }}</AButton
      >
    </div>
    <div v-if="movieIdFilter && !compact" class="watch-diary__filter-note">
      Показана история одного произведения<AButton
        type="link"
        @click="emit('clearFilter')"
        >Сбросить</AButton
      >
    </div>
    <div v-if="loadError" class="watch-diary__error" role="alert">
      <p>{{ loadError }}</p>
      <AButton data-diary-retry @click="load">Повторить</AButton>
    </div>
    <div v-else-if="loading && !items.length" class="watch-diary__loading">
      <AppSpinner :size="28" /><span>Загружаем дневник</span>
    </div>
    <DiaryList
      v-else-if="items.length"
      :items="items"
      :compact="compact"
      :busy="saving"
      @edit="openForm"
      @remove="askRemove"
      @open-movie="router.push({ name: 'detail', params: { id: $event } })"
    />
    <div v-else class="watch-diary__empty">
      <BaseIcon name="ph:book-open-text" :width="30" :height="30" />
      <h3>Пока нет записей</h3>
      <p>
        {{
          compact
            ? "Запишите просмотр — он появится здесь."
            : "Добавьте первый просмотр или измените фильтры."
        }}
      </p>
    </div>
    <APagination
      v-if="!compact && total > 20"
      :current="page"
      :page-size="20"
      :total="total"
      :show-size-changer="false"
      size="small"
      @change="page = $event"
    />
    <AButton
      v-if="compact && total"
      type="link"
      class="watch-diary__all"
      @click="
        router.push({ name: 'library-diary', query: { movieId: movie?.id } })
      "
    >
      <span class="watch-diary__all-content">
        Весь дневник<BaseIcon name="ph:arrow-right" :width="16" :height="16" />
      </span>
    </AButton>
    <p v-if="!compact" class="watch-diary__privacy">
      <BaseIcon name="ph:lock-simple" :width="16" :height="16" />Дневник виден
      только вам. Заметки не публикуются в отзывах.
    </p>
    <DiaryForm
      v-if="formOpen"
      :key="formEpoch"
      v-model="formOpen"
      :movie="movie"
      :entry="editing"
      :movies="movies"
      :today="today"
      :busy="saving"
      :loading-movies="moviesLoading"
      :duplicate="duplicate"
      :error="formError"
      :rewatch-suggestion="compact && total > 0"
      @search="searchMovies"
      @confirm="save"
      @open-duplicate="openForm"
    />
    <ConfirmDialog
      v-model="deleteOpen"
      title="Удалить запись дневника?"
      :subject="removal ? `${removal.movie.title} · ${removal.viewedOn}` : ''"
      description="Произведение, текущая оценка и прогресс останутся в коллекции."
      confirm-text="Удалить запись"
      :loading="saving"
      @confirm="confirmRemove"
    />
  </section>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.watch-diary {
  min-width: 0;
  padding: 24px 28px;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-card);

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  &__toolbar :deep(.ant-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    height: auto;
    white-space: normal;
  }

  &__filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  &__filters :deep(.ant-picker) {
    width: 150px;
    min-height: 44px;
  }

  &__filters :deep(.ant-input-affix-wrapper) {
    width: 220px;
    min-height: 44px;
  }

  &__toolbar > :deep(.ant-btn) {
    flex: none;
  }

  &__toolbar :deep(.watch-diary__active) {
    color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
    border-color: var(--fv-color-accent);
  }

  &__heading p {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }

  &__loading,
  &__empty {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 32px 12px;
    color: var(--fv-color-text-secondary);
    text-align: center;
  }

  &__empty h3 {
    margin: 0;
    font-size: 18px;
    color: var(--fv-color-text-primary);
  }

  &__empty p {
    margin: 0;
    font-size: 14px;
  }

  &__error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 16px 0;
    color: var(--fv-color-negative);

    p {
      margin: 0;
    }
  }

  &__privacy {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding-top: 18px;
    margin: 18px 0 0;
    border-top: 1px solid var(--fv-color-border);
    color: var(--fv-color-text-secondary);
    font-size: 13px;
  }

  &__privacy :deep(svg) {
    flex: none;
  }

  &__all {
    display: inline-flex;
    align-items: center;
    padding-left: 0;
  }

  &__all-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    line-height: 1;

    :deep(svg) {
      display: block;
      flex: none;
    }
  }

  &__filter-note {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }

  :deep(.ant-pagination) {
    margin-top: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  @include mediaMax(767px) {
    padding: 22px 18px;

    &__toolbar {
      align-items: flex-start;
    }

    &__filters {
      width: 100%;
    }

    &__filters :deep(.ant-input-affix-wrapper) {
      width: 100%;
    }

    &__toolbar > :deep(.ant-btn) {
      width: 100%;
    }

    &:not(.watch-diary_compact) &__toolbar > :deep(.ant-btn) {
      order: -1;
    }

    &__privacy {
      font-size: 12px;
    }
  }
}
</style>
