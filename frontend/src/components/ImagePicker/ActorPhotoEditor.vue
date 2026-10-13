<script setup lang="ts">
import { ref, watch } from "vue";
import { message } from "ant-design-vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import ImagePicker from "./ImagePicker.vue";
import { useActorsStore, type Actor } from "@/stores/actors/actorsStore";
import type { ImageSelection } from "@/services/media";
import { friendlyRequestError } from "@/utils/friendlyError";

const props = defineProps<{ modelValue: boolean; actor: Actor | null }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const store = useActorsStore();
const selection = ref<ImageSelection | null>(null);
const saving = ref(false);
const uploading = ref(false);

watch(
  [() => props.modelValue, () => props.actor?.id],
  ([open]) => {
    if (open) {
      selection.value = props.actor?.imageUrl
        ? {
            url: props.actor.imageUrl,
            assetId: props.actor.imageAssetId,
            thumbnailUrl: props.actor.imageThumbnailUrl,
          }
        : null;
    }
  },
  { immediate: true }
);

async function save(): Promise<void> {
  const actor = props.actor;

  if (!actor || saving.value || uploading.value) {
    return;
  }

  saving.value = true;

  try {
    await store.updateActorImage(actor, selection.value);
    if (props.actor?.id === actor.id) {
      message.success("Фото актёра сохранено");
      emit("update:modelValue", false);
    }
  } catch (error) {
    message.error(
      friendlyRequestError(error, {
        fallback: "Не удалось сохранить фото актёра",
      })
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
    <template #title>Фото: {{ actor?.name }}</template>
    <template #body>
      <ImagePicker
        v-model="selection"
        purpose="ACTOR_PHOTO"
        label="Фото актёра"
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
