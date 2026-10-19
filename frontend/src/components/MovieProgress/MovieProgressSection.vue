<script setup lang="ts">
import { useId } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import SectionHeading from "@/components/SectionHeading/SectionHeading.vue";
import NumberField from "@/components/NumberField/NumberField.vue";
import { MAX_SEASONS, MAX_EPISODES } from "@/utils/media-numbers";
import type { MovieProgress } from "@/composable/useMovieProgress";

const props = defineProps<{ progress: MovieProgress }>();
const seasonId = useId();
const episodeId = useId();
const {
  currentUserMovie,
  movie,
  isEditingProgress,
  editSeason,
  editEpisode,
  isProgressSaving,
  seasonProgress,
  episodeProgress,
  isSerialCompleted,
  currentWatchStatusLabel,
  dateChips,
  canDecreaseSeason,
  canIncreaseSeason,
  canDecreaseEpisode,
  canIncreaseEpisode,
  startEditProgress,
  cancelEditProgress,
  saveProgress,
  decreaseSeason,
  increaseSeason,
  decreaseEpisode,
  increaseEpisode,
} = props.progress;
</script>

<template>
  <div v-if="movie && currentUserMovie" class="detail-section">
    <SectionHeading
      class="detail-section__title"
      title="Прогресс просмотра"
      icon="ph:clock-countdown"
    >
      <template #actions>
        <a-button
          v-if="!isEditingProgress"
          type="text"
          size="small"
          class="detail-section__edit-btn"
          aria-label="Изменить прогресс просмотра"
          title="Изменить прогресс просмотра"
          @click="startEditProgress"
        >
          <BaseIcon name="ph:pencil-simple" :width="16" :height="16" />
          <span class="detail-section__edit-label">Изменить</span>
        </a-button>
      </template>
    </SectionHeading>

    <div v-if="isSerialCompleted" class="serial-progress__completed">
      <BaseIcon name="ph:check-circle" :width="20" :height="20" />
      <span>Сериал просмотрен полностью</span>
    </div>

    <div class="serial-progress__status-row">
      <span class="serial-progress__status-info">
        Статус:
        <b class="serial-progress__status-value">
          {{ currentWatchStatusLabel }}
        </b>
      </span>
      <span class="serial-progress__status-hint">
        Меняется в панели фильма
      </span>
    </div>

    <div v-if="dateChips.length" class="serial-progress__date-chips">
      <span
        v-for="chip in dateChips"
        :key="chip.key"
        class="date-chip"
        :class="{ 'date-chip--active': chip.active }"
      >
        <BaseIcon :name="chip.icon" :width="14" :height="14" />
        {{ chip.label }}
      </span>
    </div>

    <div v-if="!isEditingProgress" class="serial-progress">
      <p
        v-if="!movie.seasonCount && !movie.episodeCount"
        class="serial-progress__status-hint"
      >
        Всего серий пока неизвестно. Текущий сезон:
        {{ currentUserMovie.currentSeason ?? "не указан" }},
        {{ movie.contentKind === "TV_SHOW" ? "выпуск" : "серия" }}:
        {{ currentUserMovie.currentEpisode ?? "не указана" }}.
      </p>
      <div v-if="movie.seasonCount" class="serial-progress__item">
        <div class="serial-progress__label">
          <span class="serial-progress__label-text">Сезоны</span>
          <span class="serial-progress__label-value">
            {{ currentUserMovie.currentSeason ?? 0 }} /
            {{ movie.seasonCount }}
          </span>
        </div>
        <div class="serial-progress__track">
          <div
            class="serial-progress__fill"
            :class="{
              'serial-progress__fill_done': isSerialCompleted,
            }"
            :style="{ width: `${seasonProgress}%` }"
          />
        </div>
      </div>

      <div v-if="movie.episodeCount" class="serial-progress__item">
        <div class="serial-progress__label">
          <span class="serial-progress__label-text">Эпизоды</span>
          <span class="serial-progress__label-value">
            {{ currentUserMovie.currentEpisode ?? 0 }} /
            {{ movie.episodeCount }}
          </span>
        </div>
        <div class="serial-progress__track">
          <div
            class="serial-progress__fill"
            :class="{
              'serial-progress__fill_done': isSerialCompleted,
            }"
            :style="{ width: `${episodeProgress}%` }"
          />
        </div>
      </div>

      <div class="serial-progress__quick-actions">
        <div v-if="movie.seasonCount" class="serial-progress__quick-group">
          <span class="serial-progress__quick-label">Сезон</span>
          <div class="serial-progress__seg">
            <button
              type="button"
              class="serial-progress__seg-btn"
              :disabled="isProgressSaving || !canDecreaseSeason"
              aria-label="Уменьшить сезон"
              @click="decreaseSeason"
            >
              −1
            </button>
            <button
              type="button"
              class="serial-progress__seg-btn"
              :disabled="isProgressSaving || !canIncreaseSeason"
              aria-label="Увеличить сезон"
              @click="increaseSeason"
            >
              +1
            </button>
          </div>
        </div>
        <div v-if="movie.episodeCount" class="serial-progress__quick-group">
          <span class="serial-progress__quick-label">Эпизод</span>
          <div class="serial-progress__seg">
            <button
              type="button"
              class="serial-progress__seg-btn"
              :disabled="isProgressSaving || !canDecreaseEpisode"
              aria-label="Уменьшить эпизод"
              @click="decreaseEpisode"
            >
              −1
            </button>
            <button
              type="button"
              class="serial-progress__seg-btn"
              :disabled="isProgressSaving || !canIncreaseEpisode"
              aria-label="Увеличить эпизод"
              @click="increaseEpisode"
            >
              +1
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="serial-progress serial-progress_editing">
      <div class="serial-progress__edit-item">
        <label :for="seasonId" class="serial-progress__edit-label">
          На каком сезоне
        </label>
        <NumberField
          :id="seasonId"
          compact
          v-model="editSeason"
          label="На каком сезоне"
          :disabled="isProgressSaving"
          :min="0"
          :max="Math.min(movie.seasonCount ?? MAX_SEASONS, MAX_SEASONS)"
        />
      </div>

      <div class="serial-progress__edit-item">
        <label :for="episodeId" class="serial-progress__edit-label">
          На какой серии
        </label>
        <NumberField
          :id="episodeId"
          compact
          v-model="editEpisode"
          label="На какой серии"
          :disabled="isProgressSaving"
          :min="0"
          :max="Math.min(movie.episodeCount ?? MAX_EPISODES, MAX_EPISODES)"
        />
      </div>

      <div class="serial-progress__edit-actions">
        <a-button @click="cancelEditProgress"> Отмена </a-button>
        <a-button
          type="primary"
          :loading="isProgressSaving"
          @click="saveProgress"
        >
          <BaseIcon name="ph:check" :width="16" :height="16" />
          Сохранить
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;
@use "@/styles/layout" as *;

