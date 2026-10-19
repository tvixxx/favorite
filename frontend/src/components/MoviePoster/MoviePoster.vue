<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { currentTheme } from "@/composable/useTheme";
import { fallbackPosterSvg } from "@/utils/fallbackPoster";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";

const props = withDefaults(
  defineProps<{
    src?: string | null;
    seed?: string;
    title: string;
    meta?: string;
    alt?: string;
    loading?: "lazy" | "eager";
  }>(),
  { src: "", seed: "", meta: "", alt: "", loading: "lazy" }
);
const emit = defineEmits<{ error: [] }>();
const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  }
);

const fallback = computed(
  () => failed.value || !props.src || props.src === FALLBACK_IMAGE_URL
);
const source = computed(() =>
  fallback.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        fallbackPosterSvg(props.seed || props.title, currentTheme.value)
      )}`
    : props.src!
);

function onError(): void {
  if (!fallback.value) {
    failed.value = true;
    emit("error");
  }
}
</script>

<template>
  <span class="movie-poster">
    <img
      :src="source"
      :alt="alt || `${title} постер`"
      :loading="loading"
      referrerpolicy="no-referrer"
      @error="onError"
    />
    <span v-if="fallback" class="movie-poster__caption" aria-hidden="true"
      ><strong>{{ title }}</strong
      ><span v-if="meta">{{ meta }}</span></span
    >
  </span>
</template>

<style scoped lang="scss">
:where(.movie-poster) {
  width: 100%;
  height: 100%;
}

.movie-poster {
  display: block;
  position: relative;
  overflow: hidden;
  container-type: inline-size;

  > img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  &__caption {
    position: absolute;
    inset: auto 0 0;
    height: 21.67%;
    padding: 4% 7%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    color: #fff;
    text-align: left;
  }

  &__caption strong {
    flex-shrink: 0;
    font-size: clamp(12px, 6cqw, 24px);
    font-weight: 600;
    line-height: 1.15;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }

  &__caption > span {
    flex-shrink: 0;
    font-size: clamp(9px, 3.5cqw, 14px);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #dbe3e8;
  }

  @container (max-width: 175px) {
    &__caption {
      padding-top: 3%;
      padding-bottom: 3%;
      gap: 2px;
    }

    &__caption strong {
      -webkit-line-clamp: 1;
    }
  }

  @container (max-width: 96px) {
    &__caption {
      display: none;
    }
  }
}
</style>
