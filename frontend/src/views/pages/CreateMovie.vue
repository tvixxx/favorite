<script lang="ts" setup>
import {
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  computed,
  watch,
} from "vue";
import { useNavigateBack } from "@/composable/useNavigateBack";

import { message, type FormInstance } from "ant-design-vue";
import WatchStatusSelect from "@/components/WatchStatusSelect/WatchStatusSelect.vue";
import { useMoviesStore } from "@/stores/movies/moviesStore";
import { WatchStatus } from "@/stores";
import { useUserMoviesStore } from "@/stores";
import { useActorsStore } from "@/stores/actors/actorsStore";
import { useMainStore } from "@/state/state";
import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import { showErrorRequest } from "@/state/utils";
import {
  Genre,
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";
import type { CreateMoviePayload } from "@/stores/movies/types";
import type { SelectProps } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";
import ImagePicker from "@/components/ImagePicker/ImagePicker.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import type { ImageSelection } from "@/services/media";
import ContentTypePicker from "@/components/ContentType/ContentTypePicker.vue";
import NumberField from "@/components/NumberField/NumberField.vue";
import {
  MIN_MEDIA_YEAR,
  maxMediaYear,
  MAX_SEASONS,
  MAX_EPISODES,
  isOptionalInteger,
  isMediaDate,
  progressMax,
} from "@/utils/media-numbers";
import TitleCandidates from "@/components/ContentType/TitleCandidates.vue";
import { type ContentKind, type ContentSelection } from "@/utils/content-kind";
import TvdbAdd from "@/components/Tvdb/TvdbAdd.vue";
import { tvdbEnabled } from "@/services/tvdb";

const { navigateBack } = useNavigateBack();
const moviesStore = useMoviesStore();
const userMoviesStore = useUserMoviesStore();
const actorsStore = useActorsStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || "");
const catalogueEnabled = ref(false);
const addMode = ref<"manual" | "search">("manual");
const capabilityRequest = new AbortController();

onMounted(async () => {
  const enabled = await tvdbEnabled(capabilityRequest.signal);

  if (capabilityRequest.signal.aborted) return;
  catalogueEnabled.value = enabled;
  if (enabled && !formData.title.trim()) addMode.value = "search";
});

onBeforeUnmount(() => capabilityRequest.abort());
function addManually(title: string): void {
  if (!formData.title.trim()) formData.title = title;
  addMode.value = "manual";
}

function refreshImported(): void {
  moviesStore.isMoviesLoaded = false;
  void userMoviesStore.refreshAfterImport(userId.value);
}

const isActorResolving = ref(false);
const isSubmitting = ref(false);
const posterSelection = ref<ImageSelection | null>(null);
const posterUploading = ref(false);
const posterSeed = Math.random().toString(36).slice(2);
let actorSelectionRevision = 0;

onBeforeUnmount(() => {
  actorSelectionRevision += 1;
});

const handleActorSelection = async (selectedValues: string[]) => {
  const revision = ++actorSelectionRevision;

  isActorResolving.value = true;

  const processedValues: string[] = [];

  for (const value of selectedValues) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      try {
        const newActor = await actorsStore.addActorByName(value);

        if (revision !== actorSelectionRevision) {
          return;
        }

        processedValues.push(newActor.id);
      } catch {
        if (revision !== actorSelectionRevision) {
          return;
        }

        message.error(`Не удалось добавить актера: ${value}`);
      }
    } else {
      processedValues.push(value);
    }
  }

  if (revision === actorSelectionRevision) {
    formData.actorIds = [...new Set(processedValues)];
    isActorResolving.value = false;
  }
};

interface CreateMovieForm {
  title: string;
  publishDate: string;
  description: string;
  countryCodes: string[];
  genres: Genre[];
  seeLater: boolean;
  isSerial: boolean | null;
  contentKind: ContentKind | null;
  seasonCount?: number;
  episodeCount?: number;
  currentSeason?: number;
  currentEpisode?: number;
  imageUrl: string;
  personalRate: number;
  isFavorite: boolean;
  actorIds: string[];
}

