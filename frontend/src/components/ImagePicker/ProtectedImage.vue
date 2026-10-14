<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import api from "@/services/api";
import { useMainStore } from "@/state/state";
import { friendlyRequestError } from "@/utils/friendlyError";
import AppSpinner from "@/components/AppSpinner/AppSpinner.vue";

const props = withDefaults(
  defineProps<{ assetId: string; thumbnail?: boolean }>(),
  { thumbnail: false }
);
const store = useMainStore();
const url = ref("");
const error = ref("");
const busy = ref(false);
let generation = 0;
let controller: AbortController | undefined;
function clear() {
  generation++;
  controller?.abort();
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = "";
}

async function load() {
  clear();
  error.value = "";
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      props.assetId
    )
  ) {
    error.value = "Изображение недоступно";
    busy.value = false;

    return;
  }

  const current = generation;
  controller = new AbortController();
  busy.value = true;
  try {
    const response = await api.get<Blob>(
      `/uploads/images/${props.assetId}/${
        props.thumbnail ? "thumbnail" : "full"
      }.webp`,
      { responseType: "blob", signal: controller.signal, timeout: 15000 }
    );
    if (current === generation) url.value = URL.createObjectURL(response.data);
  } catch (cause) {
    if (current === generation) error.value = friendlyRequestError(cause);
  } finally {
    if (current === generation) busy.value = false;
  }
}

watch(
  [() => props.assetId, () => props.thumbnail, () => store.sessionRevision],
  () => void load(),
  { immediate: true }
);
onBeforeUnmount(clear);
</script>
<template>
  <div class="protected-image">
    <div v-if="busy" role="status">
      <AppSpinner :size="24" /><span>Загрузка скриншота…</span>
    </div>
    <template v-else-if="url"
      ><img :src="url" alt="Скриншот обращения" /><a
        v-if="!thumbnail"
        :href="url"
        download="favorite-feedback.webp"
        >Скачать скриншот</a
      ></template
    >
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="load">Повторить</button>
    </div>
  </div>
</template>
<style scoped lang="scss">
.protected-image {
  width: 100%;
  min-width: 0;
  color: var(--fv-color-text-secondary);
  img {
    display: block;
    max-width: 100%;
    max-height: 480px;
    object-fit: contain;
    margin: auto;
  }
  [role="status"] {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 100px;
  }
  a {
    display: block;
    margin-top: 12px;
    color: var(--fv-color-link);
  }
}
</style>
