<script setup lang="ts">
import SkeletonBar from "./SkeletonBar.vue";
</script>

<template>
  <div class="detail-skel" aria-hidden="true">
    <div class="detail-skel__poster">
      <SkeletonBar aspect="2 / 3" radius="var(--fv-radius-lg)" />
    </div>

    <div class="detail-skel__info">
      <SkeletonBar height="34px" width="70%" radius="8px" />

      <div class="detail-skel__chips">
        <SkeletonBar width="72px" height="28px" radius="999px" />
        <SkeletonBar width="92px" height="28px" radius="999px" />
        <SkeletonBar width="60px" height="28px" radius="999px" />
      </div>

      <SkeletonBar height="14px" width="100%" radius="6px" />
      <SkeletonBar height="14px" width="94%" radius="6px" />
      <SkeletonBar height="14px" width="80%" radius="6px" />

      <div class="detail-skel__actions">
        <SkeletonBar width="200px" height="46px" radius="var(--fv-radius-sm)" />
        <SkeletonBar width="120px" height="46px" radius="var(--fv-radius-sm)" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.detail-skel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  margin: 1.5rem 0;

  @include mediaTablet {
    flex-direction: row;
    align-items: flex-start;
  }

  &__poster {
    flex-shrink: 0;
    width: 100%;
    max-width: 280px;

    @include mediaMax(767px) {
      max-width: 220px;
      margin: 0 auto;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
  }
}
</style>
