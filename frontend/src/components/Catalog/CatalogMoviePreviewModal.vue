<script setup lang="ts">
import { computed, watch } from "vue";
import axios from "axios";
import { message } from "ant-design-vue";

import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { formatAverageRating, formatYear } from "@/utils";
import { useMainStore } from "@/state/state";
import { useMoviesStore, useUserMoviesStore } from "@/stores";
import type { Movie } from "@/stores/movies/types";

const modelValue = defineModel<boolean>({ required: true });

const props = defineProps<{
  movieId: string | null;
}>();

const mainStore = useMainStore();
const moviesStore = useMoviesStore();
const userMoviesStore = useUserMoviesStore();

const userId = computed(() => mainStore.userData?.id ?? "");
const movie = computed(() => moviesStore.currentMovie as Movie | null);
const posterSrc = computed(() => movie.value?.imageUrl || FALLBACK_IMAGE_URL);
const avgLabel = computed(() =>
  formatAverageRating(movie.value?.averageRating)
);

const previewReviews = computed(() => {
  const list = movie.value?.reviews ?? [];

  return [...list]
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return tb - ta;
    })
    .slice(0, 10);
});

const hasActors = computed(() => !!movie.value?.actors?.length);

watch(
  () => [modelValue.value, props.movieId] as const,
  async ([open, id]) => {
    if (!open || !id) {
      return;
    }

    moviesStore.setCurrentMovie(null);

    try {
      await moviesStore.getMovieDetail(id);
    } catch {
      message.error("Не удалось загрузить карточку");
    }
  },
  { immediate: true }
);

watch(modelValue, (open) => {
  if (!open) {
    moviesStore.setCurrentMovie(null);
  }
});

async function addToCollection() {
  const mid = props.movieId;

  if (!mid || !userId.value) {
    return;
  }

  try {
    await userMoviesStore.addUserMovie(userId.value, mid, {});
    message.success(
      movie.value?.title
        ? `«${movie.value.title}» в вашей коллекции`
        : "Добавлено в коллекцию"
    );
    modelValue.value = false;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      message.warning("Этот фильм уже есть в вашей коллекции");

      return;
    }

    message.error("Не удалось добавить в коллекцию");
  }
}
</script>

