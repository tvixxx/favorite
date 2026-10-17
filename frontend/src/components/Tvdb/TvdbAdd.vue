<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  importTvdb,
  previewTvdb,
  searchTvdb,
  type TvdbCandidate,
  type TvdbPreview,
} from "@/services/tvdb";
import { getApiResponseMessage } from "@/services/api";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import NumberField from "@/components/NumberField/NumberField.vue";
import { MIN_MEDIA_YEAR, maxMediaYear, isOptionalInteger } from '@/utils/media-numbers';
import TvdbImportForm from "./TvdbImportForm.vue";
import { Button as AButton, Select as ASelect } from 'ant-design-vue';

const props = defineProps<{ userId: string; sessionRevision: number; isAdmin?: boolean }>();
const emit = defineEmits<{ manual: [title: string]; added: [] }>();
const query = ref("");
const type = ref("");
const year = ref<number>();
const results = ref<TvdbCandidate[]>([]);
const preview = ref<TvdbPreview | null>(null);
const success = ref<{ movieId: string; alreadyInCollection: boolean } | null>(
  null
);
const busy = ref(false);
const searched = ref(false);
const error = ref("");
let revision = 0;
let controller: AbortController | undefined;
function cancel(): void {
  revision++;
  controller?.abort();
  busy.value = false;
}

watch(
  () => [props.userId, props.sessionRevision],
  () => {
    cancel();
    query.value = "";
    results.value = [];
    preview.value = null;
    success.value = null;
    error.value = "";
    searched.value = false;
  },
  { flush: 'sync' }
);
onBeforeUnmount(cancel);
async function run(
  action: (signal: AbortSignal) => Promise<void>
): Promise<void> {
  cancel();
  if (!props.userId) return;
  const requestRevision = revision;
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  try {
    await action(controller.signal);
  } catch (reason) {
    if (requestRevision === revision)
      error.value =
        getApiResponseMessage(reason) ||
        "Не удалось получить данные TheTVDB. Повторите попытку.";
  } finally {
    if (requestRevision === revision) busy.value = false;
  }
}

async function search(): Promise<void> {
  if (!query.value.trim()) return;
  if (!isOptionalInteger(year.value, MIN_MEDIA_YEAR, maxMediaYear())) {
    error.value = `Укажите год из 4 цифр, от ${MIN_MEDIA_YEAR} до ${maxMediaYear()}`;

    return;
  }

  await run(async (signal) => {
    const data = await searchTvdb(
      query.value.trim(),
      type.value,
      year.value || undefined,
      signal
    );
    if (signal.aborted) return;
    results.value = data;
    searched.value = true;
    success.value = null;
  });
}

async function select(candidate: TvdbCandidate): Promise<void> {
  if (candidate.inCollection && candidate.localMovieId) {
    success.value = {
      movieId: candidate.localMovieId,
      alreadyInCollection: true,
    };

    return;
  }

  await run(async (signal) => {
    const data = await previewTvdb(candidate, signal);
    if (!signal.aborted) preview.value = data;
  });
}

async function confirm(payload: Record<string, unknown>): Promise<void> {
  await run(async (signal) => {
    const result = await importTvdb(payload, signal);
    if (signal.aborted) return;
    success.value = result;
    preview.value = null;
    results.value = results.value.map((item) =>
      item.id === payload.id && item.type === payload.type
        ? { ...item, localMovieId: result.movieId, inCollection: true }
        : item
    );
    emit("added");
  });
}
</script>