const formData = reactive<CreateMovieForm>({
  title: "",
  publishDate: "",
  description: "",
  countryCodes: [],
  genres: [],
  seeLater: false,
  isSerial: null,
  contentKind: null,
  seasonCount: undefined,
  episodeCount: undefined,
  currentSeason: undefined,
  currentEpisode: undefined,
  imageUrl: "",
  personalRate: 0,
  isFavorite: false,
  actorIds: [],
});
const formRef = ref<FormInstance | null>(null);
const typeError = ref("");
const contentSelection = computed<ContentSelection>({
  get: () => ({
    contentKind: formData.contentKind,
    isSerial: formData.isSerial,
  }),
  set: (value) => {
    formData.contentKind = value.contentKind;
    formData.isSerial = value.isSerial;
    typeError.value = "";
  },
});

async function addExisting(movieId: string): Promise<void> {
  if (isSubmitting.value || !userId.value) return;
  isSubmitting.value = true;
  try {
    await userMoviesStore.addUserMovie(userId.value, movieId, {});
    message.success("Добавлено в коллекцию. Введённая форма сохранена.");
  } catch (error) {
    showErrorRequest(error);
  } finally {
    isSubmitting.value = false;
  }
}

watch(posterSelection, (selection) => {
  formData.imageUrl = selection?.url ?? "";

  if (formData.imageUrl) {
    formRef.value?.clearValidate(["imageUrl"]);
  }
});

const countrySelectOptions: SelectProps["options"] = PRODUCTION_COUNTRIES.map(
  (c) => ({
    label: `${c.label} (${c.code})`,
    value: c.code,
  })
);

const GENRES_VISIBLE_LIMIT = 6;

const genreOptions = GenreValues.map((g) => ({
  label: GenreLabels[g],
  value: g,
}));

const showAllGenres = ref(false);

// Статус относится к записи пользователя, а не к самому фильму
const watchStatus = ref<WatchStatus>(WatchStatus.NOT_STARTED);

// Пока список не раскрыт, показываем первые шесть + выбранные (эталон)
const visibleGenres = computed(() =>
  showAllGenres.value
    ? genreOptions
    : genreOptions.filter(
        (option, index) =>
          index < GENRES_VISIBLE_LIMIT || formData.genres.includes(option.value)
      )
);

const hiddenGenresCount = computed(
  () => genreOptions.length - visibleGenres.value.length
);

const toggleGenre = (value: Genre): void => {
  formData.genres = formData.genres.includes(value)
    ? formData.genres.filter((g) => g !== value)
    : [...formData.genres, value];
};

const filterCountryOption = (input: string, option: { label?: string }) =>
  (option?.label ?? "").toLowerCase().includes(input.toLowerCase());

const cancel = (): void => {
  void navigateBack({ fallback: { name: "library-collection" } });
};

function isPublishYearDisabled(date: { year: () => number }): boolean {
  return !isOptionalInteger(date.year(), MIN_MEDIA_YEAR, maxMediaYear());
}

onMounted(async () => {
  try {
    await actorsStore.fetchActorsForPickers();
  } catch {
    message.error("Не удалось загрузить актеров");
  }
});

