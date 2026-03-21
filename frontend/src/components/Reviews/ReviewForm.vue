<script lang="ts" setup>
import { reactive, ref, watch } from "vue";
import type { FormInstance } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = withDefaults(
  defineProps<{
    initialText?: string;
    initialRate?: number;
    isEditing?: boolean;
  }>(),
  {
    initialText: "",
    initialRate: 0,
    isEditing: false,
  }
);

const emit = defineEmits<{
  submit: [text: string, rate: number];
  cancel: [];
}>();

const reviewForm = reactive({
  text: props.initialText,
  rate: props.initialRate,
});

const reviewFormRef = ref<FormInstance | null>(null);

watch(
  () => [props.initialText, props.initialRate],
  ([text, rate]) => {
    reviewForm.text = text as string;
    reviewForm.rate = rate as number;
  }
);

const handleSubmit = () => {
  emit("submit", reviewForm.text, reviewForm.rate);

  if (!props.isEditing) {
    resetForm();
  }
};

const resetForm = () => {
  reviewForm.text = "";
  reviewForm.rate = 0;
  reviewFormRef.value?.resetFields();
};

const handleCancel = () => {
  resetForm();
  emit("cancel");
};
</script>

<template>
  <a-form
    ref="reviewFormRef"
    :model="reviewForm"
    name="review-form"
    layout="vertical"
    class="review-form"
    @finish="handleSubmit"
  >
    <a-form-item label="Ваш рейтинг" name="rate" class="review-form__rating">
      <a-rate v-model:value="reviewForm.rate" :count="10" />
    </a-form-item>

    <a-form-item label="Отзыв" name="text">
      <a-textarea
        v-model:value="reviewForm.text"
        size="large"
        :rows="4"
        placeholder="Расскажите о своих впечатлениях от фильма..."
        :maxlength="500"
        :show-count="true"
      />
    </a-form-item>

    <a-form-item class="review-form__actions">
      <a-button size="large" @click="handleCancel">
        {{ isEditing ? "Отменить редактирование" : "Отмена" }}
      </a-button>
      <a-button
        type="primary"
        html-type="submit"
        size="large"
        class="review-form__submit"
      >
        <BaseIcon
          :name="isEditing ? 'mdi:check' : 'mdi:plus'"
          :width="18"
          :height="18"
        />
        <span>{{ isEditing ? "Обновить" : "Сохранить" }}</span>
      </a-button>
    </a-form-item>
  </a-form>
</template>

<style scoped lang="scss">
.review-form {
  &__rating {
    :deep(.ant-rate) {
      font-size: 24px;
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
