<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Alert as AAlert, Spin as ASpin, message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ImagePicker from "@/components/ImagePicker/ImagePicker.vue";
import api from "@/services/api";
import { friendlyRequestError } from "@/utils/friendlyError";
import {
  Genre,
  GenreLabels,
} from "@/components/Genres/constants/genres.constants";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";
import type { MovieApiResponse } from "@/stores/movies/types";
import type { ImageSelection } from "@/services/media";
import { catalogPublishDate } from "./catalog-editor.utils";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ movieId: string | null }>();
const emit = defineEmits<{ saved: [] }>();
const title = ref("");
const description = ref("");
const genres = ref<Genre[]>([]);
const countries = ref<string[]>([]);
const actorIds = ref<string[]>([]);
const actors = ref<{ id: string; name: string }[]>([]);
const isSerial = ref(false);
const year = ref<number | null>(null);
const originalDate = ref<string | null>(null);
const expectedUpdatedAt = ref<string>();
const seasonCount = ref<number | null>(null);
const episodeCount = ref<number | null>(null);
const image = ref<ImageSelection | null>(null);
const saving = ref(false);
const dialogOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!saving.value) {
      open.value = value;
    }
  },
});
const loading = ref(false);
const uploading = ref(false);
const error = ref("");
let revision = 0;
let actorRevision = 0;
const genreOptions = Object.entries(GenreLabels).map(([value, label]) => ({
  value,
  label,
}));
const countryOptions = PRODUCTION_COUNTRIES.map(({ code, label }) => ({
  value: code,
  label,
}));
const valid = computed(
  () =>
    title.value.trim() &&
    description.value.trim() &&
    genres.value.length &&
    countries.value.length &&
    !loading.value &&
    !uploading.value
);

async function searchActors(q = ""): Promise<void> {
  const request = ++actorRevision;

  try {
    const { data } = await api.get<{ items: { id: string; name: string }[] }>(
      "/actors",
      { params: { q, limit: 50, offset: 0 } }
    );

    if (request === actorRevision) {
      actors.value = [
        ...new Map(
          [
            ...actors.value.filter((actor) =>
              actorIds.value.includes(actor.id)
            ),
            ...data.items,
          ].map((actor) => [actor.id, actor])
        ).values(),
      ];
    }
  } catch {
    message.error("Не удалось загрузить актёров");
  }
}

watch(open, async (visible) => {
  const request = ++revision;

  if (!visible) {
    return;
  }

  title.value = "";
  description.value = "";
  genres.value = [];
  countries.value = [];
  actorIds.value = [];
  actors.value = [];
  isSerial.value = false;
  year.value = null;
  originalDate.value = null;
  expectedUpdatedAt.value = undefined;
  seasonCount.value = null;
  episodeCount.value = null;
  image.value = null;
  error.value = "";
  loading.value = !!props.movieId;

  try {
    if (props.movieId) {
      const { data } = await api.get<MovieApiResponse>(
        `/movies/${props.movieId}`
      );

      if (request !== revision) {
        return;
      }

      title.value = data.title;
      originalDate.value = data.publishDate;
      expectedUpdatedAt.value = data.updatedAt;
      description.value = data.description;
      genres.value = data.genres;
      countries.value = data.countryCodes;
      actors.value = data.actors ?? [];
      actorIds.value = actors.value.map((actor) => actor.id);
      isSerial.value = data.isSerial;
      year.value = data.publishDate
        ? new Date(data.publishDate).getUTCFullYear()
        : null;
      seasonCount.value = data.seasonCount ?? null;
      episodeCount.value = data.episodeCount ?? null;
      image.value = data.poster?.url
        ? {
            url: data.poster.url,
            assetId: data.poster.assetId,
            thumbnailUrl: data.poster.thumbnailUrl,
          }
        : null;
    }

    void searchActors();
  } catch {
    error.value = "Не удалось открыть тайтл. Закройте окно и повторите.";
  } finally {
    if (request === revision) {
      loading.value = false;
    }
  }
});

