<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";

import { message } from "ant-design-vue";
import { useMoviesStore } from "@/stores/movies/moviesStore";
import { useActorsStore } from "@/stores/actors/actorsStore";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import { showErrorRequest } from "@/state/utils";

const moviesStore = useMoviesStore();
const actorsStore = useActorsStore();

const handleActorSelection = async (selectedValues: string[]) => {
  const processedValues: string[] = [];

  for (const value of selectedValues) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      const newActor = await actorsStore.addActorByName(value);
      if (newActor) {
        processedValues.push(newActor.id);
      }
    } else {
      processedValues.push(value);
    }
  }

  formData.actorIds = processedValues;
};

export interface CreateMovie {
  title: string;
  date: string;
  publishDate: string;
  description?: string;
  imageUrl: string;
  rate: number;
  isFavorite: boolean;
  actorIds: string[];
}

let formData = reactive<CreateMovie>({
  title: "",
  date: "",
  publishDate: "",
  description: "",
  imageUrl: "",
  rate: 0,
  isFavorite: false,
  actorIds: [],
});
const formRef = ref(null);

onMounted(async () => {
  await actorsStore.fetchActors();
});

const addNewMovie = async () => {
  const { title } = formData;

  try {
    await moviesStore.createMovie({
      ...formData,
      date: formData.date ? new Date(formData.date) : null,
      publishDate: formData.publishDate ? new Date(formData.publishDate) : null,
      actorIds: formData.actorIds,
    });

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
                label="Название фильма"
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
                  style="width: 100%"
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

          <a-form-item label="Описание" name="description">
            <a-textarea
              v-model:value="formData.description"
              class="form-grid__textarea"
              size="large"
              :rows="4"
              placeholder="Расскажите о своих впечатлениях от фильма..."
              maxlength="500"
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
              Создать фильм
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
