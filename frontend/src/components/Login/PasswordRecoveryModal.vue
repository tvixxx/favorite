<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { Button as AButton, Input as AInput } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import api from "@/services/api";
import { EMAIL_REGEX } from "@/constants";
import { friendlyRequestError } from "@/utils/friendlyError";
import { createRequestGuard } from "@/utils/requestGuard";

const props = defineProps<{ modelValue: boolean; email: string }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const inputEmail = ref("");
const busy = ref(false);
const sent = ref(false);
const error = ref("");
const requests = createRequestGuard();
let controller: AbortController | undefined;

watch(
  () => props.modelValue,
  () => {
    requests.invalidate();
    controller?.abort();
    busy.value = false;
    inputEmail.value = props.email;
    sent.value = false;
    error.value = "";
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  requests.invalidate();
  controller?.abort();
});

async function submit() {
  if (busy.value || sent.value) return;

  const value = inputEmail.value.trim();

  if (!EMAIL_REGEX.test(value) || value.length > 254) {
    error.value = "Введите корректный email";

    return;
  }

  const current = requests.begin();

  controller = new AbortController();
  busy.value = true;
  error.value = "";
  try {
    await api.post(
      "/auth/password/request",
      { email: value },
      { signal: controller.signal, timeout: 15000 }
    );

    if (current()) sent.value = true;
  } catch (cause) {
    if (current()) error.value = friendlyRequestError(cause);
  } finally {
    if (current()) busy.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    layout="form"
    @update:model-value="emit('update:modelValue', !!$event)"
  >
    <template #title>Восстановление пароля</template>
    <template #body>
      <p v-if="sent" role="status" class="recovery-status">
        Если такой аккаунт существует, письмо со ссылкой будет отправлено.
        Ссылка действует 15 минут. Проверьте папку «Спам». Повторный запрос — не
        раньше чем через минуту.
      </p>
      <form
        v-else
        class="auth-form recovery-form"
        novalidate
        @submit.prevent="submit"
      >
        <p>Укажите email аккаунта. Отправим ссылку для нового пароля.</p>
        <label for="recovery-email">Email</label>
        <AInput
          id="recovery-email"
          v-model:value="inputEmail"
          type="email"
          autocomplete="email"
          :maxlength="254"
          :disabled="busy"
          :aria-invalid="!!error"
          aria-describedby="recovery-error"
          size="large"
        />
        <p v-if="error" id="recovery-error" role="alert">{{ error }}</p>
        <AButton
          type="primary"
          html-type="submit"
          :loading="busy"
          :disabled="busy"
          class="auth-form__submit"
          >Отправить ссылку</AButton
        >
      </form>
    </template>
    <template #footer
      ><AButton @click="emit('update:modelValue', false)"
        >Закрыть</AButton
      ></template
    >
  </BaseModal>
</template>

<style scoped lang="scss">
.recovery-form {
  color: var(--fv-color-text-primary);

  p {
    color: var(--fv-color-text-secondary);
    line-height: 1.5;
  }

  label {
    display: block;
    margin: 12px 0 6px;
  }

  [role="alert"] {
    color: var(--fv-color-negative);
  }
}

.recovery-status {
  color: var(--fv-color-text-secondary);
  line-height: 1.5;
  margin: 0;
}
</style>
