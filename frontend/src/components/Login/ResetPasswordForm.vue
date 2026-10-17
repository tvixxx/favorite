<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Button as AButton,
  InputPassword as AInputPassword,
} from "ant-design-vue";
import api from "@/services/api";
import { useMainStore } from "@/state/state";
import { friendlyRequestError } from "@/utils/friendlyError";
import { createRequestGuard } from "@/utils/requestGuard";
import PasswordRecoveryModal from "./PasswordRecoveryModal.vue";
import { usePasswordRecoveryAvailability } from "@/composable/usePasswordRecoveryAvailability";

const route = useRoute();
const router = useRouter();
const store = useMainStore();
const { enabled: passwordRecoveryEnabled, checking, failed, load } = usePasswordRecoveryAvailability();
const token = computed(() => {
  const params = new URLSearchParams(route.hash.slice(1));
  const value = params.get("token") ?? "";

  return [...params.keys()].length === 1 && /^[a-f0-9]{64}$/.test(value)
    ? value
    : "";
});
const password = ref("");
const confirmation = ref("");
const busy = ref(false);
const done = ref(false);
const error = ref("");
const recoveryOpen = ref(false);
const requests = createRequestGuard();
let controller: AbortController | undefined;
watch(
  () => route.hash,
  () => {
    requests.invalidate();
    controller?.abort();
    busy.value = false;
    password.value = "";
    confirmation.value = "";
    error.value = "";
  }
);
onBeforeUnmount(() => {
  requests.invalidate();
  controller?.abort();
  password.value = "";
  confirmation.value = "";
});
async function submit() {
  if (busy.value || done.value || !token.value || !passwordRecoveryEnabled.value) return;
  if (
    password.value.length < 6 ||
    password.value.length > 128 ||
    !/\S/.test(password.value)
  ) {
    error.value =
      "Пароль должен содержать от 6 до 128 символов и не состоять из пробелов.";

    return;
  }

  if (password.value !== confirmation.value) {
    error.value = "Пароли не совпадают";

    return;
  }

  const current = requests.begin();
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  try {
    await api.post(
      "/auth/password/reset",
      { token: token.value, password: password.value },
      { signal: controller.signal, timeout: 15000 }
    );
    if (!current()) return;
    password.value = "";
    confirmation.value = "";
    done.value = true;
    void store.logOut();
    await router.replace({ hash: "" });
  } catch (cause) {
    if (current())
      error.value = friendlyRequestError(cause, {
        byStatus: {
          400: "Ссылка недействительна или истекла. Запросите новую.",
        },
      });
  } finally {
    if (current()) busy.value = false;
  }
}
</script>

<template>
  <section class="password-reset">
    <h1>Новый пароль</h1>
    <p v-if="checking" role="status">Проверяем доступность восстановления…</p>
    <template v-else-if="!passwordRecoveryEnabled">
      <p role="alert">Восстановление пароля сейчас недоступно.</p>
      <AButton v-if="failed" @click="load">Повторить проверку</AButton>
      <RouterLink to="/login">Перейти ко входу</RouterLink>
    </template>
    <template v-else-if="done"
      ><p role="status">Пароль изменён. Войдите с новым паролем.</p>
      <RouterLink to="/login">Перейти ко входу</RouterLink></template
    >
    <template v-else-if="!token"
      ><p role="alert">Ссылка недействительна или истекла.</p>
      <AButton @click="recoveryOpen = true"
        >Запросить новую ссылку</AButton
      ></template
    >
    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <p>
        От 6 до 128 символов. После смены пароля потребуется войти заново на
        всех устройствах.
      </p>
      <label for="reset-password">Новый пароль</label>
      <AInputPassword
        id="reset-password"
        v-model:value="password"
        autocomplete="new-password"
        :maxlength="128"
        :disabled="busy"
        :aria-invalid="!!error"
        aria-describedby="reset-error"
        size="large"
      />
      <label for="reset-confirmation">Повторите пароль</label>
      <AInputPassword
        id="reset-confirmation"
        v-model:value="confirmation"
        autocomplete="new-password"
        :maxlength="128"
        :disabled="busy"
        :aria-invalid="!!error"
        aria-describedby="reset-error"
        size="large"
      />
      <p v-if="error" id="reset-error" role="alert">{{ error }}</p>
      <AButton
        type="primary"
        html-type="submit"
        :loading="busy"
        :disabled="busy"
        class="auth-form__submit"
        >Сохранить пароль</AButton
      >
      <AButton class="password-reset__request" @click="recoveryOpen = true"
        >Запросить новую ссылку</AButton
      >
    </form>
  </section>
  <PasswordRecoveryModal v-if="recoveryOpen && passwordRecoveryEnabled" v-model="recoveryOpen" email="" />
</template>

<style scoped lang="scss">
.password-reset {
  h1 {
    margin: 0 0 16px;
    font-size: 24px;
  }
  p {
    color: var(--fv-color-text-secondary);
    line-height: 1.5;
  }
  label {
    display: block;
    margin: 14px 0 6px;
  }
  [role="alert"] {
    color: var(--fv-color-negative);
  }
  a {
    display: inline-block;
    margin-top: 16px;
    color: var(--fv-color-link);
  }
  &__request {
    margin-top: 16px;
  }
}
</style>
