<script lang="ts" setup>
import type { Review } from "@/stores";
import { computed } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = defineProps<{
  review: Review;
  isEditing?: boolean;
}>();

const emit = defineEmits<{
  edit: [review: Review];
  delete: [reviewId: string];
}>();

const ratePercent = computed(() => (props.review.rate / 10) * 100);
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

      <div class="review-item__actions">
        <button
          class="review-item__action-btn"
          :class="{ 'review-item__action-btn--active': isEditing }"
          @click="emit('edit', review)"
        >
          <BaseIcon name="mdi:pencil-outline" :width="16" :height="16" />
        </button>
        <a-popconfirm
          title="Удалить отзыв?"
          ok-text="Да"
          cancel-text="Нет"
          @confirm="emit('delete', review.id)"
        >
          <button
            class="review-item__action-btn review-item__action-btn--danger"
          >
            <BaseIcon name="mdi:delete-outline" :width="16" :height="16" />
          </button>
        </a-popconfirm>
      </div>
    </div>

    <p class="review-item__text">{{ review.text }}</p>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.review-item {
  padding: 1.25rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;

  &--editing {
    border-color: var(--ant-color-primary);
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 5%,
      var(--bg-secondary)
    );
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--ant-color-primary) 15%, transparent);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--ant-color-primary) 30%, transparent);

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
    font-weight: 800;
    color: var(--ant-color-primary);
    line-height: 1;
  }

  &__rating-max {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  &__rating-bar {
    width: 80px;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    overflow: hidden;
    margin-left: 6px;
  }

  &__rating-fill {
    height: 100%;
    background: var(--ant-color-primary);
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
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
    }

    &--active {
      border-color: var(--ant-color-primary);
      color: var(--ant-color-primary);
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-primary)
      );
    }

    &--danger:hover {
      border-color: var(--ant-color-error, #ff4d4f);
      color: var(--ant-color-error, #ff4d4f);
    }
  }

  &__text {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--text-primary);
    margin: 0;
    white-space: pre-line;
  }
}
</style>
