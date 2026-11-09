<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";
import type { UserMoviesAnalyticsContinueWatchingItem } from "@/stores/movies/types";

const props = defineProps<{
  item: UserMoviesAnalyticsContinueWatchingItem | null;
  loading?: boolean;
}>();

defineEmits<{ open: [] }>();

const posterFailed = shallowRef(false);
const posterUrl = computed(() => {
  const url = props.item?.posterUrl;

  return url && url !== FALLBACK_IMAGE_URL && !posterFailed.value ? url : null;
});

watch(
  () => props.item?.posterUrl,
  () => {
    posterFailed.value = false;
  }
);

const episodeProgress = computed(() => {
  const item = props.item;
  const episode = item?.currentEpisode ?? 0;
  const total = item?.episodeCount ?? 0;

  return item?.seasonCount === 1 && episode > 0 && episode <= total
    ? { episode, total }
    : null;
});

const progress = computed(() => {
  const season = props.item?.currentSeason;
  const episode = props.item?.currentEpisode;

  const total = episodeProgress.value?.total;

  return [
    season && season > 0 ? `Сезон ${season}` : "",
    episode && episode > 0
      ? `серия ${episode}${total ? ` из ${total}` : ""}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
});
</script>

<template>
  <section
    class="profile-watching"
    :class="{ 'profile-watching--empty': !item && !loading }"
    aria-label="Продолжить смотреть"
    :aria-busy="loading || undefined"
  >
    <div class="profile-watching__content">
      <p class="profile-watching__label">Продолжить смотреть</p>
      <template v-if="loading">
        <h2 aria-hidden="true">
          <SkeletonBar width="78%" height="0.82em" radius="6px" />
        </h2>
        <div
          class="profile-watching__meta profile-watching__line"
          aria-hidden="true"
        >
          <SkeletonBar width="56%" height="12px" radius="6px" />
        </div>
        <div class="profile-watching__progress" aria-hidden="true">
          <SkeletonBar class="profile-watching__track" height="5px" />
          <SkeletonBar width="34px" height="9px" radius="5px" />
        </div>
        <div class="profile-watching__action-skeleton" aria-hidden="true">
          <SkeletonBar
            height="var(--profile-watch-action-height)"
            radius="var(--fv-radius-control)"
          />
        </div>
      </template>
      <template v-else-if="item">
        <h2>{{ item.title }}</h2>
        <p v-if="progress" class="profile-watching__meta">{{ progress }}</p>
        <div
          v-if="episodeProgress"
          class="profile-watching__progress"
          role="progressbar"
          aria-label="Прогресс просмотра сериала"
          :aria-valuenow="episodeProgress.episode"
          :aria-valuemax="episodeProgress.total"
        >
          <span class="profile-watching__track" aria-hidden="true">
            <span
              :style="{
                width: `${
                  (episodeProgress.episode / episodeProgress.total) * 100
                }%`,
              }"
            />
          </span>
          <span aria-hidden="true"
            >{{ episodeProgress.episode }} из {{ episodeProgress.total }}</span
          >
        </div>
        <p
          v-else-if="item.episodeCount && item.episodeCount > 0"
          class="profile-watching__meta"
        >
          Всего серий: {{ item.episodeCount }}
        </p>
        <button
          type="button"
          class="profile-watching__action"
          @click="$emit('open')"
        >
          <BaseIcon name="ph:arrow-right" :width="16" :height="16" />
          Открыть карточку
        </button>
      </template>
      <p v-else class="profile-watching__meta">Нет сериалов в процессе</p>
    </div>
    <div
      v-if="item || loading"
      class="profile-watching__art"
      aria-hidden="true"
    >
      <SkeletonBar
        v-if="loading"
        class="profile-watching__art-skeleton"
        height="100%"
        radius="0"
      />
      <MoviePoster
        v-else-if="item && posterUrl"
        :key="item.movieId"
        :src="posterUrl"
        :seed="item.movieId"
        :title="item.title"
        loading="eager"
        @error="posterFailed = true"
      />
      <BaseIcon
        v-else
        class="profile-watching__placeholder"
        name="ph:film-slate"
        :width="56"
        :height="56"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.profile-watching {
  --profile-watch-action-height: 40px;
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-card);

  @include mediaTablet {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    min-height: 260px;
  }

  @include mediaDesktopXS {
    &:not(&--empty) {
      align-self: stretch;
    }
  }

  &--empty {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  &__content {
    min-width: 0;
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 12px;
    padding: clamp(18px, 3vw, 36px);
  }

  &__label {
    margin: 0;
    color: var(--fv-color-accent);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.65rem, 4vw, 3rem);
    line-height: 1.08;
    width: 100%;
    min-height: 1.08em;
    overflow-wrap: anywhere;
  }

  &__meta {
    margin: 0;
    color: var(--fv-color-text-secondary);
    line-height: 1.15;
  }

  &__line {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 1.15em;
  }

  &__progress {
    width: min(100%, 230px);
    display: flex;
    align-items: center;
    min-height: 18px;
    gap: 8px;
    color: var(--fv-color-text-secondary);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  &__track {
    flex: 1;
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--fv-color-border);

    > span:not(.skel) {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--fv-color-brand);
    }
  }

  &__art {
    position: relative;
    display: grid;
    place-items: center;
    order: -1;
    min-width: 0;
    height: clamp(128px, 42vw, 200px);
    background: radial-gradient(
        ellipse at 64% 24%,
        color-mix(in srgb, var(--fv-color-accent) 20%, transparent),
        transparent 75%
      ),
      var(--fv-color-bg-secondary);

    @include mediaTablet {
      order: 0;
      height: auto;
    }

    :deep(.movie-poster) {
      position: absolute;
      inset: 0;
    }
  }

  &__art-skeleton {
    position: absolute;
    inset: 0;
  }

  &__placeholder {
    color: var(--fv-color-text-tertiary);
  }

  &__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    min-height: var(--profile-watch-action-height);
    padding: 6px 12px;
    border: 1px solid transparent;
    border-radius: var(--fv-radius-control);
    background: var(--fv-color-brand);
    color: #fff;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    white-space: normal;
    cursor: pointer;

    &:hover {
      background: var(--fv-color-brand-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    svg {
      flex: none;
    }

    @include mediaTablet {
      width: auto;
    }
  }

  &__action-skeleton {
    width: 100%;

    @include mediaTablet {
      width: min(180px, 100%);
    }
  }
}
</style>
