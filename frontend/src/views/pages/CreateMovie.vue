<script lang="ts" setup>
import { onMounted, reactive, ref, computed } from "vue";
import { useRouter } from "vue-router";

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
import { Movie } from "@/stores";
import type { SelectProps } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { getApiResponseMessage, isApiConflictError } from "@/services/api";

const router = useRouter();
const moviesStore = useMoviesStore();
const userMoviesStore = useUserMoviesStore();
const actorsStore = useActorsStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || "");

const handleActorSelection = async (selectedValues: string[]) => {
  const processedValues: string[] = [];

  for (const value of selectedValues) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      try {
        const newActor = await actorsStore.addActorByName(value);
        processedValues.push(newActor.id);
      } catch {
        message.error(`Не удалось добавить актера: ${value}`);
      }
    } else {
      processedValues.push(value);
    }
  }

  formData.actorIds = processedValues;
};

interface CreateMovieForm {
  title: string;
  publishDate: string;
  description: string;
  countryCodes: string[];
  genres: Genre[];
  seeLater: boolean;
  isSerial: boolean;
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
  countryCodes: ["US"],
  genres: [Genre.ACTION],
  seeLater: false,
  isSerial: false,
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
          index < GENRES_VISIBLE_LIMIT || formData.genres.includes(option.value),
      ),
);

const hiddenGenresCount = computed(
  () => genreOptions.length - visibleGenres.value.length,
);

const toggleGenre = (value: Genre): void => {
  formData.genres = formData.genres.includes(value)
    ? formData.genres.filter((g) => g !== value)
    : [...formData.genres, value];
};

const filterCountryOption = (input: string, option: { label?: string }) =>
  (option?.label ?? "").toLowerCase().includes(input.toLowerCase());

const cancel = (): void => {
  router.back();
};

onMounted(async () => {
  try {
    await actorsStore.fetchActors();
  } catch {
    message.error("Не удалось загрузить актеров");
  }
});

const addNewMovie = async () => {
  const { title } = formData;

  try {
    const moviePayload: Partial<Movie> = {
      title: formData.title,
      description: formData.description,
      countryCodes: formData.countryCodes,
      genres: formData.genres,
      publishDate: formData.publishDate
        ? new Date(formData.publishDate).toISOString()
        : null,
      actorIds: formData.actorIds,
      imageUrl: formData.imageUrl,
      isSerial: formData.isSerial,
      seasonCount: formData.seasonCount ?? undefined,
      episodeCount: formData.episodeCount ?? undefined,
    };

    const createdMovie = await moviesStore.createMovie(moviePayload);

    if (createdMovie && userId.value) {
      await userMoviesStore.addUserMovie(userId.value, createdMovie.id, {
        isFavorite: formData.isFavorite,
        seeLater: formData.seeLater,
        personalRate: formData.personalRate || null,
        watchStatus: watchStatus.value,
        currentSeason: formData.currentSeason ?? null,
        currentEpisode: formData.currentEpisode ?? null,
      });
    }

    formRef?.value?.resetFields();
    formData.actorIds = [];
    formData.countryCodes = ["US"];
    message.success(`${title} добавлен`);
  } catch (error: unknown) {
    if (isApiConflictError(error)) {
      message.warning(
        getApiResponseMessage(error) ?? "Такой фильм уже есть в каталоге."
      );

      return;
    }

    showErrorRequest(error);
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
        <p class="create-movie__eyebrow">Создание</p>
        <h1 class="create-movie__title">Добавить фильм или сериал</h1>

        <a-form
          ref="formRef"
          :model="formData"
          name="create-movie-form"
          layout="vertical"
          class="cm-form"
          @finish="addNewMovie"
        >
          <div class="cm-grid">
            <!-- ЛЕВО: поля -->
            <div class="cm-fields">
              <a-form-item
                label="Название фильма/сериала"
                name="title"
                :rules="[{ required: true, message: 'Введите название фильма' }]"
              >
                <a-input
                  v-model:value="formData.title"
                  size="large"
                  placeholder="Например: Интерстеллар"
                />
              </a-form-item>

              <a-form-item
                label="Ссылка на постер"
                name="imageUrl"
                :rules="[{ required: true, message: 'Введите ссылку на постер' }]"
              >
                <a-input
                  v-model:value="formData.imageUrl"
                  size="large"
                  placeholder="https://image.tmdb.org/t/p/w500/..."
                >
                  <template #prefix>
                    <BaseIcon name="ph:link" :width="18" :height="18" />
                  </template>
                </a-input>
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
                    :loading="actorsStore.isActorsLoading"
                    :disabled="actorsStore.isActorsLoading"
                    @change="handleActorSelection"
                  >
                    <a-select-option
                      v-for="actor in actorsStore.getAllActors"
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
                  :rules="[
                    {
                      type: 'array',
                      required: true,
                      min: 1,
                      message: 'Выберите хотя бы одну страну',
                    },
                  ]"
                >
                  <a-select
                    v-model:value="formData.countryCodes"
                    mode="multiple"
                    show-search
                    :filter-option="filterCountryOption"
                    :max-tag-count="3"
                    :options="countrySelectOptions"
                    placeholder="Страны съёмок / ко-продукция"
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

              <a-form-item label="Тип">
                <div class="cm-pills" role="group">
                  <button
                    type="button"
                    class="cm-pill"
                    :class="{ 'cm-pill--on': !formData.isSerial }"
                    @click="formData.isSerial = false"
                  >
                    Фильм
                  </button>
                  <button
                    type="button"
                    class="cm-pill"
                    :class="{ 'cm-pill--on': formData.isSerial }"
                    @click="formData.isSerial = true"
                  >
                    Сериал
                  </button>
                </div>
              </a-form-item>

              <div class="cm-toggles">
                <label class="cm-toggle">
                  <a-switch v-model:checked="formData.seeLater" />
                  <span>Смотреть позже</span>
                </label>
              </div>

              <div v-if="formData.isSerial" class="cm-row2">
                <a-form-item label="Количество сезонов" name="seasonCount">
                  <a-input-number
                    v-model:value="formData.seasonCount"
                    :min="1"
                    :precision="0"
                    size="large"
                    placeholder="Например: 5"
                    style="width: 100%"
                  />
                </a-form-item>

                <a-form-item label="Количество эпизодов" name="episodeCount">
                  <a-input-number
                    v-model:value="formData.episodeCount"
                    :min="1"
                    :precision="0"
                    size="large"
                    placeholder="Например: 10"
                    style="width: 100%"
                  />
                </a-form-item>
              </div>

              <div
                v-if="formData.isSerial && (formData.seasonCount || formData.episodeCount)"
                class="cm-row2"
              >
                <a-form-item
                  v-if="formData.seasonCount"
                  label="На каком сезоне остановились"
                  name="currentSeason"
                >
                  <a-input-number
                    v-model:value="formData.currentSeason"
                    :min="1"
                    :max="formData.seasonCount"
                    :precision="0"
                    size="large"
                    placeholder="Например: 2"
                    style="width: 100%"
                  />
                </a-form-item>

                <a-form-item
                  v-if="formData.episodeCount"
                  label="На какой серии остановились"
                  name="currentEpisode"
                >
                  <a-input-number
                    v-model:value="formData.currentEpisode"
                    :min="1"
                    :max="formData.episodeCount"
                    :precision="0"
                    size="large"
                    placeholder="Например: 5"
                    style="width: 100%"
                  />
                </a-form-item>
              </div>

              <a-form-item label="Описание" name="description">
                <a-textarea
                  v-model:value="formData.description"
                  :rows="4"
                  placeholder="Расскажите о своих впечатлениях от фильма…"
                  :maxlength="500"
                  :show-count="true"
                />
              </a-form-item>
            </div>

            <!-- ПРАВО (десктоп) / превью сверху (мобайл): постер + оценка -->
            <div class="cm-side">
              <div
                class="cm-poster"
                :class="{ 'cm-poster--empty': !formData.imageUrl }"
              >
                <img
                  v-if="formData.imageUrl"
                  :src="formData.imageUrl"
                  alt="Предпросмотр постера"
                  class="cm-poster__img"
                />
                <span v-else class="cm-poster__ph">
                  <BaseIcon
                    class="cm-poster__ph-icon"
                    name="ph:image"
                    :width="24"
                    :height="24"
                  />
                  <span class="cm-poster__ph-text">Постер</span>
                </span>
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
    @media (max-width: 400px) {
      padding: 16px;
    }

    border-radius: var(--fv-radius-lg);
    box-shadow: var(--fv-shadow-low);
    padding: 22px;

    @include mediaTablet {
      padding: 32px;
    }
  }

  &__eyebrow {
    margin: 0 0 6px;
    font-family: var(--fv-font-display);
    font-size: var(--fv-text-p4-size);
    font-weight: 700;
    letter-spacing: var(--fv-ls-caps);
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
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

  @media (min-width: 520px) {
    grid-template-columns: 1fr 1fr;
  }
}