<template>
  <BaseModal v-model="modelValue" layout="detail">
    <template #title>
      {{ movie?.title ?? "Фильм" }}
    </template>

    <template #body>
      <ListError
        v-if="moviesStore.isMovieError"
        :is-error="!!moviesStore.isMovieError"
        :repeat-fn="() => movieId && moviesStore.getMovieDetail(movieId)"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="moviesStore.isMovieLoading"
        :center="true"
        loading-text="Загружаем…"
        size="large"
      />

      <div v-else-if="movie" class="catalog-preview">
        <div class="catalog-preview__hero">
          <div class="catalog-preview__poster">
            <img
              :src="posterSrc"
              :alt="`${movie.title} постер`"
              class="catalog-preview__poster-img"
              loading="lazy"
            />
          </div>

          <div class="catalog-preview__main">
            <h2 class="catalog-preview__title">{{ movie.title }}</h2>

            <div class="catalog-preview__tags">
              <span
                v-for="g in movie.genres ?? []"
                :key="g"
                class="catalog-preview__tag"
              >
                {{ GenreLabels[g] ?? g }}
              </span>
              <span v-if="movie.publishDate" class="catalog-preview__tag">
                {{ formatYear(movie.publishDate) }}
              </span>
              <span v-if="!movie.isSerial" class="catalog-preview__tag">
                Фильм
              </span>
              <span
                v-else
                class="catalog-preview__tag catalog-preview__tag_accent"
              >
                Сериал
              </span>
            </div>

            <div
              v-if="avgLabel"
              class="catalog-preview__rating-wrap"
              aria-label="Средний балл по отзывам"
            >
              <div class="catalog-preview__rating-badge">
                <span class="catalog-preview__rating-num">{{ avgLabel }}</span>
                <span class="catalog-preview__rating-denom">/10</span>
                <span class="catalog-preview__rating-note">по отзывам</span>
              </div>
            </div>
            <p v-else class="catalog-preview__rating-empty">
              Нет оценок по отзывам
            </p>

            <div class="catalog-preview__meta">
              <div v-if="movie.publishDate" class="catalog-preview__meta-line">
                <BaseIcon
                  class="catalog-preview__meta-icon"
                  name="mdi:calendar-blank-outline"
                  :width="14"
                  :height="14"
                />
                <p class="catalog-preview__meta-inline">
                  <span class="catalog-preview__meta-k">Дата выхода</span>
                  <span class="catalog-preview__meta-sep"> — </span>
                  <span class="catalog-preview__meta-v">{{
                    formatYear(movie.publishDate)
                  }}</span>
                </p>
              </div>

              <div
                v-if="movie.countryCodes?.length"
                class="catalog-preview__meta-line"
              >
                <BaseIcon
                  class="catalog-preview__meta-icon"
                  name="mdi:earth"
                  :width="14"
                  :height="14"
                />
                <p class="catalog-preview__meta-inline">
                  <span class="catalog-preview__meta-k">Страны</span>
                  <span class="catalog-preview__meta-sep"> — </span>
                  <span class="catalog-preview__meta-v">{{
                    countriesLabelsRu(movie.countryCodes)
                  }}</span>
                </p>
              </div>

              <div
                v-if="movie.isSerial && movie.seasonCount"
                class="catalog-preview__meta-line"
              >
                <BaseIcon
                  class="catalog-preview__meta-icon"
                  name="mdi:television"
                  :width="14"
                  :height="14"
                />
                <p class="catalog-preview__meta-inline">
                  <span class="catalog-preview__meta-k">Сезонов</span>
                  <span class="catalog-preview__meta-sep"> — </span>
                  <span class="catalog-preview__meta-v">{{
                    movie.seasonCount
                  }}</span>
                </p>
              </div>

              <div
                v-if="movie.isSerial && movie.episodeCount"
                class="catalog-preview__meta-line"
              >
                <BaseIcon
                  class="catalog-preview__meta-icon"
                  name="mdi:playlist-play"
                  :width="14"
                  :height="14"
                />
                <p class="catalog-preview__meta-inline">
                  <span class="catalog-preview__meta-k">Эпизодов</span>
                  <span class="catalog-preview__meta-sep"> — </span>
                  <span class="catalog-preview__meta-v">{{
                    movie.episodeCount
                  }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="movie.description?.trim()" class="catalog-preview__section">
          <h3 class="catalog-preview__section-title">
            <BaseIcon name="mdi:text" :width="20" :height="20" />
            Описание
          </h3>
          <p class="catalog-preview__desc">{{ movie.description }}</p>
        </div>

        <div v-if="hasActors" class="catalog-preview__section">
          <h3 class="catalog-preview__section-title">
            <BaseIcon name="mdi:account-group" :width="20" :height="20" />
            Актёры
          </h3>
          <div class="catalog-preview__actors">
            <div
              v-for="actor in movie.actors"
              :key="actor.id"
              class="catalog-preview__actor"
            >
              <div class="catalog-preview__actor-avatar">
                <BaseIcon name="mdi:account" :width="18" :height="18" />
              </div>
              <span>{{ actor.name }}</span>
            </div>
          </div>
        </div>

        <div class="catalog-preview__section">
          <h3 class="catalog-preview__section-title">
            <BaseIcon
              name="mdi:comment-text-outline"
              :width="20"
              :height="20"
            />
            Отзывы
            <span
              v-if="movie._count?.reviews != null"
              class="catalog-preview__count"
            >
              {{ movie._count.reviews }}
            </span>
          </h3>

          <div v-if="previewReviews.length" class="catalog-preview__reviews">
            <article
              v-for="rev in previewReviews"
              :key="rev.id"
              class="catalog-preview__review"
            >
              <div class="catalog-preview__review-head">
                <span class="catalog-preview__review-rate"
                  >{{ rev.rate }}/10</span
                >
              </div>
              <p class="catalog-preview__review-text">{{ rev.text }}</p>
            </article>
          </div>

          <div v-else class="catalog-preview__empty">
            <BaseIcon
              name="mdi:comment-remove-outline"
              :width="40"
              :height="40"
            />
            <p>Отзывов пока нет.</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <a-button type="primary" size="large" @click="addToCollection">
        <BaseIcon name="mdi:library-plus" :width="18" :height="18" />
        Добавить в мою коллекцию
      </a-button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.catalog-preview {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.catalog-preview__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow);
  overflow: hidden;

  @include mediaTablet {
    flex-direction: row;
    align-items: stretch;
  }
}

