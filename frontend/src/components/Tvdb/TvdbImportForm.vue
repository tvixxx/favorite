<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { TvdbPreview } from "@/services/tvdb";
import { prepareTvdbImport } from "@/services/tvdb-form";
import CountryFilter from "@/components/Countries/CountryFilter.vue";
import WatchStatusSelect from "@/components/WatchStatusSelect/WatchStatusSelect.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import {
  GenreLabels,
  GenreValues,
} from "@/components/Genres/constants/genres.constants";
import { contentTypeLabel } from "@/utils/content-kind";
import { WatchStatus } from "@/stores";
import AppDisclosure from "@/components/AppDisclosure/AppDisclosure.vue";
import ContentTypePicker from "@/components/ContentType/ContentTypePicker.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import NumberField from "@/components/NumberField/NumberField.vue";
import { MAX_EPISODES, MAX_SEASONS } from "@/utils/media-numbers";
import {
  Button as AButton,
  Select as ASelect,
  Switch as ASwitch,
} from "ant-design-vue";

const props = defineProps<{
  preview: TvdbPreview;
  busy: boolean;
  isAdmin?: boolean;
}>();
const emit = defineEmits<{
  confirm: [payload: Record<string, unknown>];
  back: [];
}>();
const edits = reactive({
  title: props.preview.title,
  description: props.preview.description,
  descriptionLanguage: props.preview.descriptionLanguage,
  countryCodes: [...props.preview.countryCodes],
  genres: [...props.preview.genres],
  contentKind: props.preview.contentKind,
});
const personal = reactive({
  watchStatus: WatchStatus.NOT_STARTED,
  seeLater: true,
  currentEpisode: undefined as number | undefined,
  currentSeason: undefined as number | undefined,
});
const existingId = ref(props.preview.localMovieId ?? "");
const error = ref("");
const confirmDistinct = ref(false);
const distinctReason = ref("");
const actorLimit = ref(15);
const allActors = ref(false);
const selectedActors = computed(() =>
  props.preview.actors.slice(
    0,
    allActors.value ? props.preview.actors.length : actorLimit.value
  )
);
const remainingActors = computed(
  () => props.preview.actors.length - selectedActors.value.length
);

function submit(): void {
  error.value = "";
  try {
    const payload = prepareTvdbImport(
      props.preview,
      edits,
      personal,
      existingId.value || undefined
    );

    if (!existingId.value && selectedActors.value.length)
      payload.actorLimit = selectedActors.value.length;
    if (!existingId.value && props.isAdmin && confirmDistinct.value) {
      if (distinctReason.value.trim().length < 10)
        throw new Error("Объясните различие произведений, минимум 10 символов");
      payload.distinctReason = distinctReason.value.trim();
    }

    emit("confirm", payload);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "Проверьте поля";
  }
}

function toggleGenre(genre: string): void {
  const index = edits.genres.indexOf(genre);

  if (index < 0) edits.genres.push(genre);
  else edits.genres.splice(index, 1);
}
</script>

