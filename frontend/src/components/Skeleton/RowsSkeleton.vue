<script setup lang="ts">
import SkeletonBar from "./SkeletonBar.vue";

interface Props {
  count?: number;
  /** Показывать бейдж-пилюлю справа (очки в Топе) */
  badge?: boolean;
}

const { count = 8, badge = true } = defineProps<Props>();
</script>

<template>
  <div class="rows-skel" aria-hidden="true">
    <div v-for="index in count" :key="index" class="rows-skel__row">
      <SkeletonBar width="28px" height="28px" circle />
      <SkeletonBar width="44px" height="44px" radius="10px" />
      <div class="rows-skel__lines">
        <SkeletonBar height="13px" width="55%" radius="6px" />
        <SkeletonBar height="11px" width="32%" radius="6px" />
      </div>
      <SkeletonBar v-if="badge" width="60px" height="28px" radius="999px" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rows-skel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;

  &__row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-primary);
    border: 1px solid
      color-mix(in srgb, var(--fv-color-border) 55%, transparent);
  }

  &__lines {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
}
</style>
