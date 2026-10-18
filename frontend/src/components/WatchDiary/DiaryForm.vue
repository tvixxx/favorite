<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from "vue";
import {
  Button as AButton,
  Checkbox as ACheckbox,
  DatePicker as ADatePicker,
  Rate as ARate,
  Select as ASelect,
  Switch as ASwitch,
} from "ant-design-vue";
import type { Dayjs } from "dayjs";
import dateLocale from "ant-design-vue/es/date-picker/locale/ru_RU";
import "dayjs/locale/ru";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import NumberField from "@/components/NumberField/NumberField.vue";
import AppDisclosure from "@/components/AppDisclosure/AppDisclosure.vue";
import { contentTypeLabel } from "@/utils/content-kind";
import { formatYear } from "@/utils/date.utils";
import {
  prepareDiaryValues,
  type DiaryDraft,
  type DiaryEntry,
  type DiaryMovie,
  type DiaryValues,
} from "@/services/watch-diary";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  movie?: DiaryMovie;
  movies: DiaryMovie[];
  today: string;
  busy: boolean;
  entry?: DiaryEntry | null;
  duplicate?: DiaryEntry | null;
  error?: string;
  loadingMovies?: boolean;
  rewatchSuggestion?: boolean;
}>();
const emit = defineEmits<{
  confirm: [
    submission: {
      values: DiaryValues;
      movieId: string;
      requestId: string;
      allowDuplicate: boolean;
    }
  ];
  search: [query: string];
  openDuplicate: [entry: DiaryEntry];
}>();
const formId = useId();
const selectedId = ref<string>();
const selection = ref<DiaryMovie>();
const selectedMovie = computed(
  () => props.entry?.movie ?? props.movie ?? selection.value
);

watch(selectedId, (id) => {
  selection.value = props.movies.find((movie) => movie.id === id);
});

const draft = reactive<DiaryDraft>({
  viewedOn: props.entry?.viewedOn ?? props.today,
  scope: props.entry?.scope ?? "TITLE",
  season: props.entry?.season ?? undefined,
  isRewatch: props.entry?.isRewatch ?? !!props.rewatchSuggestion,
  rating: props.entry?.rating ?? null,
  note: props.entry?.note ?? "",
  syncStatus: false,
  syncRating: false,
});
const score = computed({
  get: () => draft.rating ?? 0,
  set: (value: number) => {
    draft.rating = value || null;
    if (!value) draft.syncRating = false;
  },
});
const validationError = ref("");
const requestId = ref(crypto.randomUUID());
let previousFingerprint = "";
const options = computed(() =>
  props.movies.map((movie) => ({
    value: movie.id,
    label: `${movie.title} · ${formatYear(
      movie.publishDate
    )} · ${contentTypeLabel(movie)}`,
  }))
);

watch(
  () => draft.scope,
  (value) => {
    if (value === "SEASON") {
      draft.season ??= 1;
      draft.syncStatus = false;
    }
  }
);

watch(
  () => selectedMovie.value?.id,
  () => {
    if (!props.entry) {
      draft.scope = "TITLE";
      draft.season = undefined;
      draft.isRewatch = !!props.rewatchSuggestion;
    }
  }
);

const disabledDate = (date: Dayjs): boolean =>
  date.format("YYYY-MM-DD") > props.today;

function relativeDate(days: number): void {
  const date = new Date(props.today + "T00:00:00Z");

  date.setUTCDate(date.getUTCDate() + days);
  draft.viewedOn = date.toISOString().slice(0, 10);
}

function submit(allowDuplicate = false): void {
  if (props.busy) return;
  validationError.value = "";
  try {
    if (!selectedMovie.value)
      throw new Error("Выберите произведение из своей коллекции");

    const values = prepareDiaryValues(draft, selectedMovie.value, props.today);
    const fingerprint = JSON.stringify({
      movieId: selectedMovie.value.id,
      ...values,
    });

    if (previousFingerprint && fingerprint !== previousFingerprint)
      requestId.value = crypto.randomUUID();
    previousFingerprint = fingerprint;
    emit("confirm", {
      values,
      movieId: selectedMovie.value.id,
      requestId: requestId.value,
      allowDuplicate,
    });
  } catch (reason) {
    validationError.value =
      reason instanceof Error ? reason.message : "Проверьте поля записи";
  }
}
</script>

