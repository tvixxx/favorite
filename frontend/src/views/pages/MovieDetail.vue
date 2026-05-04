<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { message } from "ant-design-vue";

import { useMainStore } from "@/state/state";
import { useUserMoviesStore } from "@/stores";
import { formatDate, formatYear } from "@/utils";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";

import AppBackButton from "@/components/AppBackButton/AppBackButton.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MovieShareButton from "@/components/MovieShareButton/MovieShareButton.vue";
import HeroHeader from "@/components/HeroHeader/HeroHeader.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import type { UserMovie } from "@/stores";
import ReviewsWidget from "@/components/Reviews/ReviewsWidget.vue";

const mainStore = useMainStore();
const userMoviesStore = useUserMoviesStore();
const router = useRouter();
const route = useRoute();

const detailBackFallback = computed((): RouteLocationRaw => {
  const raw = route.query.libActor;
  const actorId =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0]
        : "";
  if (actorId) {
    return { path: `/library/actors/${actorId}` };
  }
  return { path: "/library/collection" };
});

const currentMovieId = router.currentRoute.value.params.id as string | null;
const userId = computed(() => mainStore.userData?.id || "");

const isLoading = ref(false);
const isError = ref(false);
const currentUserMovie = ref<UserMovie | null>(null);

onMounted(async () => {
  if (mainStore.isLoggedIn && userId.value && currentMovieId) {
    isLoading.value = true;
    isError.value = false;

    try {
      const userMovie = userMoviesStore.userMovies.find(
        (um) => um.movieId === currentMovieId
      );

      if (userMovie) {
        currentUserMovie.value = userMovie;
      } else {
        const loaded = await userMoviesStore.fetchUserMovieById(
          userId.value,
          currentMovieId
        );

        if (loaded) {
          currentUserMovie.value = loaded;
        } else {
          isError.value = true;
        }
      }
    } catch {
      message.error("Не удалось загрузить фильм");
      isError.value = true;
    } finally {
      isLoading.value = false;
    }
  }
});

onBeforeUnmount(() => {
  currentUserMovie.value = null;
});

const isEditingProgress = ref<boolean>(false);
const editSeason = ref<number | undefined>(undefined);
const editEpisode = ref<number | undefined>(undefined);

const movie = computed(() => currentUserMovie.value?.movie);
const posterSrc = computed(() => movie.value?.imageUrl || FALLBACK_IMAGE_URL);

const ratePercent = computed(() => ((currentUserMovie.value?.personalRate ?? 0) / 10) * 100);

const hasActors = computed(
  () => movie.value?.actors && movie.value.actors.length > 0
);

const toggleFavorite = async () => {
  if (!currentUserMovie.value) return;

  try {
    const newValue = !currentUserMovie.value.isFavorite;
    await userMoviesStore.updateUserMovie(userId.value, currentUserMovie.value.movieId, {
      isFavorite: newValue,
    });
    currentUserMovie.value = { ...currentUserMovie.value, isFavorite: newValue };
    message.success(
      newValue
        ? `"${movie.value?.title}" добавлен в избранное`
        : `"${movie.value?.title}" убран из избранного`
    );
  } catch {
    message.error("Не удалось обновить избранное");
  }
};

const toggleSeeLater = async () => {
  if (!currentUserMovie.value) return;

  const newValue = !currentUserMovie.value.seeLater;

  try {
    await userMoviesStore.updateUserMovie(userId.value, currentUserMovie.value.movieId, {
      seeLater: newValue,
    });
    currentUserMovie.value = { ...currentUserMovie.value, seeLater: newValue };

    message.success(
      newValue
        ? `${movie.value?.title} добавлен в «Смотреть позже»`
        : `${movie.value?.title} убран из «Смотреть позже»`
    );
  } catch {
    message.error("Не удалось обновить статус");
  }
};

const seasonProgress = computed(() => {
  if (!movie.value?.seasonCount || !currentUserMovie.value?.currentSeason) return 0;
  return Math.round(
    (currentUserMovie.value.currentSeason / movie.value.seasonCount) * 100
  );
});

const episodeProgress = computed(() => {
  if (!movie.value?.episodeCount || !currentUserMovie.value?.currentEpisode) return 0;
  return Math.round(
    (currentUserMovie.value.currentEpisode / movie.value.episodeCount) * 100
  );
});

const hasSerialProgress = computed(() => {
  return (
    movie.value?.isSerial &&
    (movie.value.seasonCount || movie.value.episodeCount)
  );
});