/* инлайн-тумблеры */
/* Пилюли выбора (эталон): активная — тёмная ink, «Ещё» — пунктирная */
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

  @media (max-width: 400px) {
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
  transition:
    background var(--fv-motion-fast) var(--fv-ease),
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

  @media (max-width: 400px) {
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

  @media (max-width: 400px) {
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

  &--empty {
    background: var(--fv-color-bg-secondary);
    border: 1.5px dashed var(--fv-color-border);

    @include mediaDesktopXS {
      border: none;
      background: linear-gradient(160deg, #c4cad6, #8b95a7);
    }
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__ph {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--fv-color-text-tertiary);

    @include mediaDesktopXS {
      gap: 0;
      color: rgba(255, 255, 255, 0.8);
    }
  }

  &__ph-icon {
    @include mediaDesktopXS {
      display: none;
    }
  }

  &__ph-text {
    font-family: var(--fv-font-display);
    font-weight: 700;
    font-size: 11px;

    @include mediaDesktopXS {
      font-size: 26px;
    }
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

  @media (max-width: 400px) {
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
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 1.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--fv-color-border);

  &__cancel,
  &__submit {
    flex: 0 0 auto; // не растягивать
    height: 46px;
    padding: 0 22px;
    border-radius: var(--fv-radius-sm);
    font-weight: 500;
  }

  // Эталон мобилки: кнопка сохранения закреплена снизу
  @include mediaMax(767.98px) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    margin-top: 0;
    padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    background: color-mix(in srgb, var(--fv-color-bg-primary) 94%, transparent);
    backdrop-filter: blur(10px);

    &__cancel {
      flex: 1;
    }

    &__submit {
      flex: 2;
    }
  }

  &__submit {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }
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

/* поля выше — под эталон 52px */
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

/* число сезонов/эпизодов — компактное чистое поле (44px), текст по центру,
   без некрасивых стрелок-степперов (ввод с клавиатуры, min/max сохранены) */
:deep(.ant-input-number) {
  min-height: 44px;
  display: flex;
  align-items: center;
}

:deep(.ant-input-number-input) {
  height: 42px;
}

:deep(.ant-input-number-handler-wrap) {
  display: none;
}

/* textarea — авто-высота */
:deep(textarea.ant-input) {
  min-height: 96px;
  padding: 12px 16px;
}
</style>
