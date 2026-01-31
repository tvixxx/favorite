<script lang="ts" setup>
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeCount?: number;
  iconName?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="hero-header">
    <div class="hero-header__overlay"></div>
    <div class="hero-header__content">
      <div v-if="badgeText" class="hero-header__badge">
        <BaseIcon
          :name="iconName || 'mdi:star'"
          class="hero-header__badge-icon"
        />
        <span>{{ badgeText }}</span>
        <span v-if="badgeCount" class="hero-header__badge-count"
          >({{ badgeCount }})</span
        >
      </div>
      <h1 v-if="title" class="hero-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="hero-header__subtitle">{{ subtitle }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hero-header {
  position: relative;
  height: 30vh;
  min-height: 200px;
  display: flex;
  align-items: center;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ant-color-primary) 40%, transparent) 0%,
    transparent 70%
  );

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at center,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0.6) 100%
    );
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0, 0, 0, 0.8) 100%
    );
  }

  &__content {
    position: relative;
    z-index: 2;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    width: 100%;
  }

  &__badge {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(20px);
    padding: 0.5rem 1.25rem;
    border-radius: 50px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    font-size: 1rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.75rem;
    max-width: max-content;

    &__count {
      background: rgba(255, 255, 255, 0.2);
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      font-size: 0.85rem;
    }
  }

  &__badge-icon {
    width: 24px;
    height: 24px;
  }

  &__title {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 700;
    background: linear-gradient(
      135deg,
      white 0%,
      rgba(255, 255, 255, 0.8) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.5rem 0;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  &__subtitle {
    font-size: clamp(1rem, 2vw, 1.3rem);
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
    font-weight: 300;
    max-width: 500px;
  }
}
</style>
