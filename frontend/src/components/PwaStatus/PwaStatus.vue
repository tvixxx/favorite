<script setup lang="ts">
import { computed, onScopeDispose, ref } from "vue";
import { useOnline } from "@vueuse/core";
import { useRegisterSW } from "virtual:pwa-register/vue";
import BaseModal from "@/components/BaseModal/BaseModal.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const online = useOnline();
const confirmOpen = ref(false);

type UpdateState =
  | { phase: "idle" }
  | { phase: "applying"; reloadRequested: boolean }
  | { phase: "waiting-for-controller" }
  | { phase: "failed" };

const update = ref<UpdateState>({ phase: "idle" });
const updating = computed(() => update.value.phase === "applying");
const loadFailed = ref(false);
let registration: ServiceWorkerRegistration | undefined;
const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onNeedReload: reloadAfterUpdate,
  onRegisteredSW(_url, current) {
    registration = current;
  },
});

function reloadAfterUpdate(): void {
  const current = update.value;

  if (current.phase === "applying" && current.reloadRequested) {
    current.reloadRequested = false;
  } else if (current.phase === "waiting-for-controller") {
    update.value = { phase: "idle" };
  } else return;

  window.location.reload();
}

async function checkUpdate(): Promise<void> {
  if (online.value) {
    await registration?.update().catch(() => {});
  }
}

async function applyUpdate(): Promise<void> {
  if (updating.value || !online.value) {
    return;
  }

  update.value = { phase: "applying", reloadRequested: needRefresh.value };

  const attempt = update.value;

  try {
    if (attempt.reloadRequested) {
      await updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  } catch {
    if (update.value === attempt) update.value = { phase: "failed" };
  } finally {
    if (update.value === attempt) {
      update.value = attempt.reloadRequested
        ? { phase: "waiting-for-controller" }
        : { phase: "idle" };
    }
  }
}

function handlePreloadError(): void {
  loadFailed.value = true;
  void checkUpdate();
}

function dismissUpdate(): void {
  needRefresh.value = false;
  loadFailed.value = false;
}

function openUpdateFromNotification(): void {
  void checkUpdate();
  confirmOpen.value = true;
}

window.addEventListener("fv:request-app-update", openUpdateFromNotification);
window.addEventListener("online", checkUpdate);
window.addEventListener("focus", checkUpdate);
window.addEventListener("vite:preloadError", handlePreloadError);
navigator.serviceWorker?.addEventListener(
  "controllerchange",
  reloadAfterUpdate
);

onScopeDispose(() => {
  update.value = { phase: "idle" };
  window.removeEventListener(
    "fv:request-app-update",
    openUpdateFromNotification
  );

  window.removeEventListener("online", checkUpdate);
  window.removeEventListener("focus", checkUpdate);
  window.removeEventListener("vite:preloadError", handlePreloadError);
  navigator.serviceWorker?.removeEventListener(
    "controllerchange",
    reloadAfterUpdate
  );
});
</script>

<template>
  <aside
    v-if="!online || needRefresh || loadFailed"
    class="pwa-status"
    :role="loadFailed ? 'alert' : 'status'"
  >
    <BaseIcon
      :name="online ? 'ph:arrows-clockwise' : 'ph:wifi-slash'"
      :width="24"
    />
    <span v-if="!online"
      >Нет соединения. Для загрузки данных и сохранения нужен интернет.</span
    >
    <template v-else>
      <span v-if="loadFailed"
        >Не удалось загрузить страницу. Проверьте соединение или обновите
        приложение.</span
      >
      <span v-else>Доступна новая версия приложения</span>
      <div class="pwa-status__actions">
        <a-button type="primary" @click="confirmOpen = true">{{
          needRefresh ? "Обновить" : "Повторить"
        }}</a-button>
        <a-button @click="dismissUpdate">Позже</a-button>
      </div>
    </template>
  </aside>
  <BaseModal v-model="confirmOpen">
    <template #title>{{
      needRefresh ? "Обновить приложение?" : "Перезагрузить страницу?"
    }}</template>
    <template #body>
      <p class="pwa-status__message">
        Страница перезагрузится. Сохраните изменения в открытых формах перед
        обновлением.
      </p>
      <p v-if="update.phase === 'failed'" class="pwa-status__message" role="alert">
        Не удалось обновить приложение. Попробуйте ещё раз.
      </p>
    </template>
    <template #footer>
      <a-button :disabled="updating" @click="confirmOpen = false"
        >Отмена</a-button
      >
      <a-button
        type="primary"
        :loading="updating"
        :disabled="!online"
        @click="applyUpdate"
        >{{ needRefresh ? "Обновить" : "Перезагрузить" }}</a-button
      >
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
.pwa-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  width: calc(100% - 32px);
  max-width: var(--fv-layout-max-width);
  margin: 16px auto;
  padding: 16px;
  border: 1px solid var(--fv-color-border);
  border-radius: var(--fv-radius-sm);
  background: var(--fv-color-bg-primary);
  color: var(--fv-color-text-primary);

  > span {
    flex: 1;
    min-width: 160px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__message {
    color: var(--fv-color-text-secondary);
  }

  :deep(.ant-btn) {
    min-height: 44px;
  }
}
</style>
