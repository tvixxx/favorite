<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { computed } from "vue";

interface Props {
  btnHandler: () => void;
  heroIcon?: string;
  description?: string;
  btnSize?: "small" | "medium" | "large";
  btnType?: string;
  btnText: string;
  btnIcon?: string;
}

const props = defineProps<Props>();

const heroIcon = computed(() => props.heroIcon ?? "mdi:heart-off");
const iconBtn = computed(() => props.btnIcon ?? "mdi:movie");
const sizeBtn = computed(() => props.btnSize ?? "large");
const btnType = computed(() => props.btnType ?? "primary");
</script>

<template>
  <div class="list-empty">
    <div class="list-empty__hero-icon-wrapper">
      <BaseIcon :name="heroIcon" class="list-empty__hero-icon" />
    </div>
    <a-empty :description="description"></a-empty>
    <a-button
      v-if="btnText"
      :type="btnType"
      @click="btnHandler"
      :size="sizeBtn"
      class="list-empty__btn"
    >
      <BaseIcon :name="iconBtn" class="list-empty__btn-icon" />
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
