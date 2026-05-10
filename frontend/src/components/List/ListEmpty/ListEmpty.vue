<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  btnHandler?: () => void;
  heroIcon?: string;
  description?: string;
  btnSize?: "small" | "medium" | "large";
  btnType?: string;
  btnText?: string;
  btnIcon?: string;
}

const {
  heroIcon = "mdi:heart-off",
  btnIcon = "mdi:movie",
  btnSize = "large",
  btnType = "primary",
} = defineProps<Props>();
</script>

<template>
  <div class="list-empty">
    <div class="list-empty__hero-icon-wrapper">
      <BaseIcon :name="heroIcon" class="list-empty__hero-icon" />
    </div>
    <a-empty :description="description"></a-empty>
    <a-button
      v-if="btnText && btnHandler"
      class="list-empty__btn"
      :type="btnType"
      :size="btnSize"
      @click="btnHandler"
    >
      <BaseIcon :name="btnIcon" class="list-empty__btn-icon" />
      <span class="list-empty__btn-text">{{ btnText }}</span>
    </a-button>
  </div>
</template>

<style lang="scss" scoped>
.list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__btn-icon + &__btn-text {
    margin-left: 8px;
  }
}
</style>
