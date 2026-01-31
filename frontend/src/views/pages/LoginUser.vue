<script setup lang="ts">
import { ref } from "vue";
import RegisterForm from "@/components/RegisterForm.vue";
import SigninForm from "@/components/SigninForm.vue";

const showRegisterTemplate = ref(false);
const regText = "Зарегистрироваться?";
const signInText = "Войти?";

const changeView = (): void => {
  showRegisterTemplate.value = !showRegisterTemplate.value;
};
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__toggle">
      <a-button
        class="auth-page__toggle-btn"
        size="large"
        :type="showRegisterTemplate ? 'default' : 'primary'"
        @click="changeView"
      >
        {{ showRegisterTemplate ? signInText : regText }}
      </a-button>
    </div>

    <div v-if="showRegisterTemplate" class="auth-page__form-wrapper">
      <RegisterForm />
    </div>
    <div v-if="!showRegisterTemplate" class="auth-page__form-wrapper">
      <SigninForm />
    </div>
  </div>
</template>

<style lang="scss">
@use "../../styles/screen-sizes" as *;
@use "../../styles/media" as *;

.auth-page {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    var(--bg-primary) 0%,
    var(--bg-secondary) 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  gap: 2rem;

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 420px;
  }

  &__toggle-btn {
    width: 100%;
    height: 52px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;

    :deep(.ant-btn-primary) {
      background: linear-gradient(
        135deg,
        var(--ant-color-primary),
        color-mix(in srgb, var(--ant-color-primary), #000 15%)
      );
      border: none;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(24, 144, 255, 0.4);
      }
    }

    :deep(.ant-btn-default:hover) {
      border-color: var(--ant-color-primary);
    }
  }

  &__form-wrapper {
    width: 100%;
    max-width: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @include mediaMobileXL {
    padding: 1rem 0.75rem;
    gap: 1.5rem;

    &__toggle-btn {
      height: 48px;
      font-size: 0.95rem;
    }
  }

  @include mediaTablet {
    padding: 2rem 1.5rem;
    gap: 2.5rem;

    &__form-wrapper {
      max-width: 480px;
    }
  }

  @include mediaDesktopXS {
    padding: 3rem 2rem;
    gap: 3rem;

    &__form-wrapper {
      max-width: 500px;
    }
  }
}
</style>