const addNewMovie = async () => {
  if (isSubmitting.value || isActorResolving.value || posterUploading.value) {
    return;
  }

  if (!formData.contentKind || formData.isSerial === null) {
    typeError.value = !formData.contentKind
      ? "Выберите, что добавляете"
      : "Уточните формат";

    return;
  }

  if (
    !isMediaDate(formData.publishDate) ||
    (formData.isSerial &&
      !(
        [
          [formData.seasonCount, 1, MAX_SEASONS],
          [formData.episodeCount, 1, MAX_EPISODES],
          [
            formData.currentSeason,
            0,
            progressMax(formData.seasonCount, MAX_SEASONS),
          ],
          [
            formData.currentEpisode,
            0,
            progressMax(formData.episodeCount, MAX_EPISODES),
          ],
        ] as const
      ).every(([value, min, max]) => isOptionalInteger(value, min, max)))
  ) {
    message.error("Проверьте год выхода и числовые поля сезонов и серий");

    return;
  }

  isSubmitting.value = true;

  const { title } = formData;

  try {
    const moviePayload: CreateMoviePayload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      countryCodes: formData.countryCodes,
      genres: formData.genres,
      publishDate: formData.publishDate
        ? new Date(formData.publishDate).toISOString()
        : null,
      actorIds: formData.actorIds,
      imageUrl: posterSelection.value?.assetId
        ? undefined
        : formData.imageUrl || undefined,
      posterAssetId: posterSelection.value?.assetId ?? undefined,
      isSerial: formData.isSerial,
      contentKind: formData.contentKind,
      seasonCount: formData.isSerial ? formData.seasonCount : undefined,
      episodeCount: formData.isSerial ? formData.episodeCount : undefined,
      collection: {
        isFavorite: formData.isFavorite,
        seeLater: formData.seeLater,
        personalRate: formData.personalRate || null,
        watchStatus: watchStatus.value,
        currentSeason: formData.isSerial
          ? formData.currentSeason ?? null
          : null,
        currentEpisode: formData.isSerial
          ? formData.currentEpisode ?? null
          : null,
      },
    };

    const createdMovie = await moviesStore.createMovie(moviePayload);

    if (createdMovie && userId.value) {
      userMoviesStore.isLoaded = false;
      await userMoviesStore
        .fetchUserMovies(userId.value)
        .catch(() => undefined);
    }

    formRef?.value?.resetFields();
    posterSelection.value = null;
    formData.actorIds = [];
    formData.countryCodes = [];
    formData.genres = [];
    formData.personalRate = 0;
    formData.isFavorite = false;
    formData.seeLater = false;
    formData.isSerial = null;
    formData.contentKind = null;
    typeError.value = "";
    formData.seasonCount = undefined;
    formData.episodeCount = undefined;
    formData.currentSeason = undefined;
    formData.currentEpisode = undefined;
    watchStatus.value = WatchStatus.NOT_STARTED;
    message.success(`${title} добавлен`);
  } catch (error: unknown) {
    if (isApiConflictError(error)) {
      message.warning(
        getApiResponseMessage(error) ?? "Такой фильм уже есть в каталоге."
      );

      return;
    }

    showErrorRequest(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="create-movie">
    <div class="create-movie__wrap">
      <AppBackButton
        class="create-movie__back"
        :fallback="{ path: '/library' }"
      />

      <div class="create-movie__card">
        <h1 class="create-movie__title">Добавить в коллекцию</h1>
        <div
          v-if="catalogueEnabled"
          class="cm-add-modes"
          role="group"
          aria-label="Способ добавления"
        >
          <button
            type="button"
            :aria-pressed="addMode === 'search'"
            @click="addMode = 'search'"
          >
            Найти в TheTVDB
          </button>
          <button
            type="button"
            :aria-pressed="addMode === 'manual'"
            @click="addMode = 'manual'"
          >
            Вручную
          </button>
        </div>
        <TvdbAdd
          v-if="catalogueEnabled"
          v-show="addMode === 'search'"
          :user-id="userId"
          :session-revision="mainStore.sessionRevision"
          :is-admin="mainStore.userData?.role === 'ADMIN'"
          @manual="addManually"
          @added="refreshImported"
        />

        <a-form
          v-show="addMode === 'manual'"
          ref="formRef"
          :model="formData"
          :disabled="isSubmitting"
          name="create-movie-form"
          layout="vertical"
          class="cm-form"
          @finish="addNewMovie"
        >
          <div class="cm-grid">
            <!-- ЛЕВО: поля -->
            <div class="cm-fields">
              <a-form-item
                label="Название"
                name="title"
                :rules="[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Введите название',
                  },
                ]"
              >
                <a-input
                  v-model:value="formData.title"
                  :maxlength="200"
                  size="large"
                  placeholder="Например: Интерстеллар"
                />
              </a-form-item>

              <a-form-item
                label="Постер"
                name="imageUrl"
                extra="Необязательно. Без изображения появится иллюстрированная обложка."
              >
                <ImagePicker
                  v-model="posterSelection"
                  purpose="MOVIE_POSTER"
                  label="Постер"
                  :show-preview="false"
                  :disabled="isSubmitting"
                  @busy="posterUploading = $event"
                />
              </a-form-item>

              <a-form-item label="Актёры" name="actorIds">
                <div class="cm-actors">
                  <BaseIcon
                    class="cm-actors__icon"
                    name="ph:user-plus"
                    :width="18"
                    :height="18"
                  />
                  <a-select
                    v-model:value="formData.actorIds"
                    mode="tags"
                    placeholder="Выберите или введите актёров"
                    size="large"
                    :loading="actorsStore.isPickerLoading || isActorResolving"
                    :disabled="actorsStore.isPickerLoading || isSubmitting"
                    @change="handleActorSelection"
                  >
                    <a-select-option
                      v-for="actor in actorsStore.pickerActors"
                      :key="actor.id"
                      :value="actor.id"
                    >
                      {{ actor.name }}
                    </a-select-option>
                  </a-select>
                </div>
              </a-form-item>

              <div class="cm-row2">
                <a-form-item label="Дата выхода" name="publishDate">
                  <a-date-picker
                    v-model:value="formData.publishDate"
                    size="large"
                    picker="year"
                    :disabled-date="isPublishYearDisabled"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                    placeholder="Выберите дату"
                  />
                </a-form-item>

                <a-form-item label="Статус">
                  <WatchStatusSelect v-model="watchStatus" />
                </a-form-item>
              </div>

              <div class="cm-row1">
                <a-form-item
                  label="Страны"
                  name="countryCodes"
                  extra="Если страна неизвестна, оставьте поле пустым."
                >
                  <a-select
                    v-model:value="formData.countryCodes"
                    mode="multiple"
                    show-search
                    :filter-option="filterCountryOption"
                    :max-tag-count="3"
                    :options="countrySelectOptions"
                    placeholder="Не указана"
                    size="large"
                    allow-clear
                  />
                </a-form-item>
              </div>

              <a-form-item
                label="Жанры"
                name="genres"
                :rules="[
                  {
                    type: 'array',
                    required: true,
                    min: 1,
                    message: 'Выберите хотя бы один жанр',
                  },
                ]"
              >
                <div class="cm-pills">
                  <button
                    v-for="option in visibleGenres"
                    :key="option.value"
                    type="button"
                    class="cm-pill"
                    :class="{
                      'cm-pill--on': formData.genres.includes(option.value),
                    }"
                    @click="toggleGenre(option.value)"
                  >
                    {{ option.label }}
                  </button>

                  <button
                    v-if="hiddenGenresCount"
                    type="button"
                    class="cm-pill cm-pill--more"
                    @click="showAllGenres = true"
                  >
                    <BaseIcon name="ph:plus" :width="15" :height="15" />
                    Ещё
                  </button>
                </div>
              </a-form-item>

              <a-form-item label="Что добавляем?" required>
                <ContentTypePicker
                  v-model="contentSelection"
                  :disabled="isSubmitting"
                />
                <p v-if="typeError" class="cm-type-error" role="alert">
                  {{ typeError }}
                </p>
                <TitleCandidates
                  :title="formData.title"
                  :disabled="isSubmitting"
                  can-add
                  @choose="addExisting"
                />
              </a-form-item>

              <div class="cm-toggles">
                <label class="cm-toggle">
                  <a-switch v-model:checked="formData.seeLater" />
                  <span>Смотреть позже</span>
                </label>
              </div>

              <div v-if="formData.isSerial" class="cm-row2">
                <a-form-item label="Количество сезонов" name="seasonCount">
                  <NumberField
                    v-model="formData.seasonCount"
                    label="Количество сезонов"
                    :disabled="isSubmitting"
                    :min="1"
                    :max="MAX_SEASONS"
                  />
                </a-form-item>

                <a-form-item
                  :label="
                    formData.contentKind === 'TV_SHOW'
                      ? 'Количество выпусков'
                      : 'Количество эпизодов'
                  "
                  name="episodeCount"
                >
                  <NumberField
                    v-model="formData.episodeCount"
                    :label="
                      formData.contentKind === 'TV_SHOW'
                        ? 'Количество выпусков'
                        : 'Количество эпизодов'
                    "
                    :disabled="isSubmitting"
                    :min="1"
                    :max="MAX_EPISODES"
                  />
                </a-form-item>
              </div>

              <div v-if="formData.isSerial" class="cm-row2">
                <a-form-item
                  label="На каком сезоне остановились"
                  name="currentSeason"
                >
                  <NumberField
                    v-model="formData.currentSeason"
                    label="На каком сезоне остановились"
                    :disabled="isSubmitting"
                    :min="0"
                    :max="progressMax(formData.seasonCount, MAX_SEASONS)"
                  />
                </a-form-item>

                <a-form-item
                  :label="
                    formData.contentKind === 'TV_SHOW'
                      ? 'На каком выпуске остановились'
                      : 'На какой серии остановились'
                  "
                  name="currentEpisode"
                >
                  <NumberField
                    v-model="formData.currentEpisode"
                    :label="
                      formData.contentKind === 'TV_SHOW'
                        ? 'На каком выпуске остановились'
                        : 'На какой серии остановились'
                    "
                    :disabled="isSubmitting"
                    :min="0"
                    :max="progressMax(formData.episodeCount, MAX_EPISODES)"
                  />
                </a-form-item>
              </div>

              <a-form-item
                label="Описание"
                name="description"
                :rules="[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Добавьте описание',
                  },
                ]"
              >
                <a-textarea
                  v-model:value="formData.description"
                  :rows="4"
                  placeholder="Кратко о сюжете или содержании"
                  :maxlength="500"
                  :show-count="true"
                />
              </a-form-item>
            </div>

            <!-- ПРАВО (десктоп) / превью сверху (мобайл): постер + оценка -->
            <div class="cm-side">
              <div class="cm-poster">
                <MoviePoster
                  :src="posterSelection?.thumbnailUrl || formData.imageUrl"
                  :seed="posterSeed"
                  :title="formData.title || 'Новое произведение'"
                  :meta="formData.publishDate || ''"
                  alt="Предпросмотр постера"
                  class="cm-poster__img"
                />
                <span class="cm-poster__badge">
                  {{ formData.personalRate || "?" }}/10
                </span>
              </div>

              <div class="cm-side__rating">
                <p class="cm-side__label">Ваша оценка</p>
                <a-rate
                  v-model:value="formData.personalRate"
                  :count="10"
                  class="cm-stars"
                />
              </div>
            </div>
          </div>

          <div class="cm-footer">
            <a-button size="large" class="cm-footer__cancel" @click="cancel">
              Отмена
            </a-button>
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              class="cm-footer__submit"
              :loading="isSubmitting"
              :disabled="isActorResolving || posterUploading"
            >
              <BaseIcon name="ph:plus" :width="18" :height="18" />
              Добавить
            </a-button>
          </div>
        </a-form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;
