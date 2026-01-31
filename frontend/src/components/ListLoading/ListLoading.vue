<script setup lang="ts">
import { computed } from "vue";

interface Props {
  loadingText?: string;
  size: "large" | "medium" | "small";
  center: boolean;
}

const props = defineProps<Props>();

const tip = computed(() => props.loadingText ?? "Загружаем...");
</script>

<template>
  <div class="list-loading" :class="{ 'list-loading_center': center }">
    <div class="list-loading__container">
      <div class="list-loading__spinner">
        <a-spin :size="size" :tip="tip" />
      </div>
      <div class="list-loading__shine"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.list-loading {
  min-height: 50vh;
  position: relative;
  width: 100%;
  padding: 2rem;

  &_center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__container {
    position: relative;
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  &__spinner {
    position: relative;
    z-index: 2;
    padding: 2rem;
  }

  &__spinner {
    .ant-spin-dot-item {
      background-color: var(--ant-color-primary) !important;
    }

    .ant-spin-text {
      color: var(--text-primary) !important;
      font-weight: 500 !important;
      font-size: 1.1rem !important;
    }
  }

  &__shine {
    position: absolute;
    top: -2rem;
    left: -2rem;
    right: -2rem;
    bottom: -2rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--text-primary) 15%, transparent) 0%,
      transparent 50%,
      color-mix(in srgb, var(--ant-color-primary) 12%, transparent) 100%
    );
    border-radius: 24px;
    border: 1px solid
      color-mix(in srgb, var(--ant-color-primary) 20%, transparent);
    opacity: 0.5;
    animation: list-loading-shine 3s ease-in-out infinite;
    z-index: 1;
  }

  @keyframes list-loading-shine {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1) rotate(0deg);
    }
    33% {
      opacity: 0.8;
      transform: scale(1.03) rotate(1deg);
    }
    66% {
      opacity: 0.6;
      transform: scale(1.01) rotate(-1deg);
    }
  }

  @include mediaTablet {
    padding: 3rem;

    &__container {
      max-width: 500px;
    }
  }

  @include mediaDesktopXS {
    &__container {
      max-width: 550px;
    }
  }

  @include mediaMobile {
    padding: 1.5rem;

    &__container {
      max-width: 320px;
    }

    &__spinner {
      padding: 1.5rem;
    }
  }
}
</style>
