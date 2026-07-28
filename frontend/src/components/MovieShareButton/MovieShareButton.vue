<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { buildMovieDetailAbsoluteUrl } from "@/utils/movieShareLink";

const props = withDefaults(
  defineProps<{
    movieId: string;
    movieTitle: string;
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const router = useRouter();

const shareUrl = computed(() => {
  return buildMovieDetailAbsoluteUrl(router, props.movieId, props.movieTitle);
});

const ariaLabel = computed(() => `Скопировать ссылку на «${props.movieTitle}»`);

async function copyLink(e?: Event) {
  e?.stopPropagation();
  e?.preventDefault();
  const url = shareUrl.value;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    message.success("Ссылка скопирована в буфер");
  } catch {
    message.error("Не удалось скопировать ссылку");
  }
}
</script>

<template>
  <button
    type="button"
    class="movie-share-btn"
    :class="{ 'movie-share-btn--compact': compact }"
    :aria-label="ariaLabel"
    @click="copyLink"
  >
    <BaseIcon
      class="movie-share-btn__icon"
      name="ph:share-network"
      :width="compact ? 18 : 20"
      :height="compact ? 18 : 20"
    />
    <span v-if="!compact" class="movie-share-btn__text">Поделиться</span>
  </button>
</template>

<style scoped lang="scss">
.movie-share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  margin: 0;
  border-radius: var(--fv-radius-md, 10px);
  border: 1px solid color-mix(in srgb, var(--fv-color-border) 80%, transparent);
  background: color-mix(in srgb, var(--fv-color-bg-secondary) 40%, var(--fv-color-bg-primary));
  color: var(--fv-color-text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--fv-motion-slow) var(--fv-ease), color var(--fv-motion-slow) var(--fv-ease), background var(--fv-motion-slow) var(--fv-ease),
    box-shadow var(--fv-motion-slow) var(--fv-ease);

  &:hover {
    border-color: color-mix(
      in srgb,
      var(--fv-color-accent) 45%,
      var(--fv-color-border)
    );
    color: var(--fv-color-accent);
    background: var(--fv-color-bg-primary);
    box-shadow: 0 2px 10px color-mix(in srgb, #000 6%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }

  &--compact {
    padding: 0.35rem 0.55rem;
    min-width: 2.25rem;
    min-height: 2.25rem;
  }

  &__icon {
    flex-shrink: 0;
    opacity: 0.92;
  }

  &__text {
    white-space: nowrap;
  }
}
</style>
