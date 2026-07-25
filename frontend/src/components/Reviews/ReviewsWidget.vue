<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useReviews } from "@/composable/useReviews";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import ReviewItem from "@/components/Reviews/ReviewItem.vue";
import ReviewForm from "@/components/Reviews/ReviewForm.vue";
import { showErrorRequest } from "@/state/utils";
import type { Review } from "@/stores";
import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useMainStore } from "@/state/state";

const { movieId } = defineProps<{ movieId: string }>();

const mainStore = useMainStore();
const currentUserId = computed(() => mainStore.userData?.id ?? null);
const isLoggedIn = computed(() => mainStore.isLoggedIn);

const reviewsStore = useReviews();
const { reviews, isLoading, isLoaded, isError, totalReviews } = reviewsStore;
const { fetchReviews, createReview, updateReview, deleteReview } = reviewsStore;

const MIN_REVIEW_TEXT_LENGTH = 10;

const editingReview = ref<Review | null>(null);
const isEditing = ref(false);

type ReviewFormExpose = { resetForm: () => void };
const reviewFormRef = ref<ReviewFormExpose | null>(null);

const canEditReview = (review: Review) =>
  !!currentUserId.value && review.userId === currentUserId.value;

const startEdit = (review: Review) => {
  editingReview.value = review;
  isEditing.value = true;
};

const cancelEdit = () => {
  editingReview.value = null;
  isEditing.value = false;
};

watch(
  () => movieId,
  async (id) => {
    if (!id) {
      return;
    }

    cancelEdit();
    try {
      await fetchReviews(id);
    } catch {
      /* ignore */
    }
  },
  { immediate: true }
);

const handleSubmit = async (text: string, rate: number) => {
  if (!text || text.length < MIN_REVIEW_TEXT_LENGTH) {
    message.error(
      `Минимальная длина отзыва — ${MIN_REVIEW_TEXT_LENGTH} символов`
    );

    return;
  }

  try {
    if (isEditing.value && editingReview.value) {
      await updateReview(editingReview.value.id, { text, rate });
      message.success("Отзыв обновлён");
      cancelEdit();
    } else {
      await createReview({ text, rate, movieId });
      message.success("Отзыв добавлен");
      reviewFormRef.value?.resetForm();
    }
  } catch (error) {
    showErrorRequest(error);
  }
};

const handleDelete = async (reviewId: string) => {
  try {
    await deleteReview(reviewId);
    message.success("Отзыв удалён");

    if (editingReview.value?.id === reviewId) {
      cancelEdit();
    }
  } catch (error) {
    showErrorRequest(error);
  }
};
</script>

<template>
  <section class="reviews-widget">
    <div class="reviews-widget__header">
      <h3 class="reviews-widget__title">
        <BaseIcon
          name="ph:chats"
          :width="22"
          :height="22"
        />
        Отзывы
      </h3>
      <span v-if="isLoaded" class="reviews-widget__count">
        {{ totalReviews }}
      </span>
    </div>

    <StateBlock
      v-if="isError"
      class="reviews-widget__error"
      compact
      variant="error"
      icon="ph:warning-circle"
      title="Не удалось загрузить отзывы"
      description="Попробуйте обновить."
      :actions="[
        {
          label: 'Повторить',
          icon: 'ph:arrow-clockwise',
          kind: 'primary',
          onClick: () => void fetchReviews(movieId),
        },
      ]"
    />

    <RowsSkeleton
      v-else-if="isLoading"
      class="reviews-widget__loading"
      :count="3"
      :badge="false"
    />

    <template v-else-if="isLoaded">
      <div v-if="reviews.length" class="reviews-widget__list">
        <ReviewItem
          v-for="review in reviews"
          :key="review.id"
          :review="review"
          :can-edit="canEditReview(review)"
          :is-editing="editingReview?.id === review.id"
          @edit="startEdit(review)"
          @delete="handleDelete(review.id)"
        />
      </div>

      <StateBlock
        v-else
        compact
        variant="empty"
        icon="ph:chat-text"
        title="Отзывов пока нет"
        description="Будьте первым!"
      />
    </template>

    <div v-if="isLoggedIn" class="reviews-widget__form-section">
      <div class="reviews-widget__form-header">
        <h4 class="reviews-widget__form-title">
          {{ isEditing ? "Редактировать отзыв" : "Написать отзыв" }}
        </h4>
        <a-button
          v-if="isEditing"
          type="primary"
          size="medium"
          @click="cancelEdit"
        >
          Отменить редактирование
        </a-button>
      </div>

      <ReviewForm
        ref="reviewFormRef"
        :key="editingReview?.id ?? 'new'"
        :is-editing="isEditing"
        :initial-text="editingReview?.text ?? ''"
        :initial-rate="editingReview?.rate ?? 0"
        @submit="handleSubmit"
        @cancel="cancelEdit"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.reviews-widget {
  background: var(--fv-color-bg-primary);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--fv-shadow-low);
  border: 1px solid var(--fv-color-border);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    margin: 0;

    svg {
      color: var(--fv-color-accent);
    }
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: 14px;
    background: color-mix(
      in srgb,
      var(--fv-color-accent) 10%,
      var(--fv-color-bg-primary)
    );
    color: var(--fv-color-accent);
    font-size: 0.85rem;
    font-weight: 500;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 1.5rem;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 2.5rem 1rem;
    margin-bottom: 1.5rem;
    border-radius: 12px;
    background: var(--fv-color-bg-secondary);
    border: 1px dashed var(--fv-color-border);
    color: var(--fv-color-text-secondary);
    text-align: center;

    p {
      margin: 0;
      font-size: 0.95rem;
    }
  }

  &__form-section {
    padding-top: 1.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--fv-color-border) 50%, transparent);
  }

  &__form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  &__form-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fv-color-text-primary);
    margin: 0;
  }
}
</style>
