<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";

import { message, type FormInstance } from "ant-design-vue";
import { useMoviesStore } from "@/stores/movies/moviesStore";
import { useActorsStore } from "@/stores/actors/actorsStore";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import { showErrorRequest } from "@/state/utils";
import { Genre } from "@/components/Genres/constants/genres.constants";
import GenresList from "@/components/Genres/GenresList.vue";
import { Movie } from "@/stores";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const moviesStore = useMoviesStore();
const actorsStore = useActorsStore();

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
  date: string;
  publishDate: string;
  description: string;
  genre?: Genre;
  seeLater: boolean;
  isSerial: boolean;
  seasonCount?: number;
  episodeCount?: number;
  currentSeason?: number;
  currentEpisode?: number;
  imageUrl: string;
  rate: number;
  isFavorite: boolean;
  actorIds: string[];
}

const formData = reactive<CreateMovieForm>({
  title: "",
  date: "",
  publishDate: "",
  description: "",
  genre: Genre.ACTION,
  seeLater: false,
  isSerial: false,
  seasonCount: undefined,
  episodeCount: undefined,
  currentSeason: undefined,
  currentEpisode: undefined,
  imageUrl: "",
  rate: 0,
  isFavorite: false,
  actorIds: [],
});
const formRef = ref<FormInstance | null>(null);

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
      ...formData,
      genre: formData.genre ?? undefined,
      date: formData.date ? new Date(formData.date).toISOString() : null,
      publishDate: formData.publishDate
        ? new Date(formData.publishDate).toISOString()
        : null,
      actorIds: formData.actorIds,
      seasonCount: formData.seasonCount ?? undefined,
      episodeCount: formData.episodeCount ?? undefined,
      currentSeason: formData.currentSeason ?? undefined,
      currentEpisode: formData.currentEpisode ?? undefined,
    };

    await moviesStore.createMovie(moviePayload);

    formRef?.value?.resetFields();
    formData.actorIds = [];
    message.success(`${title} добавлен`);
  } catch (error) {
    showErrorRequest(error);
  }
};
</script>