<template>
  <form
    class="tvdb-confirm"
    aria-label="Подтверждение импорта"
    @submit.prevent="submit"
  >
    <button
      type="button"
      class="tvdb-link"
      :disabled="busy"
      @click="emit('back')"
    >
      ← К результатам поиска
    </button>
    <div class="tvdb-confirm__heading">
      <MoviePoster
        :src="preview.posterUrl"
        :title="preview.title || preview.titleEn || preview.originalTitle"
        :seed="`${preview.type}:${preview.id}`"
      />
      <div>
        <h2>{{ preview.title || preview.titleEn || preview.originalTitle }}</h2>
        <p>
          {{ preview.titleEn }} · {{ preview.year ?? "Год неизвестен" }} ·
          {{ contentTypeLabel(preview) }}
        </p>
        <p
          v-if="
            preview.originalTitle && preview.originalTitle !== preview.titleEn
          "
        >
          Оригинал: {{ preview.originalTitle }}
        </p>
      </div>
    </div>
    <fieldset :disabled="busy">
      <div
        v-if="preview.localMovieId || preview.localMatches.length"
        class="tvdb-confirm__matches"
      >
        <h3>Карточка в FavouriteApp</h3>
        <p>Выбор готовой карточки сохранит её общие данные.</p>
        <label v-if="!preview.localMovieId"
          ><input v-model="existingId" type="radio" value="" /> Создать новую
          карточку</label
        >
        <label v-if="preview.localMovieId"
          ><input
            v-model="existingId"
            type="radio"
            :value="preview.localMovieId"
          />
          Использовать связанную карточку</label
        >
        <label
          v-for="match in preview.localMatches.filter(
            (m) =>
              m.id !== preview.localMovieId && m.isSerial === preview.isSerial
          )"
          :key="match.id"
        >
          <input v-model="existingId" type="radio" :value="match.id" />
          {{ match.title }} ·
          {{ match.publishDate?.slice(0, 4) ?? "Год неизвестен" }} ·
          {{ contentTypeLabel(match) }}
        </label>
      </div>
      <template v-if="!existingId">
        <label class="tvdb-field"
          >Название для русского интерфейса *
          <input
            class="fv-native-field"
            v-model="edits.title"
            aria-label="Название для русского интерфейса"
            required
            maxlength="200"
          />
        </label>
        <p v-if="!preview.title" class="tvdb-hint">
          Русского названия нет. Введите название, под которым будете искать
          карточку.
        </p>
        <label class="tvdb-field"
          >{{
            edits.descriptionLanguage === "en"
              ? "Описание на английском"
              : "Описание на русском"
          }}
          *
          <textarea
            class="fv-native-field"
            v-model="edits.description"
            required
            maxlength="10000"
            rows="4"
          />
        </label>
        <p v-if="preview.descriptionLanguage === 'en'" class="tvdb-hint">
          Русского описания нет. Можно оставить английское или написать своё на
          русском.
        </p>
        <div class="tvdb-field">
          <label for="tvdb-description-language">Язык описания</label>
          <ASelect
            id="tvdb-description-language"
            v-model:value="edits.descriptionLanguage"
            aria-label="Язык описания"
            size="large"
            :disabled="busy"
            :options="[
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'Английский' },
            ]"
          >
            <template #suffixIcon
              ><BaseIcon name="ph:caret-down" :width="16" :height="16"
            /></template>
          </ASelect>
        </div>
        <AppDisclosure
          class="tvdb-confirm__section"
          label="Тип, страны и жанры *"
          :open="!edits.countryCodes.length || !edits.genres.length"
        >
          <div class="tvdb-confirm__metadata">
            <div class="tvdb-field">
              <span>Тип контента</span>
              <ContentTypePicker
                :model-value="{
                  contentKind: edits.contentKind,
                  isSerial: preview.isSerial,
                }"
                :locked-format="preview.type"
                :disabled="busy"
                @update:model-value="
                  edits.contentKind = $event.contentKind ?? edits.contentKind
                "
              />
            </div>
            <p class="tvdb-hint">
              Формат из источника: {{ preview.isSerial ? "сериал" : "фильм" }}.
            </p>
            <CountryFilter v-model="edits.countryCodes" />
            <div class="tvdb-confirm__genre-field">
              <span class="tvdb-confirm__label">Жанры *</span>
              <div class="tvdb-genres" role="group" aria-label="Жанры">
                <button
                  v-for="genre in GenreValues"
                  :key="genre"
                  type="button"
                  :aria-pressed="edits.genres.includes(genre)"
                  @click="toggleGenre(genre)"
                >
                  {{ GenreLabels[genre] }}
                </button>
              </div>
              <p v-if="preview.unmappedGenres.length" class="tvdb-hint">
                Жанры источника без соответствия в справочнике:
                {{ preview.unmappedGenres.join(", ") }}.
              </p>
            </div>
          </div>
        </AppDisclosure>
        <AppDisclosure
          v-if="preview.actors.length"
          class="tvdb-confirm__section"
          :label="`Актёры · ${selectedActors.length} из ${preview.actors.length}`"
        >
          <div class="tvdb-confirm__cast-actions">
            <label class="tvdb-checkbox"
              ><input
                v-model="allActors"
                aria-label="Весь состав"
                type="checkbox"
              />
              Весь состав</label
            >
            <button
              v-if="remainingActors > 0"
              type="button"
              class="tvdb-link"
              @click="actorLimit += 10"
            >
              Добавить ещё {{ Math.min(10, remainingActors) }}
            </button>
          </div>
          <p class="tvdb-confirm__cast">
            {{ selectedActors.map((actor) => actor.name).join(", ") }}
          </p>
          <p class="tvdb-hint">
            Выбранные актёры сохранятся вместе с произведением. Уже имеющиеся
            записи будут использованы повторно.
          </p>
        </AppDisclosure>
      </template>
      <AppDisclosure
        v-if="isAdmin && !existingId"
        class="tvdb-confirm__section"
        label="Совпадение названий · для администратора"
      >
        <p class="tvdb-hint">
          Если название совпадает с существующей карточкой, но это другое
          произведение, подтвердите различие. Причина сохранится в журнале
          действий.
        </p>
        <label class="tvdb-checkbox"
          ><input v-model="confirmDistinct" type="checkbox" /> Подтверждаю, что
          это отдельное произведение</label
        >
        <label v-if="confirmDistinct" class="tvdb-field"
          >Причина различия, сохраняется в журнале
          <textarea
            class="fv-native-field"
            v-model="distinctReason"
            minlength="10"
            maxlength="500"
            required
            rows="3"
          />
        </label>
      </AppDisclosure>
      <h3>Ваша коллекция</h3>
      <WatchStatusSelect v-model="personal.watchStatus" :disabled="busy" />
      <label class="tvdb-checkbox"
        ><ASwitch v-model:checked="personal.seeLater" :disabled="busy" />
        Смотреть позже</label
      >
      <template v-if="preview.isSerial">
        <p class="tvdb-hint">
          Для положительного прогресса выберите «Смотрю», «Просмотрено» или
          «Брошено».
        </p>
        <p class="tvdb-hint">
          {{
            preview.episodeCount === null
              ? "Количество серий неизвестно. Процент прогресса не рассчитывается."
              : `Вышло серий: ${preview.episodeCount}. Без спецвыпусков.`
          }}
        </p>
        <div class="tvdb-field">
          <label for="tvdb-current-episode">Просмотрено серий — всего</label>
          <NumberField
            id="tvdb-current-episode"
            v-model="personal.currentEpisode"
            label="Просмотрено серий — всего"
            :disabled="busy"
            :min="0"
            :max="Math.min(preview.episodeCount ?? MAX_EPISODES, MAX_EPISODES)"
          />
        </div>
        <div class="tvdb-field">
          <label for="tvdb-current-season">Текущий сезон, необязательно</label>
          <NumberField
            id="tvdb-current-season"
            v-model="personal.currentSeason"
            label="Текущий сезон"
            :disabled="busy"
            :min="0"
            :max="Math.min(preview.seasonCount ?? MAX_SEASONS, MAX_SEASONS)"
          />
        </div>
      </template>
      <p v-if="error" role="alert" class="tvdb-error">{{ error }}</p>
      <div class="cm-footer">
        <AButton
          size="large"
          class="cm-footer__cancel"
          :disabled="busy"
          @click="emit('back')"
          >Отмена</AButton
        >
        <AButton
          size="large"
          class="cm-footer__submit"
          type="primary"
          html-type="submit"
          :loading="busy"
          ><BaseIcon name="ph:plus" :width="18" :height="18" />Добавить</AButton
        >
      </div>
    </fieldset>
  </form>
