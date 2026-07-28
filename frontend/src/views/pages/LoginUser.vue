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
      <p class="auth-page__tagline">Ваша личная медиатека</p>

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

  &__inner {
    width: 100%;
    max-width: 400px;
  }

  &__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  &__tagline {
    margin: 4px 0 28px;
    text-align: center;
    font-size: 14px;
    color: var(--fv-color-text-secondary);
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
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease);

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
    padding: 0 16px;
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
    border-radius: var(--fv-radius-control);
    font-size: 16px;
    font-weight: 500;
  }

  // Лейблы над полями есть только в мобильном макете, на десктопе — плейсхолдеры
  &__label {
    display: none;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__forgot {
    display: block;
    width: 100%;
    margin-top: 14px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fv-color-link);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    cursor: pointer;
  }
}

/* Мобильный макет эталона: белый экран без карточки, крупная app-иконка,
   лейблы над полями */
@media (max-width: 767.98px) {
  .auth-page {
    align-items: center;
    padding: 24px;
    background: var(--fv-color-bg-primary);

    &__brand {
      flex-direction: column;
      gap: 0;
    }

    &__brand-mark {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      border-radius: 18px;

      svg {
        width: 34px;
        height: 34px;
      }
    }

    &__brand-text {
      font-size: 26px;
    }

    &__card {
      padding: 0;
      background: none;
      box-shadow: none;
    }
  }

  .auth-tabs {
    margin-bottom: 20px;
  }

  .auth-form {
    .ant-form-item {
      margin-bottom: 14px;
    }

    .ant-input-affix-wrapper {
      height: 50px;
      padding: 0 15px;
    }

    &__label {
      display: block;
    }
  }
}
</style>
