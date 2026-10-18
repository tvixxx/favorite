<script setup lang="ts">
import SkeletonBar from "./SkeletonBar.vue";

interface Props {
  /** Сколько карточек-плейсхолдеров (≈ размеру страницы) */
  count?: number;
  /** poster — сетка постеров 2/3; avatar — сетка круглых аватаров (актёры) */
  variant?: "poster" | "avatar";
  /** min ширины колонки (совпадает с реальной сеткой экрана) */
  minWidth?: number;
}

const { count = 12, variant = "poster", minWidth = 178 } = defineProps<Props>();
</script>

<template>
  <div
    class="poster-grid-skel"
    :class="`poster-grid-skel--${variant}`"
    :style="{
      '--poster-grid-min-width': `${minWidth}px`,
    }"
    aria-hidden="true"
  >
    <div v-for="index in count" :key="index" class="poster-grid-skel__card">
      <template v-if="variant === 'avatar'">
        <SkeletonBar
          width="var(--actor-avatar-size, 88px)"
          height="var(--actor-avatar-size, 88px)"
          circle
        />
        <div class="poster-grid-skel__actor-name">
          <SkeletonBar height="12px" width="70%" radius="6px" />
        </div>
      </template>
      <template v-else>
        <SkeletonBar aspect="2 / 3" radius="var(--fv-radius-md)" />
        <SkeletonBar height="12px" width="80%" radius="6px" />
        <SkeletonBar height="10px" width="55%" radius="6px" />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/media" as *;

.poster-grid-skel {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--poster-grid-min-width), 1fr)
  );
  gap: 24px;
  width: 100%;
  margin: 2rem 0; // как cardsGrid — совпадает с отступом загруженной сетки

  @include mediaMax(640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  // Актёры: отступ как у .actors-grid
  &--avatar {
    margin: 0.5rem 0 2rem;
    gap: 20px;

    @include mediaMax(640px) {
      grid-template-columns: repeat(
        auto-fill,
        minmax(var(--poster-grid-min-width), 1fr)
      );
    }

    @include mediaMax(500px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      --actor-avatar-size: 52px;
      gap: 12px;
    }
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__actor-name {
    display: flex;
    justify-content: center;
    width: 100%;
    min-height: 1.25em;
    font-size: 0.95rem;

    @include mediaMax(500px) {
      font-size: 13px;
      min-height: 2.6em;
    }
  }

  &--avatar &__card {
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-primary);
    border: 1px solid
      color-mix(in srgb, var(--fv-color-border) 55%, transparent);

    @include mediaMax(500px) {
      padding: 16px 12px;
      gap: 8px;
    }
  }
}
</style>
