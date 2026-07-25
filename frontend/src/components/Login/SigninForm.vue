<script lang="ts" setup>
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { useMainStore } from "@/state/state";
import { Icon } from "@iconify/vue";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import { EMAIL_REGEX } from "@/constants";
import { ERROR_LOGIN_TEXT, SUCCESS_LOGIN_TEXT } from "@/state/constants";

const store = useMainStore();
const router = useRouter();

interface FormState {
  email: string;
  password: string;
}

const formState = reactive<FormState>({
  email: "",
  password: "",
});

// Полевая валидация Ant → inline-ошибки под полем + aria-invalid + красная рамка (forms.scss)
const rules: Record<string, Rule[]> = {
  email: [
    { required: true, whitespace: true, message: "Введите email", trigger: "blur" },
    { pattern: EMAIL_REGEX, message: "Введите корректный email", trigger: "blur" },
  ],
  password: [
    { required: true, whitespace: true, message: "Введите пароль", trigger: "blur" },
  ],
};

// @finish срабатывает только после успешной валидации — здесь остаётся лишь запрос
const onFinish = async (values: FormState): Promise<void> => {
  try {
    await store.logIn({ email: values.email, password: values.password });
    message.success(`${SUCCESS_LOGIN_TEXT}, ${store.userData?.fullName || ""}!`);
    router.push("/library/collection");
  } catch {
    message.error(ERROR_LOGIN_TEXT);
  }
};
</script>

<template>
  <div class="signin">
    <div class="signin__container">
      <div class="signin__header">
        <h1 class="signin__title">
          <Icon icon="stash:signin" class="signin__title-icon" />
          Вход
        </h1>
      </div>

      <a-form
        class="signin__form"
        :model="formState"
        :rules="rules"
        name="login-form"
        autocomplete="off"
        @finish="onFinish"
      >
        <a-form-item name="email" class="signin__field">
          <template #label>
            <Icon icon="ph:envelope-simple" class="signin__field-icon" />
            Email
          </template>
          <a-input
            v-model:value="formState.email"
            placeholder="Введите email"
            size="large"
          />
        </a-form-item>

        <a-form-item name="password" class="signin__field">
          <template #label>
            <Icon icon="ph:lock-simple" class="signin__field-icon" />
            Пароль
          </template>
          <a-input-password
            v-model:value="formState.password"
            placeholder="Введите пароль"
            size="large"
          />
        </a-form-item>

        <a-form-item class="signin__submit">
          <a-button type="primary" html-type="submit" size="large" block>
            Войти
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<style lang="scss">
@use "../../styles/media" as *;
@use "@/styles/auth" as *;

.signin {
  @include authShell;

  &__container {
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
  }

  &__header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  &__title {
    @include authTitle("signin");
  }

  @include authAntForm("signin");

  &__submit {
    margin-bottom: 0 !important;

    :deep(.ant-btn-primary) {
      height: 52px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(
        135deg,
        var(--fv-color-brand),
        color-mix(in srgb, var(--fv-color-brand), #000 15%)
      );
      font-weight: 600;
      font-size: 1rem;
      box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(24, 144, 255, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  &__field-icon {
    color: var(--fv-color-accent);
    width: 20px;
    height: 20px;
    margin-right: 0.5rem;
  }

  @include mediaTablet {
    padding: 3rem 2rem;

    &__container {
      max-width: 480px;
    }
  }

  @include mediaDesktopXS {
    padding: 4rem 3rem;

    &__container {
      max-width: 500px;
    }
  }
}
</style>
