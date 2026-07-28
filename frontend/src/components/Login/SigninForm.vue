<script lang="ts" setup>
import { useRouter } from "vue-router";
import { reactive, ref } from "vue";
import { useMainStore } from "@/state/state";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import { SUPPORT_EMAIL } from "@/constants";
import { EMAIL_REGEX } from "@/constants";
import { ERROR_LOGIN_TEXT, SUCCESS_LOGIN_TEXT } from "@/state/constants";

const store = useMainStore();
const router = useRouter();

// Восстановления пароля на бэкенде нет — отправляем в поддержку
const isResetOpen = ref(false);

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
        Войти
      </a-button>

      <button
        type="button"
        class="auth-form__forgot"
        @click="isResetOpen = true"
      >
        Забыли пароль?
      </button>
    </a-form-item>
  </a-form>

  <BaseModal v-model="isResetOpen" layout="form">
    <template #title>Забыли пароль?</template>
    <template #body>
      <p class="auth-reset__text">
        Восстановление пока настраиваем. Напишите на
        <a :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a> — вернём
        доступ вручную.
      </p>
    </template>
    <template #footer>
      <a-button type="primary" @click="isResetOpen = false">Понятно</a-button>
    </template>
  </BaseModal>
</template>

<style lang="scss" scoped>
.auth-reset__text {
  margin: 0;
  padding: 4px 0 8px;
  font-size: 15px;
  line-height: 22px;
  color: var(--fv-color-text-secondary);

  a {
    color: var(--fv-color-link);
  }
}
</style>
