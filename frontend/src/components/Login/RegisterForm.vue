<script lang="ts" setup>
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { Icon } from "@iconify/vue";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import { EMAIL_REGEX, PASSWORD_REGEX } from "@/constants";
import { ERROR_REGISTRATION_TEXT } from "@/state/constants";

const store = useMainStore();
const router = useRouter();

interface FormState {
  name: string;
  email: string;
  password: string;
}

const formState = reactive<FormState>({
  name: "",
  email: "",
  password: "",
});

// Полевая валидация Ant → inline-ошибки под полем + aria-invalid + красная рамка (forms.scss)
const rules: Record<string, Rule[]> = {
  name: [
    { required: true, whitespace: true, message: "Введите имя", trigger: "blur" },
  ],
  email: [
    { required: true, whitespace: true, message: "Введите email", trigger: "blur" },
    { pattern: EMAIL_REGEX, message: "Введите корректный email", trigger: "blur" },
  ],
  password: [
    { required: true, whitespace: true, message: "Введите пароль", trigger: "blur" },
    {
      pattern: PASSWORD_REGEX,
      message: "Минимум 6 символов, включая буквы и цифры",
      trigger: "blur",
    },
  ],
};

// @finish срабатывает только после успешной валидации — здесь остаётся лишь запрос
const onFinish = async (values: FormState): Promise<void> => {
  try {
    await store.register({
      email: values.email,
      password: values.password,
      name: values.name,
    });
    message.success("Регистрация прошла успешно!");
    router.push("/library/collection");
  } catch {
    message.error(ERROR_REGISTRATION_TEXT);
  }
};
</script>

<template>
  <div class="register">
    <div class="register__container">
      <div class="register__header">
        <h1 class="register__title">
          <Icon icon="ph:user-plus" class="register__title-icon" />
          Регистрация
        </h1>
      </div>

      <a-form
        class="register__form"
        :model="formState"
        :rules="rules"
        name="register-form"
        autocomplete="off"
        @finish="onFinish"
      >
        <a-form-item name="name" class="register__field">
          <template #label>
            <Icon icon="ph:user" class="register__field-icon" />
            Имя
          </template>
          <a-input
            v-model:value="formState.name"
            placeholder="Введите имя"
            size="large"
          />
        </a-form-item>

        <a-form-item name="email" class="register__field">
          <template #label>
            <Icon icon="ph:envelope-simple" class="register__field-icon" />
            Email
          </template>
          <a-input
            v-model:value="formState.email"
            placeholder="Введите email"
            size="large"
          />
        </a-form-item>

        <a-form-item name="password" class="register__field">
          <template #label>
            <Icon icon="ph:lock-simple" class="register__field-icon" />
            Пароль
          </template>
          <a-input-password
            v-model:value="formState.password"
            placeholder="Введите пароль"
            size="large"
          />
        </a-form-item>

        <a-form-item class="register__submit">
          <a-button type="primary" html-type="submit" size="large" block>
            Зарегистрироваться
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<style lang="scss">
@use "../../styles/media" as *;
@use "@/styles/auth" as *;

.register {
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
    @include authTitle("register");
  }

  @include authAntForm("register");

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
