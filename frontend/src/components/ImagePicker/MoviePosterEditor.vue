<script setup lang="ts">
import { ref, watch } from "vue";
import { message } from "ant-design-vue";
import api from "@/services/api";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ImagePicker from "./ImagePicker.vue";
import type { Movie } from "@/stores/movies/types/movies.types";
import type { ImageSelection } from "@/services/media";
import { friendlyRequestError } from "@/utils/friendlyError";

const props = defineProps<{ modelValue: boolean; movie: Movie }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [value: ImageSelection | null];
}>();
const selection = ref<ImageSelection | null>(null);
const saving = ref(false);
const uploading = ref(false);

watch(
  [() => props.modelValue, () => props.movie.id],
  ([open]) => {
    if (open) {
      selection.value = props.movie.imageUrl
        ? {
            url: props.movie.imageUrl,
            assetId: props.movie.posterAssetId,
            thumbnailUrl: props.movie.imageThumbnailUrl,
          }
        : null;
    }
  },
  { immediate: true }
);

async function save(): Promise<void> {
  if (saving.value || uploading.value) {
    return;
  }

  const id = props.movie.id;
  const selected = selection.value;

  saving.value = true;

  try {
    await api.patch(`/movies/${id}`, {
      posterAssetId: selected?.assetId ?? null,
      imageUrl: selected?.assetId ? undefined : (selected?.url ?? null),
    });
    if (props.movie.id === id) {
      emit("saved", selected);
      emit("update:modelValue", false);
      message.success("Постер сохранён");
    }
  } catch (error) {
    message.error(
      friendlyRequestError(error, { fallback: "Не удалось сохранить постер" })
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    layout="form"
    @update:model-value="emit('update:modelValue', !!$event)"
  >
    <template #title>Постер: {{ movie.title }}</template>
    <template #body>
      <ImagePicker
        v-model="selection"
        purpose="MOVIE_POSTER"
        label="Постер"
        :disabled="saving"
        @busy="uploading = $event"
      />
    </template>
    <template #footer>
      <a-button :disabled="saving" @click="emit('update:modelValue', false)">
        Отмена
      </a-button>
      <a-button
        type="primary"
        :loading="saving"
        :disabled="uploading"
        @click="save"
      >
        Сохранить
      </a-button>
    </template>
  </BaseModal>
</template>
