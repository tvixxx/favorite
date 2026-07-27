<script lang="ts" setup>
import type { Review } from "@/stores";
import { computed, ref } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import ConfirmDialog from "@/components/ConfirmDialog/ConfirmDialog.vue";

const props = withDefaults(
  defineProps<{
    review: Review;
    isEditing?: boolean;
    canEdit?: boolean;
  }>(),
  { canEdit: false },
);

const emit = defineEmits<{
  edit: [review: Review];
  delete: [reviewId: string];
}>();

const ratePercent = computed(() => (props.review.rate / 10) * 100);

const authorLabel = computed(() => {
  if (props.canEdit) {
    return "Вы";
  }

  return props.review.user?.fullName?.trim() || "Пользователь";
});

/** «только что» / «2 часа назад» / дата — как в эталоне */
const timeLabel = computed(() => {
  const raw = props.review.createdAt;

  if (!raw) {
    return "";
  }

  const created = new Date(raw).getTime();

  if (Number.isNaN(created)) {
    return "";
  }

  const minutes = Math.floor((Date.now() - created) / 60000);

  if (minutes < 1) {
    return "только что";
  }

  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);

  if (days === 1) {
    return "вчера";
  }

  if (days < 7) {
    return `${days} дн назад`;
  }

  return new Date(raw).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
});

const isDeleteOpen = ref(false);

const confirmDelete = (): void => {
  emit("delete", props.review.id);
  isDeleteOpen.value = false;
};
</script>

<template>
  <div
    class="review-item"
    :class="{
      'review-item--editing': isEditing,
      'review-item--mine': props.canEdit,
    }"
  >
    <div class="review-item__header">
      <div class="review-item__rating">
        <span class="review-item__rating-value">{{ review.rate }}</span>
        <span class="review-item__rating-max">/10</span>
        <div class="review-item__rating-bar">
          <div
            class="review-item__rating-fill"
            :style="{ width: `${ratePercent}%` }"
          />
        </div>
      </div>

      <span v-if="props.canEdit" class="review-item__badge">Ваш отзыв</span>

      <div v-if="props.canEdit" class="review-item__actions">
        <button
          class="review-item__action-btn"
          :class="{ 'review-item__action-btn--active': isEditing }"
          @click="emit('edit', review)"
        >
          <BaseIcon name="ph:pencil-simple" :width="16" :height="16" />
        </button>
        <button
          class="review-item__action-btn review-item__action-btn--danger"
          @click="isDeleteOpen = true"
        >
          <BaseIcon name="ph:trash" :width="16" :height="16" />
        </button>
      </div>
    </div>

    <p class="review-item__text">{{ review.text }}</p>

    <p class="review-item__author">
      {{ authorLabel }}<template v-if="timeLabel"> · {{ timeLabel }}</template>
    </p>

    <ConfirmDialog
      v-model="isDeleteOpen"
      title="Удалить отзыв?"
      description="Отзыв будет удалён безвозвратно."
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped lang="scss">
.review-item {
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--fv-color-bg-secondary);
  border: 1.5px solid transparent;
  transition: all 0.2s ease;

  // Свой отзыв выделен (эталон): синяя рамка + accent-soft подложка
  &--mine {
    background: var(--fv-color-accent-soft);
    border-color: var(--fv-color-accent);
  }

  &--editing {
    border-color: var(--fv-color-accent);
    background: color-mix(
      in srgb,
      var(--fv-color-accent) 5%,
      var(--fv-color-bg-secondary)
    );
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--fv-color-accent) 15%, transparent);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--fv-color-accent) 30%, transparent);

    .review-item__actions {
      opacity: 1;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  &__badge {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-accent);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__author {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--fv-color-text-tertiary);
  }

  &__rating {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  // Эталон: балл — display-шрифт 18/700, «/10» 13px tertiary, бар 96×6
  &__rating-value {
    font-family: var(--fv-font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--fv-color-accent);
    line-height: 1;
  }

  &__rating-max {
    font-size: 13px;
    color: var(--fv-color-text-tertiary);
  }

  &__rating-bar {
    width: 96px;
    height: 6px;
    background: var(--fv-color-bg-primary);
    border-radius: 999px;
    overflow: hidden;
  }

  &__rating-fill {
    height: 100%;
    background: var(--fv-color-accent);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  // Кнопки есть только на своём отзыве — прячем их за hover незачем (эталон)
  &__actions {
    display: flex;
    gap: 8px;
    margin-inline-start: auto;
  }

  &__action-btn {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1.5px solid var(--fv-color-border);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--fv-color-accent);
      background: var(--fv-color-accent-soft);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    &--active {
      border-color: var(--fv-color-accent);
      color: var(--fv-color-accent);
      background: color-mix(
        in srgb,
        var(--fv-color-accent) 10%,
        var(--fv-color-bg-primary)
      );
    }

    // Удаление — нейтральная до наведения, «опасная» на hover (эталон)
    &--danger {
      color: var(--fv-color-text-secondary);

      &:hover {
        border-color: var(--fv-color-negative);
        color: var(--fv-color-negative);
        background: color-mix(
          in srgb,
          var(--fv-color-negative) 10%,
          transparent
        );
      }
    }
  }

  &__text {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--fv-color-text-primary);
    margin: 0;
    white-space: pre-line;
  }
}
</style>