@use "@/styles/movie-form" as *;

.cm-type-error {
  margin: 8px 0 0;
  color: var(--fv-color-negative);
}

.cm-add-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;

  button {
    padding: 12px 18px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: transparent;
    color: var(--fv-color-text-primary);
    font: inherit;
    cursor: pointer;
  }

  button[aria-pressed="true"] {
    background: var(--fv-color-accent-soft);
    border-color: var(--fv-color-accent);
  }

  button:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 3px;
  }
}

.create-movie {
  @include pageShell(2rem);

  &__wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  &__back {
    display: inline-flex;
    margin-bottom: 1.25rem;

    :deep(.app-back-btn) {
      margin: 0;
    }
  }

  &__card {
    background: var(--fv-color-bg-primary);

    // место под закреплённую кнопку на мобиле
    @include mediaMax(767.98px) {
      margin-bottom: 84px;
    }

    // 320–400px: карточке нужен более скромный паддинг, иначе полям тесно
    @include mediaMax(400px) {
      padding: 16px;
    }

    border-radius: var(--fv-radius-lg);
    box-shadow: var(--fv-shadow-low);
    padding: 22px;

    @include mediaTablet {
      padding: 32px;
    }
  }

  &__title {
    margin: 0 0 1.75rem;
    font-family: var(--fv-font-ui);
    font-size: var(--fv-text-h3-size);
    line-height: var(--fv-text-h3-lh);
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }
}

