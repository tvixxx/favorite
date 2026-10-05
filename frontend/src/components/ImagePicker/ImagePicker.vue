<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import { useMainStore } from "@/state/state";
import { friendlyRequestError, getRequestStatus } from "@/utils/friendlyError";
import { getApiResponseMessage } from "@/services/api";
import {
  discardImage,
  uploadImage,
  type ImagePurpose,
  type ImageSelection,
  type UploadedImage,
} from "@/services/media";

const props = withDefaults(
  defineProps<{
    modelValue: ImageSelection | null;
    purpose: ImagePurpose;
    label?: string;
    disabled?: boolean;
    showPreview?: boolean;
  }>(),
  { label: "Изображение", disabled: false, showPreview: true }
);
const emit = defineEmits<{
  "update:modelValue": [value: ImageSelection | null];
  busy: [value: boolean];
}>();
const main = useMainStore();
const mode = ref<"file" | "url">(
  props.modelValue?.url && !props.modelValue.assetId ? "url" : "file"
);
const urlText = ref(
  props.modelValue?.assetId ? "" : (props.modelValue?.url ?? "")
);
const uploading = ref(false);
const processing = ref(false);
const progress = ref(0);
const error = ref("");
const previewFailed = ref(false);
const filename = ref("");
const info = ref<UploadedImage | null>(null);
const localPreview = ref("");
const lastValid = ref<ImageSelection | null>(props.modelValue);
let generation = 0;
let controller: AbortController | null = null;
let temporaryId: string | null = null;
const maxMb = computed(() => (props.purpose === "USER_AVATAR" ? 5 : 10));
const preview = computed(
  () =>
    localPreview.value ||
    props.modelValue?.thumbnailUrl ||
    props.modelValue?.url ||
    ""
);

function freePreview(): void {
  if (localPreview.value) {
    URL.revokeObjectURL(localPreview.value);
  }

  localPreview.value = "";
}

function stop(): void {
  generation += 1;
  controller?.abort();
  controller = null;
  uploading.value = false;
  processing.value = false;
  emit("busy", false);
}

function discardTemporary(): void {
  const id = temporaryId;

  temporaryId = null;
  if (id) {
    void discardImage(id).catch(() => {
      // Привязанные файлы защищены сервером, непривязанные очистятся по сроку.
    });
  }
}

function remove(): void {
  if (props.disabled) {
    return;
  }

  stop();
  freePreview();
  discardTemporary();
  lastValid.value = null;
  info.value = null;
  filename.value = "";
  urlText.value = "";
  error.value = "";
  emit("update:modelValue", null);
}

function cancel(): void {
  stop();
  freePreview();
  filename.value = "";
  emit("update:modelValue", lastValid.value);
}

async function chooseFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = "";
  if (!file || props.disabled) {
    return;
  }

  if (file.size > maxMb.value * 1024 * 1024) {
    error.value = `Выберите изображение до ${maxMb.value} МБ`;

    return;
  }

  if (
    !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name) &&
    !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)
  ) {
    error.value = "Поддерживаются JPEG, PNG, WebP и HEIC/HEIF";

    return;
  }

  stop();
  freePreview();
  const request = generation;

  controller = new AbortController();
  mode.value = "file";
  filename.value = file.name;
  error.value = "";
  previewFailed.value = false;
  info.value = null;
  progress.value = 0;
  localPreview.value = URL.createObjectURL(file);
  uploading.value = true;
  emit("busy", true);
  emit("update:modelValue", { url: localPreview.value });

  try {
    const result = await uploadImage(file, props.purpose, {
      signal: controller.signal,
      onProgress: (loaded, total) => {
        if (request !== generation) {
          return;
        }

        progress.value = total
          ? Math.min(100, Math.round((loaded / total) * 100))
          : 0;
        processing.value = !!total && loaded >= total;
      },
    });

    if (request !== generation) {
      return;
    }

    freePreview();
    discardTemporary();
    temporaryId = result.id;
    info.value = result;
    previewFailed.value = false;
    const selection = {
      assetId: result.id,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
    };

    lastValid.value = selection;
    emit("update:modelValue", selection);
  } catch (cause) {
    if (request !== generation) {
      return;
    }

    freePreview();
    const status = getRequestStatus(cause);

    error.value = [400, 422, 429].includes(status ?? 0)
      ? (getApiResponseMessage(cause) ?? friendlyRequestError(cause))
      : friendlyRequestError(cause, {
          fallback:
            "Не удалось загрузить изображение. Можно повторить или вставить ссылку.",
          byStatus: { 413: `Выберите изображение до ${maxMb.value} МБ` },
        });
    emit("update:modelValue", lastValid.value);
  } finally {
    if (request === generation) {
      uploading.value = false;
      processing.value = false;
      controller = null;
      emit("busy", false);
    }
  }
}

function applyUrl(): void {
  if (props.disabled) {
    return;
  }

  const raw = urlText.value.trim();

  if (!raw) {
    remove();

    return;
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    error.value = "Введите полную HTTP(S) ссылку на изображение";

    return;
  }

  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    error.value = "Введите HTTP(S) ссылку без логина и пароля";

    return;
  }

  stop();
  freePreview();
  discardTemporary();
  error.value = "";
  previewFailed.value = false;
  filename.value = "";
  info.value = null;
  lastValid.value = { url: url.href };
  emit("update:modelValue", lastValid.value);
}