.catalog-preview__poster {
  width: 100%;
  min-height: 220px;
  max-height: 320px;
  background: var(--bg-secondary);

  @include mediaTablet {
    width: 220px;
    min-height: 100%;
    max-height: none;
    flex-shrink: 0;
  }

  @include mediaDesktopXS {
    width: 260px;
  }
}

.catalog-preview__poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}

.catalog-preview__main {
  flex: 1;
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.62rem;
}

.catalog-preview__title {
  margin: 0;
  font-size: clamp(1.2rem, 3vw, 1.5rem);
  font-weight: 700;
  color: color-mix(in srgb, var(--ant-color-primary) 88%, var(--text-primary));
  line-height: 1.28;
  letter-spacing: -0.015em;
}

.catalog-preview__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.catalog-preview__tag {
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: color-mix(in srgb, var(--bg-secondary) 92%, var(--bg-primary));
  color: color-mix(in srgb, var(--text-secondary) 92%, var(--text-primary));
  border: 1px solid color-mix(in srgb, var(--border-color) 85%, transparent);

  &_accent {
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 8%,
      var(--bg-secondary)
    );
    color: color-mix(
      in srgb,
      var(--ant-color-primary) 82%,
      var(--text-primary)
    );
    border-color: color-mix(
      in srgb,
      var(--ant-color-primary) 22%,
      var(--border-color)
    );
  }
}

.catalog-preview__rating-wrap {
  margin: 0.1rem 0 0;
}

.catalog-preview__rating-badge {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.15rem 0.35rem;
  padding: 0.28rem 0.65rem 0.32rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
  box-shadow: none;
}

.catalog-preview__rating-num {
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.catalog-preview__rating-denom {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.catalog-preview__rating-note {
  font-size: 0.6875rem;
  font-weight: 500;
  color: color-mix(in srgb, var(--text-secondary) 92%, transparent);
  letter-spacing: 0.02em;
}

.catalog-preview__rating-empty {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 400;
  color: color-mix(in srgb, var(--text-secondary) 96%, transparent);
}

.catalog-preview__meta {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  margin-top: 0.15rem;
  padding-top: 0.35rem;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 65%, transparent);
}

.catalog-preview__meta-line {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.catalog-preview__meta-icon {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0.2rem;
  opacity: 0.38;
  color: var(--text-secondary);
}

.catalog-preview__meta-inline {
  margin: 0;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.38;
}

.catalog-preview__meta-k {
  color: color-mix(in srgb, var(--text-secondary) 94%, transparent);
  font-weight: 500;
}

.catalog-preview__meta-sep {
  font-weight: 400;
  color: color-mix(in srgb, var(--text-secondary) 45%, transparent);
}

.catalog-preview__meta-v {
  font-weight: 500;
  color: color-mix(in srgb, var(--text-primary) 92%, var(--text-secondary));
}

.catalog-preview__section {
  padding: 1rem 1.1rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-secondary) 55%, var(--bg-primary));
  border: 1px solid var(--border-color);
}

.catalog-preview__section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.65rem;
  font-size: 0.98rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--text-primary) 94%, var(--text-secondary));

  svg {
    flex-shrink: 0;
    opacity: 0.5;
    color: var(--text-secondary);
  }
}

.catalog-preview__count {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.catalog-preview__desc {
  margin: 0;
  line-height: 1.55;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.catalog-preview__actors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.catalog-preview__actor {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  font-size: 0.9rem;
  font-weight: 500;
}

.catalog-preview__actor-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.catalog-preview__reviews {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.catalog-preview__review {
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.catalog-preview__review-head {
  margin-bottom: 0.35rem;
}

.catalog-preview__review-rate {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ant-color-primary);
}

.catalog-preview__review-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--text-primary);
}

.catalog-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.25rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.95rem;

  svg {
    opacity: 0.45;
  }
}
</style>