<template>
  <BaseModal v-model="open" layout="form" class="diary-form-modal">
    <template #title>{{
      entry ? "Изменить запись" : "Записать просмотр"
    }}</template>
    <template #body>
      <form
        :id="formId"
        class="diary-form"
        aria-label="Запись в дневнике"
        @submit.prevent="submit()"
      >
        <label v-if="!movie && !entry" class="diary-form__field">
          <span>Произведение из вашей коллекции *</span>
          <ASelect
            v-model:value="selectedId"
            aria-label="Произведение"
            size="large"
            show-search
            :filter-option="false"
            :options="options"
            :loading="loadingMovies"
            :disabled="busy"
            placeholder="Найти по названию"
            @search="emit('search', $event)"
          >
            <template #suffixIcon
              ><BaseIcon name="ph:caret-down" :width="16" :height="16"
            /></template>
          </ASelect>
          <small
            >Нет нужного тайтла? Сначала добавьте его через каталог или
            вручную.</small
          >
        </label>
        <div v-if="selectedMovie" class="diary-form__movie">
          <MoviePoster
            :src="selectedMovie.imageUrl"
            :title="selectedMovie.title"
            :seed="selectedMovie.id"
          />
          <div>
            <strong>{{ selectedMovie.title }}</strong>
            <p>
              {{ formatYear(selectedMovie.publishDate) }} ·
              {{ contentTypeLabel(selectedMovie) }}
            </p>
          </div>
        </div>
        <div v-if="selectedMovie?.isSerial" class="diary-form__field">
          <span>Что посмотрели</span>
          <div
            class="diary-form__scope"
            role="group"
            aria-label="Что посмотрели"
          >
            <button
              type="button"
              :aria-pressed="draft.scope === 'TITLE'"
              :disabled="busy"
              @click="draft.scope = 'TITLE'"
            >
              Сериал целиком
            </button>
            <button
              type="button"
              :aria-pressed="draft.scope === 'SEASON'"
              :disabled="busy"
              @click="draft.scope = 'SEASON'"
            >
              Отдельный сезон
            </button>
          </div>
        </div>
        <div v-if="draft.scope === 'SEASON'" class="diary-form__field">
          <span>Сезон *</span
          ><NumberField
            v-model="draft.season"
            label="Сезон"
            :min="1"
            :max="Math.min(selectedMovie?.seasonCount ?? 100, 100)"
            :disabled="busy"
          />
        </div>
        <div class="diary-form__field">
          <label :for="`${formId}-date`">Дата просмотра *</label>
          <ADatePicker
            :id="`${formId}-date`"
            v-model:value="draft.viewedOn"
            class="diary-date-picker"
            popup-class-name="diary-calendar-popup"
            aria-label="Дата просмотра"
            value-format="YYYY-MM-DD"
            format="DD.MM.YYYY"
            size="large"
            placement="topLeft"
            :allow-clear="false"
            :locale="dateLocale"
            :input-read-only="true"
            :disabled-date="disabledDate"
            :disabled="busy"
            placeholder="Выберите дату"
          >
            <template #suffixIcon>
              <BaseIcon name="ph:calendar-blank" :width="18" :height="18" />
              <button
                v-if="draft.viewedOn"
                type="button"
                class="diary-field-clear"
                aria-label="Очистить дату"
                :disabled="busy"
                @mousedown.prevent.stop
                @keydown.stop
                @click.prevent.stop="draft.viewedOn = ''"
              >
                <BaseIcon name="ph:x" :width="16" :height="16" />
              </button>
            </template>
          </ADatePicker>
          <div class="diary-form__dates">
            <AButton size="small" :disabled="busy" @click="relativeDate(0)"
              >Сегодня</AButton
            ><AButton size="small" :disabled="busy" @click="relativeDate(-1)"
              >Вчера</AButton
            >
          </div>
          <small
            >Для сериала или сезона — день, когда закончили просмотр.</small
          >
        </div>
        <label class="diary-form__rewatch"
          ><ASwitch v-model:checked="draft.isRewatch" :disabled="busy" /><span
            >Это пересмотр<small
              >Можно отметить, даже если прежнего просмотра ещё нет в
              дневнике.</small
            ></span
          ></label
        >
        <div class="diary-form__field">
          <span>Оценка этого просмотра · необязательно</span>
          <div class="diary-form__rating">
            <ARate v-model:value="score" :count="10" :disabled="busy" /><span
              v-if="draft.rating"
              >{{ draft.rating }}/10</span
            >
          </div>
          <button
            v-if="draft.rating"
            type="button"
            class="diary-form__text"
            :disabled="busy"
            @click="score = 0"
          >
            Без оценки
          </button>
        </div>
        <label class="diary-form__field"
          ><span>Личная заметка · необязательно</span
          ><textarea
            v-model="draft.note"
            class="fv-native-field"
            aria-label="Личная заметка"
            rows="3"
            maxlength="500"
            :disabled="busy"
            placeholder="Что запомнилось? Как изменилось впечатление?"
          /><small class="diary-form__counter"
            ><span>Только для вас</span
            ><span>{{ draft.note.length }} / 500</span></small
          ></label
        >
        <AppDisclosure v-if="!entry" label="Также обновить коллекцию">
          <p class="diary-form__hint">
            По умолчанию сохраняется только запись в дневнике.
          </p>
          <ACheckbox
            v-model:checked="draft.syncStatus"
            :disabled="busy || draft.scope === 'SEASON'"
            >Отметить произведение просмотренным</ACheckbox
          >
          <p v-if="draft.scope === 'SEASON'" class="diary-form__hint">
            Сезон не завершает весь сериал и не меняет счётчик серий.
          </p>
          <ACheckbox
            v-model:checked="draft.syncRating"
            :disabled="busy || !draft.rating"
            >Использовать эту оценку как мою текущую оценку тайтла</ACheckbox
          >
        </AppDisclosure>
        <div v-if="duplicate" class="diary-form__duplicate" role="status">
          <p>За эту дату уже есть запись об этом просмотре.</p>
          <div>
            <AButton :disabled="busy" @click="emit('openDuplicate', duplicate)"
              >Открыть запись</AButton
            ><AButton
              data-allow-duplicate
              :disabled="busy"
              @click="submit(true)"
              >Это ещё один просмотр</AButton
            >
          </div>
        </div>
        <p
          v-if="validationError || props.error"
          class="diary-form__error"
          role="alert"
        >
          {{ validationError || props.error }}
        </p>
      </form>
    </template>
    <template #footer
      ><AButton :disabled="busy" @click="open = false">Отмена</AButton
      ><AButton
        type="primary"
        html-type="submit"
        :form="formId"
        :loading="busy"
        :disabled="busy"
        >{{ entry ? "Сохранить изменения" : "Сохранить просмотр" }}</AButton
      ></template
    >
  </BaseModal>
