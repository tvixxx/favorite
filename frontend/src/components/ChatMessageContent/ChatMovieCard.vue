<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useChatMovie } from "@/composable/useChatMovie";
import { GenreLabels } from "@/components/Genres/constants/genres.constants";
import { formatAverageRating, formatYear } from "@/utils";

const props = defineProps<{
  url: string;
  /** Название из паттерна шеринга (фолбэк, пока грузится / если фильм не найден) */
  title: string;
}>();

function parseDetailId(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);

    if (parsed.origin !== window.location.origin) {
      return null;
    }

    const match = parsed.pathname.match(/^\/detail\/([^/]+)\/?$/);

    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const detailId = computed(() => parseDetailId(props.url));
const movie = useChatMovie(detailId);
const imgError = ref(false);

const displayTitle = computed(() => movie.value?.title || props.title);

const posterSrc = computed(
  () => movie.value?.imageUrl || movie.value?.poster?.url || "",
);
const showPoster = computed(() => !!posterSrc.value && !imgError.value);

const label = computed(() =>
  movie.value?.isSerial ? "Сериал · FAVORITE" : "Фильм · FAVORITE",
);

const meta = computed(() => {
  const current = movie.value;

  if (!current) {
    return "";
  }

  const parts: string[] = [];

  if (current.publishDate) {
    parts.push(formatYear(current.publishDate));
  }

  const genre = current.genres?.[0];

  if (genre) {
    parts.push(GenreLabels[genre] ?? genre);
  }

  return parts.join(" · ");
});

const rating = computed(() => {
  const value = formatAverageRating(movie.value?.averageRating);

  return value ? value.replace(".", ",") : null;
});
</script>

<template>
  <component
    :is="detailId ? RouterLink : 'a'"
    class="chat-movie-card"
    v-bind="
      detailId
        ? { to: { name: 'detail', params: { id: detailId } } }
        : { href: props.url, target: '_blank', rel: 'noopener noreferrer' }
    "
  >
    <span class="chat-movie-card__poster" aria-hidden="true">
      <img
        v-if="showPoster"
        :src="posterSrc"
        :alt="displayTitle"
        class="chat-movie-card__poster-img"
        @error="imgError = true"
      />
      <BaseIcon v-else name="ph:film-slate" :width="20" :height="20" />
    </span>

    <span class="chat-movie-card__body">
      <span class="chat-movie-card__label">{{ label }}</span>
      <span class="chat-movie-card__title">{{ displayTitle }}</span>
      <span v-if="meta" class="chat-movie-card__meta">{{ meta }}</span>
      <span class="chat-movie-card__open">
        <BaseIcon
          v-if="rating"
          name="ph:star-fill"
          class="chat-movie-card__star"
          :width="13"
          :height="13"
        />
        <template v-if="rating">{{ rating }} · </template>открыть
      </span>
    </span>
  </component>
</template>

<style scoped lang="scss">
/* Карточка фильма в чате (эталон): постер + «ФИЛЬМ · FAVORITE» + название + год·жанр + ⭐·открыть */
.chat-movie-card {
  display: flex;
  gap: 10px;
  max-width: 300px;
  padding: 10px;
  border: 1px solid var(--fv-color-border);
  border-radius: 14px;
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  text-decoration: none;
  box-shadow: var(--fv-shadow-low);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--fv-shadow-card);
  }

  &__poster {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 52px;
    aspect-ratio: 2 / 3;
    border-radius: 10px;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(160deg, #2a3550 0%, #0e1524 100%);
  }

  &__poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    justify-content: center;
  }

  &__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--fv-color-accent);
  }

  &__title {
    font-weight: 500;
    font-size: 14px;
    line-height: 1.25;
    color: var(--fv-color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__meta {
    font-size: 12px;
    color: var(--fv-color-text-secondary);
  }

  &__open {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fv-color-accent);
  }

  &__star {
    color: var(--fv-color-warning);
  }
}
</style>
