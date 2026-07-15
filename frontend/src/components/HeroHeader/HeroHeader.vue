<script lang="ts" setup>
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  title: string;
  subtitle?: string;
  badgeText?: string;
  /** Оставлен для совместимости; в eyebrow не выводится (эталон: счётчик — в subtitle) */
  badgeCount?: number;
  iconName?: string;
  // Если задан tone — слева рендерится цветной icon-badge (Избранное/Топ и т.п.)
  iconTone?: "negative" | "warning" | "accent" | "positive";
}

defineProps<Props>();
</script>

<template>
  <div class="hero-header">
    <section class="hero-header__card">
      <div
        v-if="iconTone && iconName"
        class="hero-header__badge"
        :class="`hero-header__badge--${iconTone}`"
      >
        <BaseIcon :name="iconName" :width="28" :height="28" />
      </div>

      <div class="hero-header__text">
        <p v-if="badgeText" class="hero-header__eyebrow">{{ badgeText }}</p>
        <h1 v-if="title" class="hero-header__title">{{ title }}</h1>
        <p v-if="subtitle" class="hero-header__subtitle">{{ subtitle }}</p>
      </div>

      <div v-if="$slots.aside" class="hero-header__aside">
        <slot name="aside" />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/layout" as *;
@use "@/styles/media" as *;

.hero-header {
  @include pageContentContainer;
  margin-top: 1.75rem;
  margin-bottom: 1.5rem;

  &__card {
    display: flex;
    align-items: center;
    gap: 24px;
    width: 100%;
    text-align: left;
    padding: 1.75rem 2rem;
    border-radius: var(--fv-radius-lg);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-card);
    border: 1px solid color-mix(in srgb, var(--fv-color-border) 55%, transparent);

    @include mediaMax(640px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      padding: 1.5rem;
    }
  }

  &__badge {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 16px;

    &--negative {
      background: var(--fv-color-negative-soft);
      color: var(--fv-color-brand);
    }

    &--warning {
      background: var(--fv-color-warning-soft);
      color: color-mix(
        in srgb,
        var(--fv-color-warning) 55%,
        var(--fv-color-text-primary)
      );
    }

    &--accent {
      background: var(--fv-color-accent-soft);
      color: var(--fv-color-accent);
    }

    &--positive {
      background: var(--fv-color-positive-soft);
      color: var(--fv-color-positive);
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__eyebrow {
    margin: 0 0 8px;
    font-family: var(--fv-font-display);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.6rem, 3.5vw, 2.2rem);
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--fv-color-text-primary);
  }

  &__subtitle {
    margin: 8px 0 0;
    max-width: 640px;
    font-size: clamp(0.95rem, 2vw, 1.05rem);
    font-weight: 400;
    color: var(--fv-color-text-secondary);
  }

  &__aside {
    flex-shrink: 0;

    @include mediaMax(640px) {
      width: 100%;
    }
  }
}
</style>
