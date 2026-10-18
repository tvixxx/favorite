<script lang="ts" setup>
import { useRoute, useRouter } from "vue-router";
import { reactive, ref } from "vue";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import PasswordRecoveryModal from "./PasswordRecoveryModal.vue";
import { EMAIL_REGEX } from "@/constants";
import { ERROR_LOGIN_TEXT, SUCCESS_LOGIN_TEXT } from "@/state/constants";
import { usePasswordRecoveryAvailability } from "@/composable/usePasswordRecoveryAvailability";

const store = useMainStore();
const router = useRouter();

const isResetOpen = ref(useRoute().query.recover === "1");
const { enabled: passwordRecoveryEnabled } = usePasswordRecoveryAvailability();

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
    {
      required: true,
      whitespace: true,
      message: "Введите email",
      trigger: "blur",
    },
    {
      pattern: EMAIL_REGEX,
      message: "Введите корректный email",
      trigger: "blur",
    },
  ],
  password: [
    {
      max: 128,
      message: "Пароль должен содержать не больше 128 символов",
      trigger: "blur",
    },
    {
      required: true,
      whitespace: true,
      message: "Введите пароль",
      trigger: "blur",
    },
  ],
};

// @finish срабатывает только после успешной валидации — здесь остаётся лишь запрос
const onFinish = async (values: FormState): Promise<void> => {
  try {
    await store.logIn({ email: values.email, password: values.password });
    message.success(
      `${SUCCESS_LOGIN_TEXT}, ${store.userData?.fullName || ""}!`
    );

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
      <span class="auth-form__label">Email</span>
      <a-input
        v-model:value="formState.email"
        :maxlength="254"
        placeholder="Email"
        size="large"
      >
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
        Войти
      </a-button>

      <button
        v-if="passwordRecoveryEnabled"
        type="button"
        class="auth-form__forgot"
        @click="isResetOpen = true"
      >
        Забыли пароль?
      </button>
    </a-form-item>
  </a-form>

  <PasswordRecoveryModal
    v-if="isResetOpen && passwordRecoveryEnabled"
    v-model="isResetOpen"
    :email="formState.email"
  />
</template>
