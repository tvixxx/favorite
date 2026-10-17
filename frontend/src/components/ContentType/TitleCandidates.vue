<script setup lang="ts">
import { ref, watch } from "vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import api from "@/services/api";
import { contentTypeLabel, type ContentKind } from "@/utils/content-kind";
import { PRODUCTION_COUNTRIES } from "@/constants/countries/production-countries";

interface Candidate {
  id: string;
  title: string;
  isSerial: boolean;
  contentKind?: ContentKind | null;
  publishDate: string | null;
  countryCodes: string[];
  poster?: { url: string; thumbnailUrl?: string | null } | null;
}
const props = defineProps<{
  title: string;
  excludeId?: string | null;
  disabled?: boolean;
  canAdd?: boolean;
}>();
const emit = defineEmits<{ choose: [id: string] }>();
const candidates = ref<Candidate[]>([]);
const error = ref(false);
const loading = ref(false);
const retry = ref(0);
watch(
  [() => props.title.trim(), () => props.excludeId, retry],
  ([title], _old, cleanup) => {
    candidates.value = [];
    error.value = false;
    loading.value = false;
    if (!title) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      loading.value = true;
      try {
        const { data } = await api.get<Candidate[]>(
          "/movies/title-candidates",
          { params: { title }, signal: controller.signal }
        );
        if (active)
          candidates.value = data.filter(
            (movie) => movie.id !== props.excludeId
          );
      } catch {
        if (active) error.value = true;
      } finally {
        if (active) loading.value = false;
      }
    }, 300);
    cleanup(() => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    });
  },
  { immediate: true }
);

function countries(movie: Candidate): string {
  return movie.countryCodes
    .map(
      (code) =>
        PRODUCTION_COUNTRIES.find((country) => country.code === code)?.label ??
        code
    )
    .join(", ");
}
</script>

<template>
  <div
    v-if="loading || error || candidates.length"
    class="title-candidates"
    aria-live="polite"
  >
    <p v-if="loading" class="title-candidates__hint">Проверяем совпадения…</p>
    <p v-else-if="error" class="title-candidates__hint">
      Не удалось проверить совпадения.
      <button type="button" class="title-candidates__action" @click="retry++">
        Повторить
      </button>
    </p>
    <template v-else>
      <p class="title-candidates__heading">В каталоге есть похожие записи</p>
      <ul class="title-candidates__list">
        <li
          v-for="movie in candidates"
          :key="movie.id"
          class="title-candidates__item"
        >
          <MoviePoster
            :src="movie.poster?.thumbnailUrl || movie.poster?.url"
            :seed="movie.id"
            :title="movie.title"
            alt=""
            referrerpolicy="no-referrer"
            class="title-candidates__poster"
          />
          <div class="title-candidates__text">
            <a
              :href="`/detail/${movie.id}`"
              target="_blank"
              rel="noopener noreferrer"
              >{{ movie.title }}</a
            >
            <span
              >{{ contentTypeLabel(movie) }} ·
              {{
                movie.publishDate
                  ? new Date(movie.publishDate).getUTCFullYear()
                  : "Год не указан"
              }}</span
            >
            <span>{{ countries(movie) }}</span>
            <button
              v-if="canAdd"
              type="button"
              class="title-candidates__action"
              :disabled="disabled"
              @click="emit('choose', movie.id)"
            >
              Добавить в коллекцию
            </button>
          </div>
        </li>
      </ul>
      <p class="title-candidates__hint">
        Если это другая запись, уточните год и формат. Спорное совпадение может
        подтвердить администратор.
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.title-candidates {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--fv-color-border);
  border-radius: 12px;
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);
  &__heading {
    margin: 0 0 12px;
    font-weight: 500;
  }
  &__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 16px;
  }
  &__item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  &__poster {
    width: 48px;
    height: 68px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }
  &__text {
    min-width: 0;
    display: grid;
    gap: 4px;
    overflow-wrap: anywhere;
  }
  &__text a {
    color: var(--fv-color-link);
  }
  &__text span,
  &__hint {
    color: var(--fv-color-text-secondary);
    font-size: 14px;
  }
  &__hint {
    margin: 12px 0 0;
  }
  &__action {
    justify-self: start;
    border: 0;
    padding: 8px 0;
    min-height: 44px;
    background: transparent;
    color: var(--fv-color-link);
    font: inherit;
    cursor: pointer;
    text-align: left;
  }
  &__action:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }
  &__action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