</template>

<style scoped lang="scss">
@use "@/styles/movie-form" as *;
@use "@/styles/media" as *;

.cm-footer {
  @include movieFormFooter;
}

.tvdb-confirm {
  max-width: 760px;

  &__heading {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 20px;
    margin: 24px 0;
    align-items: start;
  }

  &__heading > .movie-poster {
    height: 126px;
    border-radius: var(--fv-radius-sm);
  }

  h2 {
    margin: 0 0 10px;
    overflow-wrap: anywhere;
  }

  &__matches {
    padding: 16px;
    background: var(--fv-color-bg-secondary);
    border-radius: var(--fv-radius-sm);
    margin-bottom: 20px;
  }

  &__matches label {
    display: block;
    margin: 10px 0;
  }

  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  &__section {
    margin: 24px 0;
  }

  &__metadata {
    display: grid;
    gap: 20px;
  }

  &__metadata .tvdb-field,
  &__metadata p {
    margin: 0;
  }

  &__genre-field {
    display: grid;
    gap: 10px;
  }

  &__label {
    color: var(--fv-color-text-secondary);
    font-size: 14px;
    font-weight: 500;
  }

  &__metadata :deep(.msfield__label) {
    font-size: 14px;
  }

  &__metadata :deep(.msfield__control) {
    min-height: 52px;
  }

  &__cast-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 24px;
  }

  &__cast-actions .tvdb-checkbox {
    margin: 0;
  }

  &__cast {
    line-height: 1.6;
    margin: 12px 0;
    overflow-wrap: anywhere;
  }

  :deep(.ant-select-single.ant-select-lg .ant-select-selector) {
    height: 52px;
    padding: 0 14px;
    font-size: 15px;
  }

  :deep(.ant-select-single.ant-select-lg .ant-select-selection-item) {
    line-height: 49px;
  }

  :deep(.ant-select-arrow) {
    color: var(--fv-color-text-secondary);
  }
}

.tvdb-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;

    @include mediaMax(400px) {
      height: 32px;
      padding: 0 12px;
      font-size: 13px;
    }

    &:hover {
      background: var(--fv-color-bg-secondary);
    }
  }

  button[aria-pressed="true"] {
    background: var(--fv-color-text-primary);
    border-color: transparent;
    color: var(--fv-color-bg-primary);
  }
}

.tvdb-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--fv-color-text-primary);
  cursor: pointer;
}
</style>
