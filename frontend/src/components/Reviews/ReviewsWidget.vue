<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useReviews } from "@/composable/useReviews";
import ListLoading from "@/components/List/ListLoading/ListLoading.vue";
import ListError from "@/components/List/ListError/ListError.vue";
import ReviewItem from "@/components/Reviews/ReviewItem.vue";
import ReviewForm from "@/components/Reviews/ReviewForm.vue";
import { showErrorRequest } from "@/state/utils";
import type { Review } from "@/stores";
import { message } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const { movieId } = defineProps<{ movieId: string }>();

const reviewsStore = useReviews();
const { reviews, isLoading, isLoaded, isError, totalReviews } = reviewsStore;
const { fetchReviews, createReview, updateReview, deleteReview } = reviewsStore;

const DEFAULT_ERROR = "Ошибка загрузки отзывов";
const MIN_REVIEW_TEXT_LENGTH = 10;

const editingReview = ref<Review | null>(null);
const isEditing = ref(false);

onMounted(async () => {
  if (!isLoaded.value) {
    try {
      await fetchReviews(movieId);
    } catch {
      // ошибка обработана в fetchReviews
    }
  }
});

const startEdit = (review: Review) => {
  editingReview.value = review;
  isEditing.value = true;
};

const cancelEdit = () => {
  editingReview.value = null;
  isEditing.value = false;
};

const handleSubmit = async (text: string, rate: number) => {
  if (!text || text.length < MIN_REVIEW_TEXT_LENGTH) {
    message.error(
      `Минимальная длина отзыва — ${MIN_REVIEW_TEXT_LENGTH} символов`
    );
    return;
  }

  try {
    if (isEditing.value && editingReview.value) {
      await updateReview(editingReview.value.id, { text, rate, movieId });
      message.success("Отзыв обновлён");
      cancelEdit();
    } else {
      await createReview({ text, rate, movieId });
      message.success("Отзыв добавлен");
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
          name="mdi:comment-text-multiple-outline"
          :width="22"
          :height="22"
        />
        Отзывы
      </h3>
      <span v-if="isLoaded" class="reviews-widget__count">
        {{ totalReviews }}
      </span>
    </div>

    <ListError
      v-if="isError"
      class="reviews-widget__error"
      :is-error="DEFAULT_ERROR"
      :repeat-fn="() => fetchReviews(movieId)"
      repeat-text="Повторить"
    />

    <ListLoading
      v-else-if="isLoading"
      class="reviews-widget__loading"
      :center="true"
      loading-text="Загружаем отзывы..."
      size="large"
    />

    <template v-else-if="isLoaded">
      <div v-if="reviews.length" class="reviews-widget__list">
        <ReviewItem
          v-for="review in reviews"
          :key="review.id"
          :review="review"
          :is-editing="editingReview?.id === review.id"
          @edit="startEdit(review)"
          @delete="handleDelete(review.id)"
        />
      </div>

      <div v-else class="reviews-widget__empty">
        <BaseIcon name="mdi:comment-off-outline" :width="40" :height="40" />
        <p>Отзывов пока нет. Будьте первым!</p>
      </div>
    </template>

    <div class="reviews-widget__form-section">
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
        :key="editingReview?.id ?? 'new'"
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
  background: var(--bg-primary);
  border-radius: 20px;
  padding: 2rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);

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
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;

    svg {
      color: var(--ant-color-primary);
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
      var(--ant-color-primary) 10%,
      var(--bg-primary)
    );
    color: var(--ant-color-primary);
    font-size: 0.85rem;
    font-weight: 700;
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
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    color: var(--text-secondary);
    text-align: center;

    p {
      margin: 0;
      font-size: 0.95rem;
    }
  }

  &__form-section {
    padding-top: 1.5rem;
    border-top: 1px solid
      color-mix(in srgb, var(--border-color) 50%, transparent);
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
    color: var(--text-primary);
    margin: 0;
  }
}
</style>