const isSerialCompleted = computed(() => {
  if (!movie.value?.isSerial || !currentUserMovie.value) return false;

  const m = movie.value;
  const um = currentUserMovie.value;
  const seasonsComplete = !!(
    m.seasonCount &&
    um.currentSeason &&
    um.currentSeason >= m.seasonCount
  );
  const episodesComplete = !!(
    m.episodeCount &&
    um.currentEpisode &&
    um.currentEpisode >= m.episodeCount
  );

  return seasonsComplete && episodesComplete;
});

const startEditProgress = () => {
  editSeason.value = currentUserMovie.value?.currentSeason;
  editEpisode.value = currentUserMovie.value?.currentEpisode;
  isEditingProgress.value = true;
};

const cancelEditProgress = () => {
  isEditingProgress.value = false;
};

const saveProgress = async () => {
  if (!currentUserMovie.value) return;

  try {
    await userMoviesStore.updateUserMovie(userId.value, currentUserMovie.value.movieId, {
      currentSeason: editSeason.value,
      currentEpisode: editEpisode.value,
    });

    currentUserMovie.value = {
      ...currentUserMovie.value,
      currentSeason: editSeason.value ?? null,
      currentEpisode: editEpisode.value ?? null,
    };

    isEditingProgress.value = false;
    message.success("Прогресс обновлён");
  } catch {
    message.error("Не удалось обновить прогресс");
  }
};
</script>

