<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Pagination } from "ant-design-vue";
import api from "@/services/api";
import { useMainStore } from "@/state/state";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import type { NotificationDto } from "@/stores/notifications/types";
import NotificationList from "@/components/Notifications/NotificationList.vue";
import { notificationTarget } from "@/utils/notificationText";
import StateBlock from "@/components/StateBlock/StateBlock.vue";

const main = useMainStore();
const notifications = useNotificationsStore();
const router = useRouter();
const userId = computed(() => main.userData?.id);
const items = ref<NotificationDto[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref("");
let request: AbortController | undefined;

async function load(): Promise<void> {
  request?.abort();
  if (!userId.value) return;

  const current = new AbortController();

  request = current;
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get<{ items: NotificationDto[]; total: number }>(
      `/users/${userId.value}/notifications/page`,
      {
        params: { limit: 20, offset: (page.value - 1) * 20 },
        signal: current.signal,
      }
    );

    if (current.signal.aborted) return;
    items.value = data.items;
    total.value = data.total;
  } catch {
    if (!current.signal.aborted)
      error.value = "Не удалось загрузить историю уведомлений.";
  } finally {
    if (!current.signal.aborted) loading.value = false;
  }
}

async function open(item: NotificationDto): Promise<void> {
  if (!userId.value) return;
  try {
    if (!item.readAt) await notifications.markRead(userId.value, item.id);
    await router.push(notificationTarget(item));
  } catch {
    error.value = "Не удалось открыть уведомление. Попробуйте ещё раз.";
  }
}

watch([userId, page], () => void load(), { immediate: true });
onBeforeUnmount(() => request?.abort());
</script>

<template>
  <section class="notifications-page" aria-labelledby="notifications-title">
    <h1 id="notifications-title">История уведомлений</h1>
    <p>Все сообщения о событиях, включая уже прочитанные.</p>
    <p v-if="loading" role="status">Загружаем уведомления…</p>
    <StateBlock
      v-else-if="error"
      variant="error"
      :title="error"
      :actions="[{ label: 'Повторить', onClick: load }]"
    />
    <NotificationList v-else-if="items.length" :items="items" @open="open" />
    <StateBlock v-else variant="empty" title="Уведомлений пока нет" />
    <Pagination
      v-if="total > 20"
      v-model:current="page"
      :total="total"
      :page-size="20"
      :show-size-changer="false"
      simple
    />
  </section>
</template>

<style scoped lang="scss">
.notifications-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px;
  min-width: 0;

  h1 {
    font-size: 26px;
    margin: 0 0 8px;
  }
  > p {
    color: var(--fv-color-text-secondary);
  }
  :deep(.ant-pagination) {
    margin-top: 24px;
  }
}
</style>
