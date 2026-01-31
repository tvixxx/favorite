<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { computed } from "vue";

interface Props {
  heroIcon: string;
  description: string;
  btnSize: "small" | "medium" | "large";
  btnType: string;
  btnHandler: () => void;
  btnText: string;
  btnIcon: string;
}

const props = defineProps<Props>();

const desc = computed(() => props.description ?? "Ничего нет...");
const heroIcon = computed(() => props.heroIcon ?? "mdi:heart-off");
const iconBtn = computed(() => props.btnIcon ?? "mdi:movie");
const sizeBtn = computed(() => props.btnSize ?? "large");
</script>

<template>
  <div class="list-empty">
    <div class="list-empty__hero-icon-wrapper">
      <BaseIcon :name="heroIcon" class="list-empty__hero-icon" />
    </div>
    <a-empty :description="desc">
      <template #footer>
        <a-button
          :type="btnType ?? 'primary'"
          @click="btnHandler"
          :size="sizeBtn"
        >
          <BaseIcon :name="iconBtn" />
          <template v-if="btnText">
            {{ btnText }}
          </template>
        </a-button>
      </template>
    </a-empty>
  </div>
</template>

<style lang="scss" scoped>
.list-empty {
  &__hero-icon-wrapper {
  }

  &__hero-icon {
  }
}
</style>