/* Сетка: форма слева (fluid) + постер/оценка справа (300px) */
.cm-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;

  // 2 колонки только с 960px — до этого форма зажималась рядом с постером
  @include mediaDesktopXS {
    grid-template-columns: 1fr 300px;
    gap: 2.25rem;
  }
}

.cm-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* два поля в ряд (Дата + Страны, сериал-поля) */
.cm-row1 {
  display: grid;
  grid-template-columns: 1fr;
}

.cm-row2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0 16px;

  @include mediaMin(520px) {
    grid-template-columns: 1fr 1fr;
  }
}

/* инлайн-тумблеры */
.cm-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;

  @include mediaMax(400px) {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }
  border: 1px solid var(--fv-color-border);
  border-radius: 999px;
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--fv-motion-fast) var(--fv-ease),
    color var(--fv-motion-fast) var(--fv-ease);

  &:hover:not(&--on) {
    background: var(--fv-color-bg-secondary);
  }

  &--on {
    background: var(--fv-color-text-primary);
    border-color: transparent;
    color: var(--fv-color-bg-primary);
  }

  &--more {
    border-style: dashed;
    background: transparent;
    color: var(--fv-color-text-secondary);
  }
}

.cm-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 30px;
  margin: 4px 0 1.25rem;
}

.cm-toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fv-color-text-primary);
  cursor: pointer;
}

