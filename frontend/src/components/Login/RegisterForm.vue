<script lang="ts" setup>
import { useMainStore } from "@/state/state";
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
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

// Полевая валидация Ant → inline-ошибки под полем + aria-invalid + красная рамка
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
  <a-form
    class="auth-form"
    :model="formState"
    :rules="rules"
    name="register-form"
    autocomplete="off"
    @finish="onFinish"
  >
    <a-form-item name="name">
      <span class="auth-form__label">Ваше имя</span>
      <a-input
        v-model:value="formState.name"
        placeholder="Ваше имя"
        size="large"
      >
        <template #prefix>
          <BaseIcon name="ph:user" :width="20" :height="20" />
        </template>
      </a-input>
    </a-form-item>

    <a-form-item name="email">
      <span class="auth-form__label">Email</span>
      <a-input v-model:value="formState.email" placeholder="Email" size="large">
        <template #prefix>
          <BaseIcon name="ph:envelope-simple" :width="20" :height="20" />
        </template>
      </a-input>
    </a-form-item>

    <a-form-item name="password">
      <span class="auth-form__label">Пароль</span>
      <a-input-password
        v-model:value="formState.password"
        placeholder="Пароль"
        size="large"
      >
        <template #prefix>
          <BaseIcon name="ph:lock-simple" :width="20" :height="20" />
        </template>
      </a-input-password>
    </a-form-item>

    <a-form-item>
      <a-button
        type="primary"
        html-type="submit"
        class="auth-form__submit"
        size="large"
      >
        Зарегистрироваться
      </a-button>
    </a-form-item>
  </a-form>
</template>
