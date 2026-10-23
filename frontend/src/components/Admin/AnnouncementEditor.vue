<script setup lang="ts">
import { ref, watch } from "vue";
import { Button, Input, Select } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import { safeNotificationActions } from "@/components/Notifications/notification-actions";
import type { NotificationAction } from "@/components/Notifications/center.types";
export interface AnnouncementDraft {
  id?: string;
  title: string;
  body: string;
  category: "NEWS" | "SERVICE";
  actions: NotificationAction[];
}

const props = defineProps<{
  value: AnnouncementDraft;
  saving: boolean;
  formId: string;
}>();
const emit = defineEmits<{ save: [draft: AnnouncementDraft] }>();
const title = ref("");
const body = ref("");
const category = ref<"NEWS" | "SERVICE">("NEWS");
const actions = ref<NotificationAction[]>([]);
const error = ref("");
const preview = ref(false);

watch(
  () => props.value,
  (value) => {
    title.value = value.title;
    body.value = value.body;
    category.value = value.category;
    actions.value = value.actions.map((action) => ({ ...action }));
    error.value = "";
  },
  { immediate: true }
);

function validate(): boolean {
  error.value =
    !title.value.trim() || !body.value.trim()
      ? "Заполните заголовок и текст."
      : safeNotificationActions(actions.value).length !== actions.value.length
      ? "Проверьте кнопки: нужны подпись и поддерживаемый внутренний маршрут."
      : "";

  return !error.value;
}

function save(event: SubmitEvent): void {
  if (props.saving) return;
  if (
    (event.submitter as HTMLButtonElement | null)?.dataset.intent === "preview"
  ) {
    if (validate()) preview.value = true;

    return;
  }

  if (validate())
    emit("save", {
      ...(props.value.id ? { id: props.value.id } : {}),
      title: title.value.trim(),
      body: body.value.trim(),
      category: category.value,
      actions: actions.value,
    });
}
</script>
<template>
  <form :id="formId" class="announcement-editor" @submit.prevent="save">
    <label
      >Заголовок<Input
        v-model:value="title"
        :maxlength="120"
        :disabled="saving"
    /></label>
    <label
      >Категория<Select
        v-model:value="category"
        :disabled="saving"
        :options="[
          { value: 'NEWS', label: 'Новости' },
          { value: 'SERVICE', label: 'Работа сервиса' },
        ]"
    /></label>
    <label
      >Текст<Input.TextArea
        v-model:value="body"
        :maxlength="5000"
        :rows="7"
        :disabled="saving"
    /></label>
    <p>Обычный текст, без HTML. Переносы строк сохраняются.</p>
    <fieldset>
      <legend>Кнопки · необязательно</legend>
      <div
        v-for="(action, index) in actions"
        :key="index"
        class="announcement-editor__action"
      >
        <Input
          v-model:value="action.label"
          :maxlength="40"
          placeholder="Подпись кнопки"
          :disabled="saving"
          :aria-label="'Подпись кнопки ' + (index + 1)"
        /><Input
          v-model:value="action.path"
          placeholder="/library/diary"
          :disabled="saving"
          :aria-label="'Маршрут кнопки ' + (index + 1)"
        /><Button :disabled="saving" @click="actions.splice(index, 1)"
          >Убрать</Button
        >
      </div>
      <Button
        v-if="actions.length < 2"
        :disabled="saving"
        @click="actions.push({ label: '', path: '' })"
        >Добавить кнопку</Button
      >
      <p>
        Только внутренние страницы: /notifications, /library/diary,
        /library/catalog, /friends и другие поддерживаемые разделы.
      </p>
    </fieldset>
    <p v-if="error" class="announcement-editor__error" role="alert">
      {{ error }}
    </p>
    <BaseModal v-model="preview"
      ><template #title>Предпросмотр объявления</template
      ><template #body
        ><h3>{{ title }}</h3>
        <p class="announcement-editor__preview">{{ body }}</p>
        <Button v-for="action in actions" :key="action.path" disabled>{{
          action.label
        }}</Button></template
      ><template #footer
        ><Button @click="preview = false"
          >Вернуться к редактированию</Button
        ></template
      ></BaseModal
    >
  </form>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.announcement-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 14px;
    font-weight: 500;
  }
  p {
    font-size: 12px;
    color: var(--fv-color-text-secondary);
    margin: 0;
  }
  fieldset {
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
    padding: 14px;
    min-width: 0;
  }
  legend {
    font-size: 13px;
    padding: 0 6px;
  }
  &__action {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 8px;
    margin-bottom: 10px;
  }
  &__footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  &__preview {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
  }
  &__error {
    color: var(--fv-color-negative);
  }
}
@include mediaMax(640px) {
  .announcement-editor__action {
    grid-template-columns: 1fr;
  }
}
</style>