/* правая колонка (десктоп) / компактное превью-строка (мобайл, эталон) */
.cm-side {
  display: flex;
  align-items: center;
  gap: 16px;
  order: -1; // на мобиле превью сверху
  margin-bottom: 8px;

  @include mediaMax(400px) {
    gap: 12px;
  }

  @include mediaDesktopXS {
    display: block;
    order: 0;
    margin-bottom: 0;
    position: sticky;
    top: 1.5rem;
    align-self: start;
  }
}

.cm-side__rating {
  min-width: 0;
}

.cm-poster {
  position: relative;
  flex: none;
  aspect-ratio: 2 / 3;
  width: 96px; // компактный постер на мобиле (эталон)

  @include mediaMax(400px) {
    width: 84px;
  }
  border-radius: var(--fv-radius-md);
  overflow: hidden;
  box-shadow: var(--fv-shadow-low);

  @include mediaDesktopXS {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 8px;
    display: none; // на компактном мобильном постере не показываем
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--fv-color-accent);
    color: #fff;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.4;

    @include mediaDesktopXS {
      display: block;
      top: 12px;
      right: 12px;
      padding: 4px 12px;
      font-size: 13px;
    }
  }
}

.cm-side__label {
  margin: 0 0 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fv-color-text-secondary);

  @include mediaDesktopXS {
    margin: 18px 0 8px;
  }
}

.cm-stars {
  font-size: 22px;
  color: var(--fv-color-warning, #fac031);

  @include mediaMax(400px) {
    font-size: 17px;
  }

  @include mediaDesktopXS {
    font-size: 26px;
  }

  :deep(.ant-rate-star:not(:last-child)) {
    margin-inline-end: 3px;
  }
}

/* селект «Актёры» с ведущей иконкой */
.cm-actors {
  position: relative;

  &__icon {
    position: absolute;
    left: 14px;
    top: 50%;
    z-index: 1;
    transform: translateY(-50%);
    color: var(--fv-color-text-tertiary);
    pointer-events: none;
  }

  // плейсхолдер, поле ввода (курсор) и теги — на одной линии за иконкой
  :deep(.ant-select-selector) {
    padding-inline-start: 40px !important;
  }

  :deep(.ant-select-selection-placeholder) {
    inset-inline-start: 40px !important;
  }

  :deep(.ant-select-selection-search) {
    margin-inline-start: 0 !important;
    inset-inline-start: 0 !important;
  }
}

/* футер */
.cm-footer {
  @include movieFormFooter;
}

/* лейблы полей — 14/500, вторичный цвет */
:deep(.ant-form-item-label) {
  padding-bottom: 6px;

  > label {
    height: auto;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }
}

:deep(.ant-input),
:deep(.ant-picker),
:deep(.ant-select:not(.ant-select-customize-input) .ant-select-selector) {
  min-height: 52px;
}

:deep(.ant-input-affix-wrapper) {
  min-height: 52px;
}

:deep(.ant-input-affix-wrapper .ant-input) {
  min-height: auto;
}

:deep(.ant-picker-input > input) {
  min-height: auto;
}

/* textarea — авто-высота */
:deep(textarea.ant-input) {
  min-height: 96px;
  padding: 12px 16px;
}
</style>