<template>
  <div class="movie-detail">
    <HeroHeader
      :title="movie?.title ?? 'Детали фильма'"
      subtitle="Подробная информация о фильме"
      badge-text="Фильм"
      icon-name="mdi:filmstrip"
    />

    <div class="movie-detail__content">
      <AppBackButton :fallback="detailBackFallback" />

      <ListError
        v-if="isError"
        :is-error="isError"
        :repeat-fn="() => router.go(0)"
        repeat-text="Повторить"
      />

      <ListLoading
        v-else-if="isLoading"
        :center="true"
        loading-text="Загружаем фильм..."
        size="large"
      />

      <template v-else-if="currentUserMovie && movie">
        <div class="detail-card">
          <div class="detail-card__poster">
            <img
              :src="posterSrc"
              :alt="`${movie.title} постер`"
              class="detail-card__poster-img"
            />
          </div>

          <div class="detail-card__info">
            <div class="detail-card__header">
              <h1 class="detail-card__title">{{ movie.title }}</h1>
              <button
                class="detail-card__favorite"
                :class="{ 'detail-card__favorite_active': currentUserMovie.isFavorite }"
                @click="toggleFavorite"
              >
                <BaseIcon
                  :name="currentUserMovie.isFavorite ? 'mdi:heart' : 'mdi:heart-outline'"
                  :width="24"
                  :height="24"
                />
              </button>
            </div>

            <div class="detail-card__tags">
              <span
                v-for="g in movie.genres ?? []"
                :key="g"
                class="detail-card__tag"
              >
                {{ GenreLabels[g] ?? g }}
              </span>
              <span v-if="movie.publishDate" class="detail-card__tag">
                {{ formatYear(movie.publishDate) }}
              </span>
              <span v-if="!movie.isSerial" class="detail-card__tag">
                Фильм
              </span>
              <span
                v-if="movie.isSerial"
                class="detail-card__tag detail-card__tag_accent"
              >
                Сериал
              </span>
              <span
                v-if="currentUserMovie.seeLater"
                class="detail-card__tag detail-card__tag_warning"
              >
                <BaseIcon name="mdi:clock-outline" :width="14" :height="14" />
                Смотреть позже
              </span>
            </div>

            <div class="detail-card__rating">
              <div class="detail-card__rating-score">
                <span class="detail-card__rating-value">
                  {{ currentUserMovie.personalRate || 0 }}
                </span>
                <span class="detail-card__rating-max">/10</span>
              </div>
              <div class="detail-card__rating-bar">
                <div
                  class="detail-card__rating-fill"
                  :style="{ width: `${ratePercent}%` }"
                />
              </div>
            </div>

            <div class="detail-card__meta">
              <div v-if="currentUserMovie.addedAt" class="detail-card__meta-item">
                <BaseIcon name="mdi:eye" :width="18" :height="18" />
                <span class="detail-card__meta-label">Дата добавления</span>
                <span class="detail-card__meta-value">
                  {{ formatDate(currentUserMovie.addedAt) }}
                </span>
              </div>

              <div v-if="movie.publishDate" class="detail-card__meta-item">
                <BaseIcon name="mdi:calendar" :width="18" :height="18" />
                <span class="detail-card__meta-label">Дата выхода</span>
                <span class="detail-card__meta-value">
                  {{ formatYear(movie.publishDate) }}
                </span>
              </div>

              <div
                v-if="movie.countryCodes?.length"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:earth" :width="18" :height="18" />
                <span class="detail-card__meta-label">Страны производства</span>
                <span class="detail-card__meta-value">
                  {{ countriesLabelsRu(movie.countryCodes) }}
                </span>
              </div>

              <div
                v-if="movie.isSerial && movie.seasonCount"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:television" :width="18" :height="18" />
                <span class="detail-card__meta-label">Сезонов</span>
                <span class="detail-card__meta-value">
                  {{ movie.seasonCount }}
                </span>
              </div>

              <div
                v-if="movie.isSerial && movie.episodeCount"
                class="detail-card__meta-item"
              >
                <BaseIcon name="mdi:playlist-play" :width="18" :height="18" />
                <span class="detail-card__meta-label">Эпизодов</span>
                <span class="detail-card__meta-value">
                  {{ movie.episodeCount }}
                </span>
              </div>

              <div
                class="detail-card__meta-item detail-card__meta-item_interactive"
                @click.stop
              >
                <BaseIcon name="mdi:clock-outline" :width="18" :height="18" />
                <span class="detail-card__meta-label">Смотреть позже</span>
                <a-switch
                  :checked="currentUserMovie.seeLater"
                  size="small"
                  class="detail-card__meta-switch"
                  @change="toggleSeeLater"
                />
              </div>

              <div
                v-if="currentMovieId && movie"
                class="detail-card__meta-item detail-card__meta-item_interactive detail-card__meta-item_share"
                @click.stop
              >
                <MovieShareButton
                  :movie-id="currentMovieId"
                  :movie-title="movie.title"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-if="movie.description" class="detail-section">
          <h2 class="detail-section__title">
            <BaseIcon name="mdi:text" :width="22" :height="22" />
            Описание
          </h2>
          <p class="detail-section__text">{{ movie.description }}</p>
        </div>

        <div v-if="hasActors" class="detail-section">
          <h2 class="detail-section__title">
            <BaseIcon name="mdi:account-group" :width="22" :height="22" />
            Актёры
          </h2>
          <div class="actors-list">
            <div
              v-for="actor in movie.actors"
              :key="actor.id"
              class="actors-list__item"
            >
              <div class="actors-list__avatar">
                <BaseIcon name="mdi:account" :width="20" :height="20" />
              </div>
              <span class="actors-list__name">{{ actor.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="hasSerialProgress" class="detail-section">
          <div class="detail-section__header">
            <h2 class="detail-section__title">
              <BaseIcon name="mdi:progress-clock" :width="22" :height="22" />
              Прогресс просмотра
            </h2>
            <a-button
              v-if="!isEditingProgress"
              type="text"
              size="small"
              class="detail-section__edit-btn"
              @click="startEditProgress"
            >
              <BaseIcon name="mdi:pencil" :width="16" :height="16" />
              <span>Изменить</span>
            </a-button>
          </div>

          <div v-if="isSerialCompleted" class="serial-progress__completed">
            <BaseIcon name="mdi:check-circle" :width="20" :height="20" />
            <span>Сериал просмотрен полностью!</span>
          </div>

          <div v-if="!isEditingProgress" class="serial-progress">
            <div v-if="movie.seasonCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Сезоны</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentSeason ?? 0 }} / {{ movie.seasonCount }}
                </span>
              </div>
              <a-progress
                :percent="seasonProgress"
                :show-info="false"
                :class="{
                  'serial-progress__bar_complete': seasonProgress === 100,
                }"
                size="small"
              />
            </div>

            <div v-if="movie.episodeCount" class="serial-progress__item">
              <div class="serial-progress__label">
                <span class="serial-progress__label-text">Эпизоды</span>
                <span class="serial-progress__label-value">
                  {{ currentUserMovie.currentEpisode ?? 0 }} / {{ movie.episodeCount }}
                </span>
              </div>
              <a-progress
                :percent="episodeProgress"
                :show-info="false"
                :class="{
                  'serial-progress__bar_complete': episodeProgress === 100,
                }"
                size="small"
              />
            </div>
          </div>

          <div v-else class="serial-progress serial-progress_editing">
            <div v-if="movie.seasonCount" class="serial-progress__edit-item">
              <label class="serial-progress__edit-label">
                На каком сезоне
              </label>
              <a-input-number
                v-model:value="editSeason"
                :min="0"
                :max="movie.seasonCount"
                :precision="0"
                size="large"
                style="width: 100%"
              />
            </div>

            <div v-if="movie.episodeCount" class="serial-progress__edit-item">
              <label class="serial-progress__edit-label">
                На какой серии
              </label>
              <a-input-number
                v-model:value="editEpisode"
                :min="0"
                :max="movie.episodeCount"
                :precision="0"
                size="large"
                style="width: 100%"
              />
            </div>

            <div class="serial-progress__edit-actions">
              <a-button @click="cancelEditProgress"> Отмена </a-button>
              <a-button type="primary" @click="saveProgress">
                <BaseIcon name="mdi:check" :width="16" :height="16" />
                Сохранить
              </a-button>
            </div>
          </div>
        </div>

        <div
          v-if="currentMovieId"
          class="movie-detail__review-widget review-widget"
        >
          <ReviewsWidget :movie-id="currentMovieId" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;
