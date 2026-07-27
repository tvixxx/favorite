<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useUserMoviesStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { useReviews } from "@/composable/useReviews";
import { FALLBACK_IMAGE_URL } from "@/constants/movies";

/**
 * Модалка «Ваша оценка» (эталон): звёзды + необязательный отзыв.
 *
 * Оценка живёт в `UserMovie.personalRate` — это источник истины для «Моей оценки».
 * Если пользователь пишет текст, дополнительно создаётся/обновляется отзыв,
 * и его `rate` держим равным звёздам, чтобы панель и список отзывов не расходились.
 */

const open = defineModel<boolean>({ required: true });

const props = defineProps<{
  movieId: string;
  title: string;
  year: string;
  kind: string;
  posterUrl?: string | null;
  personalRate?: number | null;
}>();

const emit = defineEmits<{ saved: [rate: number] }>();

const MIN_REVIEW_TEXT_LENGTH = 10;

const mainStore = useMainStore();
const userMoviesStore = useUserMoviesStore();
const reviewsStore = useReviews();
const { reviews } = reviewsStore;
const { createReview, updateReview } = reviewsStore;

const userId = computed(() => mainStore.userData?.id || "");

const myReview = computed(
  () => reviews.value.find((r) => r.userId === userId.value) ?? null,
);

const rate = ref(0);
const text = ref("");
const isSaving = ref(false);

// При каждом открытии подтягиваем актуальные значения
watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }

  rate.value = props.personalRate ?? myReview.value?.rate ?? 0;
  text.value = myReview.value?.text ?? "";
});

const poster = computed(() => props.posterUrl || FALLBACK_IMAGE_URL);
const canSave = computed(() => rate.value > 0 && !isSaving.value);

const save = async (): Promise<void> => {
  if (!canSave.value || !userId.value) {
    return;
  }

  const trimmed = text.value.trim();

  if (trimmed && trimmed.length < MIN_REVIEW_TEXT_LENGTH) {
    message.error(
      `Минимальная длина отзыва — ${MIN_REVIEW_TEXT_LENGTH} символов`,
    );

    return;
  }

  isSaving.value = true;

  try {
    await userMoviesStore.updateUserMovie(userId.value, props.movieId, {
      personalRate: rate.value,
    });

    if (myReview.value) {
      // Отзыв уже есть — держим его оценку в синхроне со звёздами
      const nextText = trimmed || myReview.value.text;

      if (nextText !== myReview.value.text || myReview.value.rate !== rate.value) {
        await updateReview(myReview.value.id, {
          text: nextText,
          rate: rate.value,
        });
      }
    } else if (trimmed) {
      await createReview({
        text: trimmed,
        rate: rate.value,
        movieId: props.movieId,
      });
    }

    emit("saved", rate.value);
    message.success("Оценка сохранена");
    open.value = false;
  } catch {
    message.error("Не удалось сохранить оценку");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <BaseModal v-model="open" layout="form" class="rate-modal">
    <template #title>Ваша оценка</template>

    <template #body>
      <div class="rate-modal__movie">
        <img class="rate-modal__poster" :src="poster" :alt="title" />
        <div class="rate-modal__movie-info">
          <span class="rate-modal__movie-title">{{ title }}</span>
          <span class="rate-modal__movie-meta">{{ year }} · {{ kind }}</span>
        </div>
      </div>

      <span class="rate-modal__label">Оценка</span>
      <div class="rate-modal__stars">
        <a-rate v-model:value="rate" :count="10" />
        <span v-if="rate" class="rate-modal__score">
          {{ rate }}<span class="rate-modal__score-max">/10</span>
        </span>
      </div>

      <span class="rate-modal__label">
        Отзыв
        <span class="rate-modal__optional">— необязательно</span>
      </span>
      <a-textarea
        v-model:value="text"
        placeholder="Расскажите о своих впечатлениях…"
        :rows="3"
        :maxlength="500"
        show-count
      />
    </template>

    <template #footer>
      <a-button @click="open = false">Отмена</a-button>
      <a-button
        type="primary"
        :disabled="!canSave"
        :loading="isSaving"
        @click="save"
      >
        <BaseIcon name="ph:check" :width="18" :height="18" />
        Сохранить оценку
      </a-button>
    </template>
  </BaseModal>
</template>

<style lang="scss">
/* Не scoped: содержимое BaseModal телепортируется в body */
.rate-modal {
  &__movie {
    display: flex;
    gap: 14px;
    padding: 12px;
    margin-bottom: 20px;
    border-radius: 16px;
    background: var(--fv-color-bg-secondary);
  }

  &__poster {
    flex-shrink: 0;
    width: 46px;
    aspect-ratio: 2 / 3;
    border-radius: 10px;
    object-fit: cover;
  }

  &__movie-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    text-align: left;
  }

  &__movie-title {
    font-weight: 600;
    color: var(--fv-color-text-primary);
  }

  &__movie-meta {
    font-size: 13px;
    color: var(--fv-color-text-secondary);
  }

  &__label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--fv-color-text-secondary);
    text-align: left;
  }

  &__optional {
    color: var(--fv-color-text-tertiary);
  }

  &__stars {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;

    .ant-rate {
      color: var(--fv-color-warning);
      font-size: 22px;
    }
  }

  &__score {
    font-family: var(--fv-font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--fv-color-accent);
  }

  &__score-max {
    font-family: var(--fv-font-ui);
    font-size: 14px;
    font-weight: 400;
    color: var(--fv-color-text-tertiary);
  }
}
</style>