<template>
  <div class="create-movie">
    <HeroHeader title="Добавить" badge-text="Создание" icon-name="mdi:create" />

    <div class="create-movie__content">
      <div class="form-card">
        <a-form
          ref="formRef"
          :model="formData"
          name="create-movie-form"
          @finish="addNewMovie"
          layout="vertical"
          class="form-card__form"
        >
          <div class="form-grid">
            <div class="form-grid__col">
              <a-form-item
                label="Название фильма/сериала"
                name="title"
                :rules="[
                  { required: true, message: 'Введите название фильма' },
                ]"
              >
                <a-input
                  v-model:value="formData.title"
                  size="large"
                  placeholder="Например: 'Интерстеллар'"
                />
              </a-form-item>

              <a-form-item
                label="Ссылка на постер"
                name="imageUrl"
                :rules="[
                  { required: true, message: 'Введите ссылку на постер' },
                ]"
              >
                <a-input
                  v-model:value="formData.imageUrl"
                  size="large"
                  placeholder="https://image.tmdb.org/t/p/w500/..."
                />
              </a-form-item>

              <!-- Actor Selection -->
              <a-form-item label="Актеры" name="actorIds">
                <a-select
                  v-model:value="formData.actorIds"
                  mode="tags"
                  placeholder="Выберите или введите актеров"
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
              </a-form-item>

              <a-form-item label="Дата просмотра" name="date">
                <a-date-picker
                  v-model:value="formData.date"
                  size="large"
                  style="width: 100%"
                  placeholder="Выберите дату"
                />
              </a-form-item>

              <a-form-item label="Дата выхода фильма" name="publishDate">
                <a-date-picker
                  v-model:value="formData.publishDate"
                  size="large"
                  picker="year"
                  style="width: 100%"
                  placeholder="Выберите дату выхода"
                />
              </a-form-item>
            </div>

            <div class="form-grid__col">
              <div class="form-preview">
                <div class="preview-poster">
                  <img
                    :src="
                      formData.imageUrl ||
                      'https://placehold.co/280x200?text=Постер'
                    "
                    alt="Предпросмотр постера"
                    class="preview-poster__img"
                  />
                  <div class="preview-poster__rating">
                    {{ formData.rate || "?" }}/10
                  </div>
                </div>

                <a-form-item
                  label="Ваш рейтинг"
                  name="rate"
                  class="rating-item"
                >
                  <a-rate
                    v-model:value="formData.rate"
                    :count="10"
                    class="preview-rating"
                  />
                </a-form-item>
              </div>
            </div>
          </div>

          <a-form-item label="Жанр" name="genre">
            <GenresList v-model="formData.genre" />
          </a-form-item>

          <a-form-item label="Смотреть позже?" name="seeLater">
            <a-switch v-model:checked="formData.seeLater" />
          </a-form-item>

          <a-form-item label="Сериал?" name="isSerial">
            <a-switch v-model:checked="formData.isSerial" />
          </a-form-item>

          <a-form-item
            v-if="formData.isSerial"
            label="Количество сезонов"
            name="seasonCount"
          >
            <a-input-number
              v-model:value="formData.seasonCount"
              :min="1"
              :precision="0"
              size="large"
              placeholder="Например: 5"
              style="width: 100%"
            />
          </a-form-item>

          <a-form-item
            v-if="formData.isSerial"
            label="Количество эпизодов"
            name="episodeCount"
          >
            <a-input-number
              v-model:value="formData.episodeCount"
              :min="1"
              :precision="0"
              size="large"
              placeholder="Например: 10"
              style="width: 100%"
            />
          </a-form-item>

          <a-form-item
            v-if="formData.isSerial && formData.seasonCount"
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
            v-if="formData.isSerial && formData.episodeCount"
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

          <a-form-item label="Описание" name="description">
            <a-textarea
              v-model:value="formData.description"
              class="form-grid__textarea"
              size="large"
              :rows="4"
              placeholder="Расскажите о своих впечатлениях от фильма..."
              :maxlength="500"
              :show-count="true"
            />
          </a-form-item>

          <a-form-item class="form-actions">
            <a-button size="large" class="form-actions__cancel">
              Отмена
            </a-button>
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              class="form-actions__submit"
            >
              <BaseIcon name="mdi:plus" class="btn-icon" />
              Добавить
            </a-button>
          </a-form-item>
        </a-form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.create-movie {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  color: var(--text-primary);
  padding: 0 0 4rem 0;
  display: flex;
  flex-direction: column;

  &__content {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  &__title {
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: 800;
    margin: 0 0 1rem 0;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
  }
}

.form-card {
  background: var(--bg-primary);
  border-radius: 24px;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
  overflow: hidden;
  padding: 2.5rem;
  margin: 2rem 0;

  @include mediaMobileXL {
    padding: 2rem;
    margin: 1.5rem 0;
  }

  @include mediaTablet {
    padding: 2.5rem;
    margin: 2rem 0;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 2rem;

  @include mediaTablet {
    grid-template-columns: minmax(280px, 350px) 280px;
    gap: 2.5rem;
  }

  @include mediaDesktopXS {
    gap: 3rem;
  }

  &__textarea {
    height: 70px;
  }
}

.form-grid__col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-preview {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;

  :deep(.ant-form-item-control) {
    align-items: flex-start;
  }
}

.preview-poster {
  position: relative;
  height: 200px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      transparent 60%,
      rgba(0, 0, 0, 0.7) 100%
    );
    z-index: 1;
  }
}

.preview-poster__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.preview-poster__rating {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--ant-color-primary);
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 0.875rem;
  z-index: 2;
}

.rating-item {
  :deep(.ant-form-item-label) {
    padding-bottom: 0.5rem;
  }
}

.preview-rating {
  :deep(.ant-rate) {
    font-size: 24px;
  }

  @include mediaMobile {
    :deep(.ant-rate) {
      font-size: 20px;
    }
  }
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  justify-content: flex-end;
  margin-top: 2rem;

  @include mediaMobile {
    flex-direction: column;
    gap: 1rem;
  }

  @include mediaMobileXL {
    flex-direction: row;
    gap: 1.25rem;
  }

  @include mediaTablet {
    gap: 1.5rem;
  }

  &__cancel + &__submit {
    margin-left: 16px;
  }

  &__cancel,
  &__submit {
    flex-shrink: 0;
    height: 48px;
    border-radius: 12px;
  }

  &__submit {
    min-width: 180px;
    max-width: 200px;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .btn-icon {
      margin-right: 8px;
    }
  }
}

.btn-icon {
  width: 20px;
  height: 20px;
}

:deep(.ant-form-item-label > label) {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.form-actions :deep(.ant-form-item-control-input-content) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.ant-input, .ant-picker, .ant-textarea) {
  border-radius: 12px;
  border: 2px solid var(--border-color);
  transition: all 0.2s ease;
  height: 48px;

  &:focus,
  &:hover {
    border-color: var(--ant-color-primary);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--ant-color-primary) 10%, transparent);
  }
}

:deep(.ant-form-item-has-error .ant-input) {
  border-color: var(--ant-color-error);
}

:deep(.ant-textarea) {
  height: auto;
  min-height: 120px;
  resize: vertical;
}

@include mediaMobile {
  .create-movie__content {
    padding: 0 1rem;
  }

  .form-card {
    border-radius: 16px;
    margin: 1rem 0;
  }
}
</style>