async function save(): Promise<void> {
  if (!valid.value || saving.value || error.value) {
    return;
  }

  saving.value = true;
  const id = props.movieId;
  const payload = {
    title: title.value.trim(),
    description: description.value.trim(),
    genres: genres.value,
    countryCodes: countries.value,
    actorIds: actorIds.value,
    isSerial: isSerial.value,
    publishDate: catalogPublishDate(year.value, originalDate.value),
    ...(id ? { expectedUpdatedAt: expectedUpdatedAt.value } : {}),
    seasonCount: isSerial.value ? seasonCount.value ?? undefined : undefined,
    episodeCount: isSerial.value ? episodeCount.value ?? undefined : undefined,
    imageUrl: image.value?.assetId ? undefined : image.value?.url ?? undefined,
    posterAssetId: image.value?.assetId ?? null,
  };

  try {
    if (id) {
      await api.patch(`/movies/${id}`, payload);
    } else {
      await api.post("/movies", payload);
    }

    open.value = false;
    emit("saved");
    message.success(id ? "Тайтл обновлён" : "Тайтл добавлен в каталог");
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось сохранить тайтл" })
    );
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <BaseModal
    v-model="dialogOpen"
    layout="form"
    class="admin-dialog catalog-editor"
  >
    <template #title>{{
      movieId ? "Редактировать тайтл" : "Добавить тайтл"
    }}</template>
    <template #body>
      <a-spin :spinning="loading">
        <a-alert v-if="error" type="error" :message="error" />
        <a-form layout="vertical" :disabled="saving || loading">
          <a-form-item label="Название" required>
            <a-input v-model:value="title" :maxlength="200" />
          </a-form-item>
          <ImagePicker
            v-model="image"
            purpose="MOVIE_POSTER"
            label="Постер"
            :disabled="saving"
            @busy="uploading = $event"
          />
          <a-form-item label="Описание" required>
            <a-textarea
              v-model:value="description"
              :rows="4"
              :maxlength="500"
              show-count
            />
          </a-form-item>
          <a-form-item label="Жанры" required>
            <a-select
              v-model:value="genres"
              mode="multiple"
              :options="genreOptions"
            />
          </a-form-item>
          <a-form-item label="Страны" required>
            <a-select
              v-model:value="countries"
              mode="multiple"
              :options="countryOptions"
              option-filter-prop="label"
            />
          </a-form-item>
          <a-form-item label="Актёры">
            <a-select
              v-model:value="actorIds"
              mode="multiple"
              :filter-option="false"
              :options="
                actors.map((actor) => ({ value: actor.id, label: actor.name }))
              "
              @search="searchActors"
            />
          </a-form-item>
          <a-form-item label="Тип">
            <div class="catalog-type" role="group" aria-label="Тип тайтла">
              <button
                type="button"
                :aria-pressed="!isSerial"
                :disabled="saving || loading"
                @click="isSerial = false"
              >
                Фильм
              </button>
              <button
                type="button"
                :aria-pressed="isSerial"
                :disabled="saving || loading"
                @click="isSerial = true"
              >
                Сериал
              </button>
            </div>
          </a-form-item>
          <div
            class="catalog-editor__numbers"
            :class="{ 'catalog-editor__numbers--serial': isSerial }"
          >
            <a-form-item label="Год выхода">
              <a-input-number
                v-model:value="year"
                :min="1870"
                :max="2100"
                :precision="0"
              />
            </a-form-item>
            <a-form-item v-if="isSerial" label="Сезонов">
              <a-input-number
                v-model:value="seasonCount"
                :min="1"
                :max="1000"
                :precision="0"
              />
            </a-form-item>
            <a-form-item v-if="isSerial" label="Эпизодов">
              <a-input-number
                v-model:value="episodeCount"
                :min="1"
                :max="10000"
                :precision="0"
              />
            </a-form-item>
          </div>
          <p class="admin-muted">
            Изменяется общий каталог. Личные оценки и прогресс пользователей
            сохраняются.
          </p>
        </a-form>
      </a-spin>
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="open = false">Отмена</a-button>
      <a-button
        type="primary"
        :disabled="!valid || !!error"
        :loading="saving"
        @click="save"
        >{{ movieId ? "Сохранить" : "Добавить" }}</a-button
      >
    </template>
  </BaseModal>
</template>

<style lang="scss" scoped>
@use "../../styles/media" as *;

.catalog-editor__numbers {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;

  :deep(.ant-input-number) {
    width: 100%;
  }

  @include mediaTablet {
    &--serial {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}

.catalog-type {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 8px 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-weight: 500;
    cursor: pointer;

    &[aria-pressed="true"] {
      border-color: var(--fv-color-text-primary);
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}
</style>

<style lang="scss">
@use "../../styles/media" as *;

@include mediaTablet {
  .modal.catalog-editor.modal--form {
    width: min(680px, calc(100vw - 64px));
    max-width: 680px;
  }
}
</style>
