<script setup lang="ts">
import { ref, watch } from "vue";
import api, { getApiResponseMessage } from "@/services/api";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ContentTypePicker from "./ContentTypePicker.vue";
import type { Movie } from "@/stores/movies/types";
import type { ContentSelection } from "@/utils/content-kind";
import { friendlyRequestError } from "@/utils/friendlyError";

const props = defineProps<{ modelValue: boolean; movie: Movie }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();
const selection = ref<ContentSelection>({ contentKind: null, isSerial: null });
const saving = ref(false);
const error = ref("");

watch(
  [() => props.modelValue, () => props.movie.id],
  ([open]) => {
    if (open) {
      selection.value = {
        contentKind: props.movie.contentKind ?? null,
        isSerial: props.movie.isSerial,
      };

      error.value = "";
    }
  },
  { immediate: true }
);

async function save(): Promise<void> {
  if (
    saving.value ||
    !selection.value.contentKind ||
    selection.value.isSerial === null
  )
    return;

  const id = props.movie.id;

  saving.value = true;
  error.value = "";
  try {
    await api.patch(`/movies/${id}`, {
      ...selection.value,
      ...(props.movie.updatedAt
        ? { expectedUpdatedAt: props.movie.updatedAt }
        : {}),
    });

    if (props.modelValue && props.movie.id === id) {
      emit("saved");
      emit("update:modelValue", false);
    }
  } catch (cause) {
    if (props.modelValue && props.movie.id === id)
      error.value = getApiResponseMessage(cause) ?? friendlyRequestError(cause);
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <BaseModal
    :model-value="modelValue"
    layout="form"
    @update:model-value="!saving && emit('update:modelValue', !!$event)"
  >
    <template #title>Изменить тип</template>
    <template #body>
      <div class="content-editor">
        <div class="content-editor__movie">{{ movie.title }}</div>
        <span class="content-editor__label">Тип контента</span>
        <ContentTypePicker v-model="selection" legacy :disabled="saving" />
        <div class="content-editor__hint">
          <p>
            Меняется общая карточка в каталоге. Личные оценки и прогресс
            сохраняются.
          </p>
          <p>
            Если уже отмечены серии или выпуски, формат без серий выбрать
            нельзя.
          </p>
        </div>
        <p v-if="error" role="alert" class="content-editor__error">
          {{ error }}
        </p>
      </div>
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="emit('update:modelValue', false)"
        >Отмена</a-button
      >
      <a-button
        type="primary"
        :loading="saving"
        :disabled="
          saving || !selection.contentKind || selection.isSerial === null
        "
        @click="save"
        >Сохранить</a-button
      >
    </template>
  </BaseModal>
</template>
<style scoped lang="scss">
.content-editor {
  padding-bottom: 20px;

  &__movie {
    padding: 10px 12px;
    margin-bottom: 16px;
    border-radius: var(--fv-radius-md);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font-weight: 500;
    font-size: 15px;
    overflow-wrap: anywhere;
  }

  &__label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  &__hint {
    margin-top: 16px;
    color: var(--fv-color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;

    p {
      margin: 0;
    }

    p + p {
      margin-top: 8px;
    }
  }

  &__error {
    color: var(--fv-color-negative);
    margin: 12px 0 0;
  }
}
</style>
