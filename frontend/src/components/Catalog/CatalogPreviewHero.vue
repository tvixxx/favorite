<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { countriesLabelsRu } from "@/constants/countries/production-countries";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import { formatAverageRating, formatYear } from "@/utils";
import type { Movie } from "@/stores/movies/types";

const props = defineProps<{ movie: Movie | null; loading?: boolean }>();
const posterSrc = computed(() => props.movie?.imageUrl || FALLBACK_IMAGE_URL);
const avgLabel = computed(() =>
  formatAverageRating(props.movie?.averageRating)
);
</script>

<template>
  <div class="catalog-preview__hero" :aria-busy="loading">
    <div class="catalog-preview__poster">
      <MoviePoster
        v-if="movie"
        :src="posterSrc"
        :seed="movie.id"
        :title="movie.title"
        :alt="`${movie.title} постер`"
        class="catalog-preview__poster-img"
        loading="lazy"
      />
      <SkeletonBar v-else width="100%" height="100%" radius="0" />
    </div>

    <div class="catalog-preview__main">
      <template v-if="movie">
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
          <span v-else class="catalog-preview__tag catalog-preview__tag_accent">
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
              name="ph:calendar-blank"
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
              name="ph:globe"
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
              name="ph:monitor"
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
              name="ph:playlist"
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
      </template>
      <template v-else>
        <div class="catalog-preview__title">
          <SkeletonBar width="85%" height="1.25em" radius="6px" />
        </div>
        <div class="catalog-preview__tags">
          <SkeletonBar
            v-for="width in ['62px', '76px', '52px']"
            :key="width"
            :width="width"
            height="28px"
            radius="999px"
          />
        </div>
        <div class="catalog-preview__rating-empty">
          <SkeletonBar width="65%" height="1.4em" radius="6px" />
        </div>
        <div class="catalog-preview__meta">
          <div
            v-for="index in 4"
            :key="index"
            class="catalog-preview__meta-line"
          >
            <SkeletonBar width="14px" height="14px" radius="3px" /><SkeletonBar
              width="65%"
              height="18px"
              radius="5px"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.catalog-preview__hero {
  display: grid;
  grid-template-columns: 170px 1fr;
  background: var(--fv-color-bg-primary);
  border-radius: 18px;
  box-shadow: var(--fv-shadow-low);
  overflow: hidden;

  // Эталон: ≤900px hero в одну колонку, постер сверху пропорцией 16/9
  @include mediaMax(900px) {
    grid-template-columns: 1fr;
  }
}

.catalog-preview__poster {
  aspect-ratio: 2 / 3;
  overflow: hidden;
  background: var(--fv-color-bg-secondary);

  @include mediaMax(900px) {
    aspect-ratio: 16 / 9;
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
  min-width: 0;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;

  @include mediaMax(900px) {
    padding: 14px 16px;
  }
}

.catalog-preview__title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.25;
  color: var(--fv-color-link);

  @include mediaMax(900px) {
    font-size: 20px;
  }
}

.catalog-preview__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.catalog-preview__tag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);

  &_accent {
    background: var(--fv-color-bg-active-soft);
    color: var(--fv-color-link);
    font-weight: 500;
  }
}

.catalog-preview__rating-wrap {
  margin: 0.1rem 0 0;
}

.catalog-preview__rating-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--fv-color-bg-secondary);
}

.catalog-preview__rating-num {
  font-size: 1.0625rem;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--fv-color-text-primary);
}

.catalog-preview__rating-denom {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--fv-color-text-secondary);
}

.catalog-preview__rating-note {
  font-size: 0.6875rem;
  font-weight: 500;
  color: color-mix(in srgb, var(--fv-color-text-secondary) 92%, transparent);
  letter-spacing: 0.02em;
}

.catalog-preview__rating-empty {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 400;
  color: color-mix(in srgb, var(--fv-color-text-secondary) 96%, transparent);
}

.catalog-preview__meta {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--fv-color-border);
  font-size: 13px;
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
  color: var(--fv-color-text-secondary);
}

.catalog-preview__meta-inline {
  margin: 0;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.38;
}

.catalog-preview__meta-k {
  color: color-mix(in srgb, var(--fv-color-text-secondary) 94%, transparent);
  font-weight: 500;
}

.catalog-preview__meta-sep {
  font-weight: 400;
  color: color-mix(in srgb, var(--fv-color-text-secondary) 45%, transparent);
}

.catalog-preview__meta-v {
  font-weight: 500;
  color: color-mix(
    in srgb,
    var(--fv-color-text-primary) 92%,
    var(--fv-color-text-secondary)
  );
}
</style>