</template>

<style lang="scss">
@use "@/styles/media" as *;

.diary-form-modal {
  .modal__footer {
    display: flex;
    gap: 12px;
  }

  .modal__footer .ant-btn {
    min-height: 44px;
    height: auto;
    white-space: normal;
  }

  .modal__footer .ant-btn-primary {
    flex: 2;
  }

  .modal__footer .ant-btn-default {
    flex: 1;
  }
}

.diary-form {
  display: grid;
  gap: 20px;
  padding: 4px 0 24px;
  text-align: left;

  &__field {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
  }

  &__field > span,
  &__field > label {
    color: var(--fv-color-text-secondary);
    font-size: 14px;
    font-weight: 500;
  }

  &__dates {
    display: flex;
    gap: 8px;
  }

  &__dates .ant-btn {
    min-height: 32px;
    height: auto;
    padding: 4px 12px;
    border-radius: var(--fv-radius-control);
  }

  small,
  &__hint {
    color: var(--fv-color-text-secondary);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
  }

  .ant-select-selector,
  .ant-picker {
    min-height: 52px;
    width: 100%;
  }

  .ant-select-single.ant-select-lg .ant-select-selector {
    height: 52px;
  }

  .ant-select-single.ant-select-lg .ant-select-selection-item,
  .ant-select-single.ant-select-lg .ant-select-selection-placeholder {
    line-height: 49px;
  }

  .ant-select-single.ant-select-lg .ant-select-selection-search-input {
    height: 49px;
    line-height: 49px;
  }

  &__movie {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    background: var(--fv-color-bg-secondary);
    border-radius: var(--fv-radius-md);
  }

  &__movie .movie-poster {
    width: 42px;
    height: 63px;
    flex: none;
  }

  &__movie strong {
    font-size: 16px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  &__movie p {
    font-size: 13px;
    color: var(--fv-color-text-secondary);
    margin: 4px 0 0;
  }

  &__scope {
    display: flex;
    gap: 8px;
  }

  &__scope button {
    flex: 1;
    min-height: 44px;
    border: 1px solid transparent;
    border-radius: var(--fv-radius-control);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    padding: 8px;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  &__scope [aria-pressed="true"] {
    color: var(--fv-color-accent);
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
  }

  &__rewatch {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__rewatch small {
    display: block;
    margin-top: 4px;
  }

  &__rewatch .ant-switch {
    flex: none;
  }

  &__counter {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  textarea {
    min-height: 110px;
    resize: vertical;
  }

  &__rating {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__rating .ant-rate {
    font-size: 22px;
    color: var(--fv-color-warning);
  }

  &__rating .ant-rate-star:not(:last-child) {
    margin-inline-end: 5px;
  }

  &__rating > span {
    font-size: 14px;
    color: var(--fv-color-text-secondary);
  }

  &__text {
    justify-self: start;
    padding: 4px 0;
    background: none;
    border: 0;
    color: var(--fv-color-accent);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .ant-checkbox-wrapper {
    display: flex;
    align-items: flex-start;
    margin: 12px 0;
    white-space: normal;
  }

  &__hint {
    margin: 8px 0;
  }

  &__duplicate {
    padding: 14px;
    background: var(--fv-color-warning-soft);
    border-radius: var(--fv-radius-sm);
    font-size: 14px;
  }

  &__duplicate p {
    margin: 0 0 12px;
  }

  &__duplicate > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__duplicate .ant-btn {
    height: auto;
    min-height: 40px;
    white-space: normal;
  }

  &__error {
    margin: 0;
    color: var(--fv-color-negative);
    font-size: 14px;
  }

  @include mediaMax(480px) {
    &__rating .ant-rate {
      font-size: 18px;
    }

    &__rating .ant-rate-star:not(:last-child) {
      margin-inline-end: 3px;
    }

    &__scope button {
      font-size: 12px;
    }
  }
}

.diary-date-picker {
  .ant-picker-input {
    gap: 8px;
  }

  .ant-picker-suffix {
    align-items: center;
    margin-inline-start: 0;
    gap: 8px;
    color: var(--fv-color-text-tertiary);

    > :not(:last-child) {
      margin-inline-end: 0;
    }
  }
}

.diary-field-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 4px;
  border: 0;
  cursor: pointer;
  pointer-events: auto;
  background: transparent;
  color: var(--fv-color-text-secondary);
  border-radius: 6px;

  &:hover:not(:disabled) {
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }
}

.diary-calendar-popup {
  font-family: var(--fv-font-ui);

  .ant-picker-panel-container {
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-md);
    box-shadow: var(--fv-shadow-card);
  }

  .ant-picker-header button {
    font-family: inherit;
  }

  .ant-picker-today-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: var(--fv-radius-control);
    color: var(--fv-color-accent);
    text-decoration: none;

    &:hover {
      background: var(--fv-color-accent-soft);
    }
  }
}
</style>
