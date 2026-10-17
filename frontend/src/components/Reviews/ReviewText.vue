<script setup lang="ts">
import { ref, useId, watch } from "vue";
import { Button as AButton } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = defineProps<{
  reviewId: string;
  text: string;
  isSpoiler?: boolean;
}>();
const revealed = ref(false);
const textId = useId();

watch(
  () => [props.reviewId, props.text, props.isSpoiler],
  () => {
    revealed.value = false;
  }
);
</script>

<template>
  <div class="review-text">
    <div v-if="isSpoiler" class="review-text__warning">
      <span>Спойлер</span>
      <span aria-hidden="true">·</span>
      <AButton
        type="text"
        size="small"
        class="review-text__toggle"
        :aria-label="revealed ? 'Скрыть спойлер' : 'Показать спойлер'"
        :aria-expanded="revealed"
        :aria-controls="textId"
        @click="revealed = !revealed"
      >
        <BaseIcon
          class="review-text__icon"
          :name="revealed ? 'ph:eye-slash' : 'ph:eye'"
          :width="16"
          :height="16"
          aria-hidden="true"
        />
        <span>{{ revealed ? "Скрыть" : "Показать" }}</span>
      </AButton>
    </div>
    <div :id="textId">
      <p v-if="!isSpoiler || revealed" class="review-text__body">{{ text }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.review-text {
  &__warning {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 32px;
    height: auto;
    padding: 4px 6px;
    color: var(--fv-color-text-primary);
    font-size: inherit;
    line-height: 20px;
  }

  &__icon {
    flex-shrink: 0;
    color: var(--fv-color-accent);
    transform: translateY(-1px);
  }

  &__body {
    margin: 0;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  &__warning + div > &__body {
    margin-top: 12px;
  }
}
</style>
