<script lang="ts" setup>
import { useRouter } from "vue-router";
import { reactive } from "vue";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
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

// Полевая валидация Ant → inline-ошибки под полем + aria-invalid + красная рамка
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
  <a-form
    class="auth-form"
    :model="formState"
    :rules="rules"
    name="login-form"
    autocomplete="off"
    @finish="onFinish"
  >
    <a-form-item name="email">
      <a-input v-model:value="formState.email" placeholder="Email" size="large">
        <template #prefix>
          <BaseIcon name="ph:envelope-simple" :width="20" :height="20" />
        </template>
      </a-input>
    </a-form-item>

    <a-form-item name="password">
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
        Войти
      </a-button>
    </a-form-item>
  </a-form>
</template>
