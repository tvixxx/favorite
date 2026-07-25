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

const isDeleteOpen = ref(false);

const confirmDelete = (): void => {
  emit("delete", props.review.id);
  isDeleteOpen.value = false;
};
</script>

<template>
  <div class="review-item" :class="{ 'review-item--editing': isEditing }">
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

    <ConfirmDialog
      v-model="isDeleteOpen"
      title="Удалить отзыв?"
      description="Отзыв будет удалён безвозвратно."
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.review-item {
  padding: 1.25rem;
  border-radius: 12px;
  background: var(--fv-color-bg-secondary);
  border: 1px solid var(--fv-color-border);
  transition: all 0.2s ease;

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
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  &__rating {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__rating-value {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--fv-color-accent);
    line-height: 1;
  }

  &__rating-max {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__rating-bar {
    width: 80px;
    height: 4px;
    background: var(--fv-color-bg-primary);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 6px;
  }

  &__rating-fill {
    height: 100%;
    background: var(--fv-color-accent);
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  &__actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;

    @include mediaMax($tablet) {
      opacity: 1;
    }
  }

  &__action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--fv-color-accent);
      color: var(--fv-color-accent);
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

    &--danger:hover {
      border-color: var(--fv-color-negative);
      color: var(--fv-color-negative);
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
