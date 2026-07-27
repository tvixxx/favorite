<script setup lang="ts">
import { ref } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import RegisterForm from "@/components/Login/RegisterForm.vue";
import SigninForm from "@/components/Login/SigninForm.vue";

/**
 * Экран входа/регистрации (эталон): логотип, карточка 400px и сегмент-переключатель
 * «Вход | Регистрация» внутри карточки — вместо кнопки-переключателя над формой.
 */

type AuthMode = "login" | "register";

const mode = ref<AuthMode>("login");
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__inner">
      <div class="auth-page__brand">
        <span class="auth-page__brand-mark">
          <BaseIcon name="ph:film-slate-fill" :width="22" :height="22" />
        </span>
        <span class="auth-page__brand-text">favorite</span>
      </div>

      <div class="auth-page__card">
        <div class="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="auth-tabs__btn"
            :class="{ 'auth-tabs__btn--on': mode === 'login' }"
            :aria-selected="mode === 'login'"
            @click="mode = 'login'"
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            class="auth-tabs__btn"
            :class="{ 'auth-tabs__btn--on': mode === 'register' }"
            :aria-selected="mode === 'register'"
            @click="mode = 'register'"
          >
            Регистрация
          </button>
        </div>

        <RegisterForm v-if="mode === 'register'" />
        <SigninForm v-else />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--fv-color-bg-secondary);
  // #app центрирует текст глобально — внутри выравниваем сами
  text-align: left;

  &__inner {
    width: 100%;
    max-width: 400px;
  }

  &__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 28px;
  }

  &__brand-mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--fv-color-brand);
    color: #fff;
  }

  &__brand-text {
    font-family: var(--fv-font-display);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.4px;
    color: var(--fv-color-text-primary);
  }

  &__card {
    padding: 30px;
    border-radius: var(--fv-radius-lg);
    background: var(--fv-color-bg-primary);
    box-shadow: var(--fv-shadow-low);

    @media (max-width: 480px) {
      padding: 22px;
    }
  }
}

/* Сегмент «Вход | Регистрация» (эталон .authtab) */
.auth-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 26px;
  border-radius: 12px;
  background: var(--fv-color-bg-secondary);

  &__btn {
    flex: 1;
    height: 42px;
    border: none;
    border-radius: 10px;
    background: transparent;
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &--on {
      background: var(--fv-color-bg-primary);
      box-shadow: var(--fv-shadow-low);
      color: var(--fv-color-text-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: -2px;
    }
  }
}

/* Поля и кнопка обеих форм (эталон .fld 52px / .btnp) */
.auth-form {
  .ant-form-item {
    margin-bottom: 14px;
  }

  .ant-input-affix-wrapper {
    height: 52px;
    padding: 0 14px;
  }

  .ant-input-prefix {
    margin-inline-end: 10px;
    color: var(--fv-color-text-tertiary);
  }

  &__submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 52px;
    margin-top: 8px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
  }
}
</style>
