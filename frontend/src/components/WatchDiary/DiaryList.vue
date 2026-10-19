<script setup lang="ts">
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import MoviePoster from "@/components/MoviePoster/MoviePoster.vue";
import { formatInstant, formatYear } from "@/utils/date.utils";
import { contentTypeLabel } from "@/utils/content-kind";
import type { DiaryEntry } from "@/services/watch-diary";

const props = defineProps<{
  items: DiaryEntry[];
  compact?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{
  edit: [entry: DiaryEntry];
  remove: [entry: DiaryEntry];
  openMovie: [id: string];
}>();
const date = (value: string, options: Intl.DateTimeFormatOptions): string =>
  formatInstant(value + "T00:00:00Z", "UTC", options);
const fullDate = (value: string): string =>
  date(value, { day: "numeric", month: "long", year: "numeric" });
const groups = computed(() => {
  const result: { month: string; label: string; items: DiaryEntry[] }[] = [];

  for (const item of props.items) {
    const month = item.viewedOn.slice(0, 7);
    let group = result.at(-1);

    if (group?.month !== month) {
      group = {
        month,
        label: date(month + "-01", { month: "long", year: "numeric" }),
        items: [],
      };

      result.push(group);
    }

    group!.items.push(item);
  }

  return result;
});
</script>

<template>
  <div class="diary-list" :class="{ 'diary-list_compact': compact }">
    <section
      v-for="group in groups"
      :key="group.month"
      :aria-label="group.label"
    >
      <p v-if="!compact" class="diary-list__month">{{ group.label }}</p>
      <article
        v-for="entry in group.items"
        :key="entry.id"
        class="diary-entry"
        :aria-label="`${entry.movie.title}, ${fullDate(entry.viewedOn)}`"
      >
        <div class="diary-entry__day">
          <strong>{{ Number(entry.viewedOn.slice(8)) }}</strong
          ><span>{{ date(entry.viewedOn, { weekday: "short" }) }}</span>
        </div>
        <MoviePoster
          v-if="!compact"
          class="diary-entry__poster"
          :src="entry.movie.imageUrl"
          :title="entry.movie.title"
          :seed="entry.movie.id"
        />
        <div class="diary-entry__copy">
          <button
            v-if="!compact"
            type="button"
            class="diary-entry__title"
            @click="emit('openMovie', entry.movie.id)"
          >
            {{ entry.movie.title }}
          </button>
          <p class="diary-entry__meta">
            {{
              compact
                ? fullDate(entry.viewedOn)
                : `${formatYear(entry.movie.publishDate)} · ${contentTypeLabel(
                    entry.movie
                  )}`
            }}
          </p>
          <div class="diary-entry__tags">
            <span>{{
              entry.scope === "SEASON"
                ? `Сезон ${entry.season}`
                : entry.movie.isSerial
                ? "Сериал целиком"
                : "Фильм полностью"
            }}</span
            ><span v-if="entry.isRewatch" class="diary-entry__rewatch"
              ><BaseIcon
                name="ph:arrows-clockwise"
                :width="13"
                :height="13"
              />Пересмотр</span
            ><span v-if="!entry.inCollection">Вне коллекции</span>
          </div>
          <p v-if="entry.note" class="diary-entry__note">{{ entry.note }}</p>
        </div>
        <div class="diary-entry__end">
          <span v-if="entry.rating" class="diary-entry__score"
            >{{ entry.rating }}<small>/10</small></span
          ><span v-else class="diary-entry__unrated">Без оценки</span>
          <div class="diary-entry__actions">
            <button
              type="button"
              :aria-label="`Изменить запись за ${fullDate(entry.viewedOn)}`"
              :disabled="busy"
              @click="emit('edit', entry)"
            >
              <BaseIcon
                name="ph:pencil-simple"
                :width="18"
                :height="18"
              /></button
            ><button
              type="button"
              :aria-label="`Удалить запись за ${fullDate(entry.viewedOn)}`"
              :disabled="busy"
              @click="emit('remove', entry)"
            >
              <BaseIcon name="ph:trash" :width="18" :height="18" />
            </button>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.diary-list {
  min-width: 0;

  &__month {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 10px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    text-transform: capitalize;

    &::after {
      content: "";
      height: 1px;
      flex: 1;
      background: var(--fv-color-border);
    }
  }
}

.diary-entry {
  display: grid;
  grid-template-columns: 44px 48px minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  padding: 20px 0;

  & + & {
    border-top: 1px solid var(--fv-color-border);
  }

  &__day {
    text-align: center;
    color: var(--fv-color-text-secondary);

    strong {
      display: block;
      color: var(--fv-color-text-primary);
      font-size: 25px;
      font-weight: 500;
      line-height: 1.2;
    }

    span {
      font-size: 12px;
    }
  }

  &__poster {
    width: 48px;
    height: 72px;
    border-radius: 8px;
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    display: block;
    padding: 0;
    background: none;
    border: 0;
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 17px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    overflow-wrap: anywhere;

    &:hover {
      color: var(--fv-color-accent);
    }
  }

  &__meta {
    margin: 3px 0 0;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 7px;

    > span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 7px;
      border-radius: 6px;
      background: var(--fv-color-bg-secondary);
      font-size: 12px;
      color: var(--fv-color-text-secondary);
    }

    > .diary-entry__rewatch {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }
  }

  &__note {
    margin: 10px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
    line-height: 1.55;
    color: var(--fv-color-text-secondary);
  }

  &__end {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__score {
    font-size: 18px;
    font-weight: 500;
    color: var(--fv-color-accent);
    white-space: nowrap;

    small {
      font-size: 12px;
      color: var(--fv-color-text-tertiary);
      font-weight: 400;
    }
  }

  &__unrated {
    color: var(--fv-color-text-tertiary);
    font-size: 12px;
  }

  &__actions {
    display: flex;
    gap: 2px;

    button {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 8px;
      color: var(--fv-color-text-secondary);
      background: transparent;
      border: 0;
      border-radius: var(--fv-radius-control);
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--fv-color-bg-secondary);
        color: var(--fv-color-accent);
      }

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }
    }
  }

  button:focus-visible {
    outline: 2px solid var(--fv-color-accent);
    outline-offset: 2px;
  }
}

.diary-list_compact .diary-entry {
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
}

@include mediaMax(767px) {
  .diary-entry {
    grid-template-columns: 32px 40px minmax(0, 1fr);
    gap: 10px;
    padding: 18px 0;

    &__poster {
      width: 40px;
      height: 60px;
    }

    &__end {
      grid-column: 3;
      justify-content: space-between;
    }

    &__day strong {
      font-size: 22px;
    }

    &__title {
      font-size: 15px;
    }

    &__note {
      font-size: 13px;
    }

    &__tags > span {
      font-size: 11px;
    }
  }

  .diary-list_compact .diary-entry {
    grid-template-columns: 32px minmax(0, 1fr);

    .diary-entry__end {
      grid-column: 2;
    }
  }
}
</style>