<template>
  <section class="tvdb" :aria-busy="busy">
    <p class="tvdb-hint">
      Найдите произведение по русскому или английскому названию. Год помогает
      отличить версии и адаптации.
    </p>
    <div v-if="success" class="tvdb-success" role="status">
      <h2>
        {{
          success.alreadyInCollection
            ? "Уже в вашей коллекции"
            : "Добавлено в коллекцию"
        }}
      </h2>
      <div class="tvdb-success__actions">
        <RouterLink class="tvdb-success__open" :to="{ name: 'detail', params: { id: success.movieId } }">
          Открыть карточку
          <BaseIcon name="ph:arrow-right" :width="18" :height="18" aria-hidden="true" />
        </RouterLink>
        <button type="button" class="tvdb-link" @click="success = null">
          Добавить ещё
        </button>
      </div>
    </div>
    <TvdbImportForm
      v-else-if="preview"
      :key="`${preview.type}:${preview.id}`"
      :preview="preview"
      :is-admin="isAdmin"
      :busy="busy"
      @confirm="confirm"
      @back="
        preview = null;
        error = '';
      "
    />
    <template v-else>
      <form
        class="tvdb-search"
        aria-label="Поиск TheTVDB"
        @submit.prevent="search"
      >
        <label class="tvdb-field tvdb-search__query"
          >Название
          <input class="fv-native-field"
            v-model="query"
            aria-label="Название для поиска"
            placeholder="Например: Дюна или Dune"
            required
            maxlength="200"
            :disabled="busy"
          />
        </label>
        <div class="tvdb-field">
          <label for="tvdb-search-format">Формат</label>
          <ASelect id="tvdb-search-format" v-model:value="type" class="tvdb-search__format" aria-label="Формат" size="large" :disabled="busy" :options="[{ value: '', label: 'Все форматы' }, { value: 'movie', label: 'Фильмы' }, { value: 'series', label: 'Сериалы и выпуски' }]">
            <template #suffixIcon><BaseIcon name="ph:caret-down" :width="16" :height="16" /></template>
          </ASelect>
        </div>
        <div class="tvdb-field">
          <label for="tvdb-search-year">Год, необязательно</label>
          <NumberField
            id="tvdb-search-year"
            v-model="year"
            label="Год, необязательно"
            :controls="false"
            :min="MIN_MEDIA_YEAR"
            :max="maxMediaYear()"
            :min-digits="4"
            :max-digits="4"
            :disabled="busy"
          />
        </div>
        <AButton class="tvdb-search__submit" type="primary" html-type="submit" size="large" :loading="busy" :disabled="busy">
          {{ busy ? "Ищем…" : "Найти" }}
        </AButton>
      </form>
      <p v-if="searched && !results.length && !busy" role="status">
        Ничего не найдено. Попробуйте другое название или уберите год.
      </p>
      <ul class="tvdb-results">
        <li
          v-for="candidate in results"
          :key="`${candidate.type}:${candidate.id}`"
        >
          <MoviePoster
            :src="candidate.posterUrl"
            :title="
              candidate.title || candidate.titleEn || candidate.originalTitle
            "
            :seed="`${candidate.type}:${candidate.id}`"
          />
          <div>
            <h2>
              {{
                candidate.title || candidate.titleEn || candidate.originalTitle
              }}
            </h2>
            <p>{{ candidate.titleEn || candidate.originalTitle }}</p>
            <p>
              {{ candidate.year ?? "Год неизвестен" }} ·
              {{ candidate.type === "series" ? "Сериал / выпуски" : "Фильм" }}
            </p>
            <span v-if="candidate.localMovieId" class="tvdb-badge">{{
              candidate.inCollection ? "Уже в коллекции" : "Есть в FavouriteApp"
            }}</span>
          </div>
          <button
            type="button"
            data-tvdb-select
            :disabled="busy"
            @click="select(candidate)"
          >
            {{ candidate.inCollection ? "Открыть" : "Выбрать" }}
          </button>
        </li>
      </ul>
      <button
        type="button"
        class="tvdb-link"
        :disabled="busy"
        @click="emit('manual', query)"
      >
        Добавить вручную →
      </button>
    </template>
    <p v-if="error" class="tvdb-error" role="alert">{{ error }}</p>
    <p class="tvdb-attribution">
      Данные предоставлены
      <a href="https://thetvdb.com" target="_blank" rel="noopener noreferrer"
        >TheTVDB <BaseIcon name="ph:arrow-up-right" :width="14" :height="14" aria-hidden="true" /></a
      >.
    </p>
  </section>
</template>

<style lang="scss">
@use '@/styles/media' as *;
.tvdb {
  color: var(--fv-color-text-primary);
  .tvdb-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 24px;
    min-width: 0;
    color: var(--fv-color-text-secondary);
    font-size: 14px;
    font-weight: 500;
  }
  textarea {
    resize: vertical;
  }
  button,
  a,
  summary {
    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .tvdb-search__submit { height: 52px; margin-top: 28px; padding: 0 22px; border-radius: var(--fv-radius-sm); font-weight: 500; }
  .tvdb-search__format.ant-select-single.ant-select-lg .ant-select-selector { height: 52px; padding: 0 14px; font-size: 15px; }
  .tvdb-search__format.ant-select-single.ant-select-lg .ant-select-selection-item { line-height: 49px; }
  .tvdb-search__format .ant-select-arrow { color: var(--fv-color-text-secondary); }
  .tvdb-link {
    display: inline-block;
    color: var(--fv-color-accent);
    padding: 10px 0;
    border: 0;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
  .tvdb-hint,
  .tvdb-attribution {
    color: var(--fv-color-text-secondary);
    line-height: 1.6;
  }
  .tvdb-attribution {
    margin-top: 28px;
    font-size: 13px;
    a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: inherit;
      text-decoration: none;
      &:hover { color: var(--fv-color-accent); text-decoration: underline; text-underline-offset: 3px; }
    }
  }
  .tvdb-error {
    color: var(--fv-color-negative);
    line-height: 1.6;
  }
  .tvdb-search {
    display: grid;
    grid-template-columns: minmax(180px, 2fr) minmax(160px, 1fr) 155px auto;
    gap: 14px;
    align-items: start;
    margin-bottom: 28px;
  }
  .tvdb-search .tvdb-field {
    margin-bottom: 0;
    line-height: 20px;
  }
  .tvdb-results {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tvdb-results li {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    padding: 20px 0;
    border-top: 1px solid var(--fv-color-border);
  }
  .tvdb-results .movie-poster {
    height: 102px;
    border-radius: var(--fv-radius-sm);
  }
  .tvdb-results h2 {
    font-size: 18px;
    margin: 0 0 6px;
    overflow-wrap: anywhere;
  }
  .tvdb-results p {
    margin: 4px 0;
    color: var(--fv-color-text-secondary);
  }
  .tvdb-results button {
    padding: 10px 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .tvdb-badge {
    display: inline-block;
    padding: 4px 8px;
    margin-top: 6px;
    background: var(--fv-color-accent-soft);
    border-radius: 6px;
    font-size: 12px;
  }
  .tvdb-success {
    padding: 20px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
  }
  .tvdb-success__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 20px;
  }
  .tvdb-success__open {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    color: var(--fv-color-text-primary);
    font-weight: 500;
    text-decoration: none;
    &:hover { color: var(--fv-color-accent); }
  }
  @include mediaMax(850px) {
    .tvdb-search {
      grid-template-columns: 1fr 1fr;
    }
    .tvdb-search__query {
      grid-column: 1 / -1;
    }
    .tvdb-search__submit { margin-top: 0; }
  }
  @include mediaMax(420px) {
    .tvdb-search {
      grid-template-columns: 1fr;
    }
    .tvdb-results li {
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 12px;
    }
    .tvdb-results button {
      grid-column: 2;
      justify-self: start;
    }
  }
}
</style>