watch(
  () => props.modelValue,
  (value) => {
    if (!uploading.value && (!value || !value.url.startsWith("blob:"))) {
      lastValid.value = value;
    }

    if (!value && !uploading.value) {
      freePreview();
      info.value = null;
      filename.value = "";
      urlText.value = "";
    }
  }
);
watch(preview, () => {
  previewFailed.value = false;
});
watch(
  () => main.sessionRevision,
  () => {
    stop();
    freePreview();
    temporaryId = null;
    lastValid.value = null;
    emit("update:modelValue", null);
  }
);
onBeforeUnmount(() => {
  stop();
  freePreview();
});
</script>

<template>
  <div class="image-picker">
    <div
      class="image-picker__methods"
      role="group"
      :aria-label="`${label}: способ выбора`"
    >
      <button
        type="button"
        :aria-pressed="mode === 'file'"
        :disabled="disabled"
        @click="mode = 'file'"
      >
        С устройства
      </button>
      <button
        type="button"
        :aria-pressed="mode === 'url'"
        :disabled="disabled"
        @click="mode = 'url'"
      >
        По ссылке
      </button>
    </div>
    <div v-if="mode === 'file'" class="image-picker__file">
      <label
        class="image-picker__upload"
        :class="{ 'image-picker__upload--disabled': disabled }"
      >
        <input
          type="file"
          :aria-label="`${label}: выбрать файл`"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
          :disabled="disabled"
          @change="chooseFile"
        />
        <BaseIcon name="ph:upload-simple" :width="20" :height="20" />
        {{ uploading ? "Выбрать другой файл" : "Выбрать изображение" }}
      </label>
      <span class="image-picker__hint">
        JPEG, PNG, WebP, HEIC · до {{ maxMb }} МБ
      </span>
      <span v-if="filename" class="image-picker__filename">{{ filename }}</span>
    </div>
    <div v-else class="image-picker__url">
      <input
        v-model="urlText"
        type="url"
        maxlength="2048"
        :aria-label="`${label}: ссылка`"
        placeholder="https://example.com/poster.jpg"
        :disabled="disabled"
        @change="applyUrl"
        @keydown.enter.prevent="applyUrl"
      />
      <button type="button" :disabled="disabled" @click="applyUrl">
        Показать
      </button>
    </div>
    <div v-if="uploading" class="image-picker__progress" aria-live="polite">
      <progress :value="progress" max="100" aria-label="Загрузка изображения" />
      <span>
        {{ processing ? "Готовим изображение…" : `Загружаем… ${progress}%` }}
      </span>
      <button type="button" @click="cancel">Отмена</button>
    </div>
    <p v-if="error" class="image-picker__error" role="alert">{{ error }}</p>
    <div
      v-if="showPreview && preview"
      class="image-picker__preview"
      :class="{ 'image-picker__preview--avatar': purpose === 'USER_AVATAR' }"
    >
      <img
        v-if="!previewFailed"
        :src="preview"
        :alt="`${label}: предпросмотр`"
        @error="previewFailed = true"
      />
      <span v-else>
        {{
          uploading
            ? "Предпросмотр появится после обработки"
            : "Не удалось открыть изображение по этому адресу"
        }}
      </span>
    </div>
    <div class="image-picker__result">
      <span v-if="info?.width && info?.height">
        {{ info.width }} × {{ info.height }}
        <template v-if="info.byteSize">
          · {{ Math.round(info.byteSize / 1024) }} КБ
        </template>
      </span>
      <button
        v-if="modelValue && !uploading"
        type="button"
        :disabled="disabled"
        @click="remove"
      >
        Убрать изображение
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.image-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  width: 100%;

  button,
  input {
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  &__methods {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  &__methods button {
    padding: 9px 16px;
    border: 1px solid var(--fv-color-border);
    border-radius: 999px;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
  }
  &__methods button[aria-pressed="true"] {
    background: var(--fv-color-text-primary);
    color: var(--fv-color-bg-primary);
    border-color: transparent;
  }
  &__file {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  &__upload {
    position: relative;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    border: 1px dashed var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    cursor: pointer;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    &:focus-within {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 3px;
    }
    &--disabled {
      opacity: 0.5;
      cursor: default;
    }
    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      overflow: hidden;
    }
  }
  &__hint,
  &__filename,
  &__result {
    font-size: 0.82rem;
    color: var(--fv-color-text-secondary);
  }
  &__filename {
    overflow-wrap: anywhere;
  }
  &__url {
    display: flex;
    gap: 8px;
    min-width: 0;
  }
  &__url input {
    width: 0;
    flex: 1;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
  }
  &__url button {
    flex-shrink: 0;
    padding: 8px 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-sm);
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
  }
  &__progress {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
  }
  &__progress progress {
    width: 100%;
    accent-color: var(--fv-color-brand);
  }
  &__progress button,
  &__result button {
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--fv-color-link);
  }
  &__error {
    margin: 0;
    color: var(--fv-color-brand);
    font-size: 0.85rem;
  }
  &__preview {
    width: min(100%, 180px);
    aspect-ratio: 2 / 3;
    background: var(--fv-color-bg-secondary);
    border-radius: var(--fv-radius-sm);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  &__preview--avatar {
    aspect-ratio: 1;
  }
  &__preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  &__preview span {
    padding: 12px;
    font-size: 0.85rem;
    color: var(--fv-color-text-secondary);
  }
  &__result {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
  }
}
</style>