.detail-section {
  @include detailSection;
}

.detail-section__title {
  margin: 0 0 14px;
}

.detail-section__edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  height: auto;
  padding: 6px 8px;
  font-size: 13px;
}

.date-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--fv-color-border);
  border-radius: 999px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--fv-color-text-secondary);
  white-space: nowrap;

  &--active {
    border-color: var(--fv-color-accent);
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
  }
}

.serial-progress {
  display: flex;
  flex-direction: column;
  gap: 18px;

  &__completed {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--fv-color-positive-soft);
    color: color-mix(
      in srgb,
      var(--fv-color-positive) 45%,
      var(--fv-color-text-primary)
    );
    font-weight: 500;
    font-size: 0.9rem;
    margin-bottom: 16px;

    svg {
      color: color-mix(
        in srgb,
        var(--fv-color-positive) 55%,
        var(--fv-color-text-primary)
      );
    }
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__track {
    height: 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 999px;
    background: var(--fv-color-accent);
    transition: width 0.4s var(--fv-ease),
      background var(--fv-motion-slow) var(--fv-ease);

    &_done {
      background: var(--fv-color-positive);
    }
  }

  &__status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--fv-color-bg-secondary);
    margin-bottom: 14px;
  }

  &__status-info {
    color: var(--fv-color-text-secondary);
  }

  &__status-value {
    color: var(--fv-color-text-primary);
    font-weight: 500;
  }

  &__status-hint {
    font-size: 0.8rem;
    color: var(--fv-color-text-tertiary);
  }

  &__date-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__label {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__label-value {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--fv-color-accent-soft);
    color: var(--fv-color-accent);
    font-size: 13px;
    font-weight: 500;
  }

  &__quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 2px;

    @include mediaMax(640px) {
      grid-template-columns: 1fr;
    }
  }

  &__quick-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--fv-color-bg-secondary);
  }

  &__quick-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-primary);
  }

  &__seg {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 10px;
    background: var(--fv-color-bg-primary);
  }

  &__seg-btn {
    height: 34px;
    padding: 0 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--fv-color-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

    &:hover:not(:disabled) {
      background: var(--fv-color-bg-secondary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }

    &:disabled {
      color: var(--fv-color-text-tertiary);
      cursor: default;
      opacity: 0.6;
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
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 0.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--fv-color-border) 50%, transparent);

    :deep(.ant-btn-primary) {
      display: flex;
      align-items: center;
    }
  }

  @include mediaTablet {
    &__status-row {
      gap: 1.25rem;
    }
  }

  @include mediaMax(640px) {
    &__status-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
    }
  }
}

@include mediaMax($tablet - 0.02px) {
  .serial-progress__seg-btn {
    min-width: 44px;
    height: 44px;
    font-size: 13px;
  }

  .serial-progress__quick-group {
    padding: 6px 10px;
  }
}

@include mediaMax(500px) {
  .detail-section__edit-btn {
    width: 36px;
    flex: none;
  }

  .detail-section__edit-label {
    display: none;
  }
}

@include mediaReducedMotion {
  .serial-progress__fill {
    transition: none;
  }
}
</style>
