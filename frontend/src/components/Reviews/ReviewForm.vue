<script lang="ts" setup>
import { reactive, ref, watch } from "vue";
import type { FormInstance } from "ant-design-vue";
import { Checkbox as ACheckbox } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = withDefaults(
  defineProps<{
    initialText?: string;
    initialRate?: number;
    initialIsSpoiler?: boolean;
    isEditing?: boolean;
    isSaving?: boolean;
  }>(),
  {
    initialText: "",
    initialRate: 0,
    initialIsSpoiler: false,
    isEditing: false,
    isSaving: false,
  }
);

const emit = defineEmits<{
  submit: [text: string, rate: number, isSpoiler: boolean];
  cancel: [];
}>();

const reviewForm = reactive({
  text: props.initialText,
  rate: props.initialRate,
  isSpoiler: props.initialIsSpoiler,
});

const reviewFormRef = ref<FormInstance | null>(null);

watch(
  () => [props.initialText, props.initialRate, props.initialIsSpoiler] as const,
  ([text, rate, isSpoiler]) => {
    reviewForm.text = text;
    reviewForm.rate = rate;
    reviewForm.isSpoiler = isSpoiler;
  }
);

const handleSubmit = () => {
  if (props.isSaving) return;
  emit("submit", reviewForm.text, reviewForm.rate, reviewForm.isSpoiler);
};

const resetForm = () => {
  reviewForm.text = "";
  reviewForm.rate = 0;
  reviewFormRef.value?.resetFields();
  reviewForm.isSpoiler = false;
};

defineExpose({
  resetForm,
});

const handleCancel = () => {
  if (props.isSaving) return;
  resetForm();
  emit("cancel");
};
</script>

<template>
  <a-form
    ref="reviewFormRef"
    :model="reviewForm"
    :disabled="isSaving"
    name="review-form"
    layout="vertical"
    class="review-form"
    @finish="handleSubmit"
  >
    <a-form-item label="Ваша оценка" name="rate" class="review-form__rating">
      <a-rate v-model:value="reviewForm.rate" :count="10" />
    </a-form-item>

    <a-form-item
      label="Отзыв"
      name="text"
      class="review-form__text"
      :class="{ 'review-form__text_editing': isEditing }"
    >
      <a-textarea
        v-model:value="reviewForm.text"
        size="large"
        :rows="4"
        placeholder="Расскажите о своих впечатлениях..."
        :maxlength="500"
        :show-count="true"
      />
    </a-form-item>

    <a-form-item name="isSpoiler">
      <ACheckbox v-model:checked="reviewForm.isSpoiler"
        >Содержит спойлеры</ACheckbox
      >
    </a-form-item>

    <a-form-item class="review-form__actions">
      <a-button size="large" @click="handleCancel">Отмена</a-button>
      <a-button
        type="primary"
        html-type="submit"
        size="large"
        class="review-form__submit"
        :loading="isSaving"
      >
        <BaseIcon
          :name="isEditing ? 'ph:check' : 'ph:plus'"
          :width="18"
          :height="18"
        />
        <span>{{ isEditing ? "Обновить" : "Сохранить" }}</span>
      </a-button>
    </a-form-item>
  </a-form>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.review-form {
  &__rating {
    :deep(.ant-rate) {
      font-size: 24px;
    }

    // Мобилка (эталон): звёзды растянуты по ширине — удобнее попадать пальцем
    @include mediaMax($tablet - 0.02px) {
      :deep(.ant-rate) {
        display: flex;
        justify-content: space-between;
        width: 100%;
      }

      :deep(.ant-rate-star:not(:last-child)) {
        margin-inline-end: 0;
      }
    }
  }

  &__text_editing {
    :deep(.ant-input),
    :deep(textarea.ant-input) {
      border-color: var(--fv-color-accent) !important;
    }
  }

  &__actions {
    margin-bottom: 0;

    :deep(.ant-form-item-control-input-content) {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }
  }

  &__submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
}
</style>
