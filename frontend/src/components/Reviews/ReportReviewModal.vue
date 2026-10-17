<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import api from "@/services/api";
import { friendlyRequestError } from "@/utils/friendlyError";
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ reviewId: string }>();
const reason = ref<string>();
const comment = ref("");
const saving = ref(false);
const dialogOpen = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!saving.value) {
      open.value = value;
    }
  },
});
const options = [
  { value: "SPAM", label: "Спам или реклама" },
  { value: "ABUSE", label: "Оскорбления" },
  { value: "SPOILER", label: "Спойлер без предупреждения" },
  { value: "OTHER", label: "Другое" },
];
watch(open, (visible) => {
  if (visible) {
    reason.value = undefined;
    comment.value = "";
  }
});

async function send(): Promise<void> {
  if (!reason.value || saving.value) {
    return;
  }

  const id = props.reviewId;

  saving.value = true;

  try {
    await api.post(`/reviews/${id}/reports`, {
      reason: reason.value,
      comment: comment.value.trim() || undefined,
    });

    if (props.reviewId === id) {
      open.value = false;
      message.success("Жалоба принята. Администратор проверит отзыв.");
    }
  } catch (err) {
    message.error(
      friendlyRequestError(err, { fallback: "Не удалось отправить жалобу" })
    );
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <BaseModal v-model="dialogOpen" layout="form">
    <template #title>Пожаловаться на отзыв</template>
    <template #body>
      <a-form layout="vertical" :disabled="saving">
        <a-form-item label="Причина" required>
          <a-select
            v-model:value="reason"
            placeholder="Выберите причину"
            :options="options"
          />
        </a-form-item>
        <a-form-item label="Пояснение — необязательно">
          <a-textarea
            v-model:value="comment"
            :rows="3"
            :maxlength="1000"
            show-count
          />
        </a-form-item>
        <p>Отзыв останется видимым до решения администратора.</p>
      </a-form>
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="open = false">Отмена</a-button>
      <a-button
        type="primary"
        :loading="saving"
        :disabled="!reason"
        @click="send"
        >Отправить жалобу</a-button
      >
    </template>
  </BaseModal>
</template>
