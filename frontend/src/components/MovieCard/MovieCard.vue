<script lang="ts" setup>
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  posterSrc: string;
  title: string;
  meta?: string;
  /** Оценка (число — своя, строка — средняя «9.0»); пилюля скрыта при 0/пусто */
  rate?: number | string | null;
  /** Прогресс просмотра, % (0 — бар скрыт) */
  progressPercent?: number;
  /** Сердце: undefined — кнопки нет; true/false — залито/контур */
  favorite?: boolean;
  /** Каталог: вместо сердца — круглая красная «+» */
  addable?: boolean;
  /** Показывать кнопку удаления (hover на десктопе, всегда на тач) */
  deletable?: boolean;
  posterAlt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  meta: "",
  rate: null,
  progressPercent: 0,
  favorite: undefined,
  addable: false,
  deletable: false,
  posterAlt: "",
});

const showRate = computed<boolean>(() => {
  const r = props.rate;

  return r !== null && r !== undefined && r !== 0 && r !== "0" && r !== "";
});

const emit = defineEmits<{
  (e: "open"): void;
  (e: "toggle-favorite"): void;
  (e: "add"): void;
  (e: "delete"): void;
  (e: "poster-error"): void;
}>();
</script>

<template>
  <article class="movie-card" @click="emit('open')">
    <div class="movie-card__poster-wrap">
      <img
        :src="posterSrc"
        :alt="posterAlt || `${title} постер`"
        class="movie-card__poster"
        loading="lazy"
        @error="emit('poster-error')"
      />

      <span v-if="showRate" class="movie-card__rate">{{ rate }}</span>

      <div class="movie-card__actions">
        <button
          v-if="deletable"
          type="button"
          class="movie-card__action movie-card__action--delete"
          aria-label="Удалить"
          @click.stop="emit('delete')"
        >
          <BaseIcon name="ph:trash" :width="18" :height="18" />
        </button>

        <button
          v-if="addable"
          type="button"
          class="movie-card__action movie-card__action--add"
          aria-label="Добавить в коллекцию"
          @click.stop="emit('add')"
        >
          <BaseIcon name="ph:plus" :width="20" :height="20" />
        </button>

        <button
          v-else-if="favorite !== undefined"
          type="button"
          class="movie-card__action movie-card__action--fav"
          :class="{ 'movie-card__action--fav-on': favorite }"
          aria-label="В избранное"
          @click.stop="emit('toggle-favorite')"
        >
          <BaseIcon
            :name="favorite ? 'ph:heart-fill' : 'ph:heart'"
            :width="19"
            :height="19"
          />
        </button>
      </div>

      <div
        v-if="progressPercent > 0"
        class="movie-card__progress"
        aria-hidden="true"
      >
        <div
          class="movie-card__progress-fill"
          :style="{ width: Math.min(progressPercent, 100) + '%' }"
        ></div>
      </div>
    </div>

    <div class="movie-card__body">
      <h3 class="movie-card__title">{{ title }}</h3>
      <p v-if="meta" class="movie-card__meta">{{ meta }}</p>
    </div>
  </article>
</template>

<style lang="scss" scoped>
.movie-card {
  cursor: pointer;

  &__poster-wrap {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: var(--fv-radius-md);
    overflow: hidden;
    background: var(--fv-color-bg-secondary);
    box-shadow: var(--fv-shadow-card);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease;
  }

  &:hover &__poster-wrap {
    transform: translateY(-4px);
    box-shadow: var(--fv-shadow-elevated);
  }

  &__poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__rate {
    position: absolute;
    top: 9px;
    left: 9px;
    height: 26px;
    padding: 0 9px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    // Непрозрачный светло-синий пилюль — читается поверх любого постера
    // (accent-soft = 12% на прозрачном, сквозь который видно картинку).
    background: color-mix(in srgb, var(--fv-color-accent) 16%, #fff);
    color: var(--fv-color-accent);
    font-size: 13px;
    font-weight: 600;
  }

  &__actions {
    position: absolute;
    top: 9px;
    right: 9px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__action {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition:
      transform 0.15s ease,
      background 0.15s ease;

    &:active {
      transform: scale(0.92);
    }

    &--fav {
      background: rgba(255, 255, 255, 0.92);
      color: var(--fv-color-text-tertiary);
    }

    &--fav-on {
      color: var(--fv-color-brand);
    }

    &--add {
      background: var(--fv-color-brand);
      color: #fff;

      &:hover {
        background: var(--fv-color-brand-hover);
      }
    }

    // Удаление: контекстное действие. На десктопе — по ховеру, на тач — всегда.
    &--delete {
      background: rgba(255, 255, 255, 0.92);
      color: var(--fv-color-text-secondary);

      &:hover {
        color: var(--fv-color-brand);
      }
    }
  }

  @media (hover: hover) {
    &__action--delete {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }

    &:hover &__action--delete {
      opacity: 1;
      pointer-events: auto;
    }
  }

  &__progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 4px;
    background: rgba(0, 0, 0, 0.28);
  }

  &__progress-fill {
    height: 100%;
    background: var(--fv-color-brand);
  }

  &__body {
    margin-top: 11px;
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-ui);
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.25;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    margin: 2px 0 0;
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
