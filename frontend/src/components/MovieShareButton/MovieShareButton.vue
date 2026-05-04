<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

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
  const { fullPath } = router.resolve({
    name: "detail",
    params: { id: props.movieId },
  });
  if (typeof window === "undefined") {
    return fullPath;
  }

  return `${window.location.origin}${fullPath}`;
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
      name="mdi:share-variant"
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
  border-radius: var(--radius-md, 10px);
  border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 40%, var(--bg-primary));
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: color-mix(
      in srgb,
      var(--ant-color-primary) 45%,
      var(--border-color)
    );
    color: var(--ant-color-primary);
    background: var(--bg-primary);
    box-shadow: 0 2px 10px color-mix(in srgb, #000 6%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--ant-color-primary);
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
