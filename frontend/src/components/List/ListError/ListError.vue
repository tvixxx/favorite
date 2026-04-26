<script setup lang="ts">
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

interface Props {
  isError: string | null;
  repeatFn: () => void;
  repeatText: string;
}

defineProps<Props>();
</script>

<template>
  <div class="list-error">
    <div class="list-error__container">
      <BaseIcon name="mdi:alert-circle-outline" class="list-error__icon" />
      <h2 class="list-error__title">Ошибка загрузки</h2>
      <p class="list-error__message">{{ isError }}</p>
      <a-button
        type="primary"
        size="large"
        @click="repeatFn"
        class="list-error__button"
      >
        <BaseIcon name="mdi:refresh" />
        {{ repeatText }}
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/card" as *;
@use "../../../styles/media" as *;

.list-error {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  width: 100%;

  &__container {
    @include elevatedPanel(
      var(--radius-lg),
      var(--shadow-elevated),
      1px solid color-mix(in srgb, var(--border-color) 50%, transparent)
    );
    padding: 3rem 2.5rem;
    max-width: 500px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
  }

  &__icon {
    width: 72px;
    height: 72px;
    color: var(--ant-color-primary);
    margin-bottom: 1.5rem;
  }

  &__title {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    line-height: 1.2;
  }

  &__message {
    font-size: clamp(1rem, 2.5vw, 1.2rem);
    color: var(--text-secondary);
    margin: 0 0 2rem 0;
    line-height: 1.5;
    max-width: 400px;
  }

  &__button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ant-color-primary) !important;
    border-color: var(--ant-color-primary) !important;
    color: white !important;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.875rem 2rem !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: var(--shadow-primary-sm);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 90%,
        transparent
      ) !important;
      border-color: var(--ant-color-primary) !important;
      transform: translateY(-2px);
      box-shadow: var(--shadow-primary-md);
    }

    svg {
      margin-right: 0.5rem;
      width: 18px;
      height: 18px;
    }
  }

  @include mediaTablet {
    padding: 3rem;

    &__container {
      padding: 3.5rem 3rem;
      max-width: 600px;
    }
  }

  @include mediaDesktopXS {
    &__container {
      padding: 4rem 3.5rem;
      max-width: 650px;
    }
  }

  @include mediaMobile {
    padding: 1.5rem;

    &__container {
      padding: 2rem 1.5rem;
      border-radius: 20px;
    }

    &__icon {
      width: 56px;
      height: 56px;
      margin-bottom: 1rem;
    }
  }
}
</style>