@use "@/styles/layout" as *;

.movie-detail {
  @include pageShell(4rem);

  &__content {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 1rem;
  }

}

.detail-card {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: var(--shadow), 0 20px 40px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);

  @include mediaTablet {
    flex-direction: row;
  }

  &__poster {
    flex-shrink: 0;
    width: 100%;
    height: 360px;
    background: var(--bg-secondary);
    overflow: hidden;

    @include mediaTablet {
      width: 300px;
      height: auto;
      min-height: 450px;
    }

    @include mediaDesktopXS {
      width: 340px;
    }
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  &__info {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;

    @include mediaTablet {
      padding: 2rem;
      gap: 1.5rem;
    }
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  &__title {
    font-size: clamp(1.5rem, 4vw, 2.25rem);
    font-weight: 800;
    margin: 0;
    line-height: 1.2;
    background: linear-gradient(
      135deg,
      var(--ant-color-primary),
      var(--text-primary)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__favorite {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.25s ease;

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
      transform: scale(1.1);
    }

    &_active {
      border-color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
      color: var(--ant-color-primary);
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__tag {
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);

    &_accent {
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
      color: var(--ant-color-primary);
      border-color: color-mix(
        in srgb,
        var(--ant-color-primary) 30%,
        transparent
      );
    }
  }

  &__rating {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__rating-score {
    display: flex;
    align-items: baseline;
    gap: 2px;
    flex-shrink: 0;
  }

  &__rating-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--ant-color-primary);
    line-height: 1;
  }

  &__rating-max {
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__rating-bar {
    flex: 1;
    height: 8px;
    background: var(--bg-secondary);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  &__rating-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--ant-color-primary),
      color-mix(in srgb, var(--ant-color-primary) 60%, var(--bg-secondary))
    );
    border-radius: 4px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 1rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);
  }

  &__meta-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--text-secondary);

    svg {
      flex-shrink: 0;
      color: var(--ant-color-primary);
    }

    &_interactive {
      padding: 6px 0;
      border-radius: 8px;
      transition: background 0.2s ease;
    }
  }

  &__meta-switch {
    margin-left: auto;
  }

  &__meta-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__meta-value {
    font-weight: 600;
    color: var(--text-primary);
    margin-left: auto;
  }

  &__tag_warning {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: color-mix(
      in srgb,
      var(--color-warning, #faad14) 10%,
      var(--bg-primary)
    );
    color: var(--color-warning, #faad14);
    border-color: color-mix(
      in srgb,
      var(--color-warning, #faad14) 30%,
      transparent
    );
  }
}

.detail-section {
  margin-top: 1.5rem;
  background: var(--bg-primary);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;

    .detail-section__title {
      margin-bottom: 0;
    }
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1rem 0;

    svg {
      color: var(--ant-color-primary);
    }
  }

  &__text {
    font-size: 1.05rem;
    line-height: 1.8;
    color: var(--text-secondary);
    margin: 0;
    white-space: pre-line;
  }

  &__edit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
}

.detail-section + .movie-detail__review-widget {
  margin-top: 1.5rem;
}

.actors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 50px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--ant-color-primary);
      box-shadow: 0 2px 8px
        color-mix(in srgb, var(--ant-color-primary) 15%, transparent);
    }
  }

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 15%,
      var(--bg-primary)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ant-color-primary);
  }

  &__name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }
}

.serial-progress {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__completed {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-success) 10%, var(--bg-primary));
    border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
    color: var(--color-success);
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__label-value {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 10%,
      var(--bg-primary)
    );
    padding: 2px 10px;
    border-radius: 12px;
  }

  &__bar_complete {
    :deep(.ant-progress-bg) {
      background-color: var(--color-success) !important;
    }
  }

  &_editing {
    gap: 1rem;
  }

  &__edit-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__edit-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);

    :deep(.ant-btn-primary) {
      display: flex;
      align-items: center;
    }
  }
}
</style>
