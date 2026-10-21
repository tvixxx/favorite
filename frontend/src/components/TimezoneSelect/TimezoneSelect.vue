<script setup lang="ts">
import {
  blurAfterTouchSelect,
  selectPopupContainer,
} from "@/utils/touchSelect";
import { computed, onBeforeUnmount, onMounted, ref, useId } from "vue";
import { Select as ASelect, Button as AButton } from "ant-design-vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import api from "@/services/api";
import { timezoneLabel } from "@/utils/timezoneLabel";

const model = defineModel<string>({ default: "UTC" });
const props = defineProps<{ disabled?: boolean }>();
const id = useId();
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zones = ref<string[]>(["UTC"]);
const loading = ref(false);
const error = ref("");
let controller: AbortController | undefined;
let active = true;
const options = computed(() =>
  [...new Set([model.value, deviceZone, ...zones.value])].map((value) => ({
    value,
    label: timezoneLabel(value),
    search: `${timezoneLabel(value)} ${value}`,
  }))
);

async function load() {
  controller?.abort();

  const request = new AbortController();

  controller = request;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<unknown>("/timezones", {
      signal: request.signal,
      timeout: 5000,
    });

    if (
      !Array.isArray(data) ||
      data.length > 1000 ||
      !data.includes("UTC") ||
      !data.every((value) => typeof value === "string")
    )
      throw new Error("Invalid timezone list");
    if (active && controller === request) zones.value = data;
  } catch {
    if (active && controller === request)
      error.value = "Не удалось загрузить часовые пояса. Повторите попытку.";
  } finally {
    if (active && controller === request) loading.value = false;
  }
}

onMounted(() => void load());
onBeforeUnmount(() => {
  active = false;
  controller?.abort();
});
</script>
<template>
  <div class="timezone-select">
    <label :for="id">Часовой пояс</label>
    <ASelect
      @select="blurAfterTouchSelect"
      :get-popup-container="selectPopupContainer"
      :list-height="160"
      :id="id"
      v-model:value="model"
      :options="options"
      :disabled="props.disabled || loading"
      :loading="loading"
      show-search
      option-filter-prop="search"
    >
      <template #suffixIcon
        ><BaseIcon name="ph:caret-down" :width="16" :height="16"
      /></template>
    </ASelect>
    <AButton
      v-if="model !== deviceZone"
      :disabled="disabled || loading"
      @click="model = deviceZone"
    >
      Как на устройстве: {{ timezoneLabel(deviceZone) }}
    </AButton>
    <p>
      Выберите город или время устройства и сохраните профиль. Это время
      используется в уведомлениях и статистике.
    </p>
    <div v-if="error" role="alert">
      <p>{{ error }}</p>
      <AButton :disabled="disabled || loading" @click="load">Повторить</AButton>
    </div>
  </div>
</template>
<style scoped lang="scss">
.timezone-select {
  display: grid;
  gap: 8px;
  min-width: 0;

  label {
    font-size: 14px;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--fv-color-text-secondary);
  }

  [role="alert"]p {
    color: var(--fv-color-negative);
  }

  .ant-select {
    width: 100%;
  }
}
</style>
