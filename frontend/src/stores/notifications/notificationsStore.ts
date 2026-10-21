import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import {
  isNotificationTypeEnabled,
  useNotificationPrefs,
} from "@/composable/useNotificationPrefs";
import type { NotificationDto } from "./types";
import { createRequestGuard } from "@/utils/requestGuard";

export const useNotificationsStore = defineStore("notifications", () => {
  const prefs = useNotificationPrefs();
  const types = computed(() => [
    ...(prefs.newMessages.value ? ["CHAT_MESSAGE"] : []),
    ...(prefs.friendRequests.value
      ? ["FRIEND_REQUEST", "FRIEND_ACCEPTED", "FRIEND_REJECTED"]
      : []),
  ]);
  const typeQuery = computed(() =>
    types.value.map((type) => `types=${type}`).join("&")
  );
  let activeUserId: string | null = null;
  let revision = 0;
  const listRequests = createRequestGuard();
  const countRequests = createRequestGuard();
  const knownIds = new Set<string>();
  const readIds = new Set<string>();
  const items = ref<NotificationDto[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

  const setError = (next: string | null) => {
    isError.value = next;
  };

  const fetchUnreadCount = async (userId: string) => {
    const requestRevision = revision;
    const isCurrent = countRequests.begin();

    if (!userId?.trim()) {
      return;
    }

    if (!types.value.length) {
      unreadCount.value = 0;

      return;
    }

    try {
      const response = await useFetch<number>(
        `/users/${userId}/notifications/unread-count?${typeQuery.value}`,
        { method: FETCH_METHOD.get }
      );

      if (
        requestRevision === revision &&
        isCurrent() &&
        isSuccessStatus(response.status)
      ) {
        unreadCount.value =
          typeof response.data === "number" ? response.data : 0;
      }
    } catch {
      // ignore — badge optional
    }
  };

  const fetchNotifications = async (userId: string, limit = 5) => {
    const requestRevision = revision;
    const isCurrent = listRequests.begin();
    const previousIds = new Set(items.value.map((item) => item.id));

    if (!userId?.trim()) {
      return [];
    }

    if (!types.value.length) {
      items.value = [];

      return [];
    }

    isLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<NotificationDto[]>(
        `/users/${userId}/notifications?limit=${limit}&unreadOnly=true&${typeQuery.value}`,
        { method: FETCH_METHOD.get }
      );

      if (requestRevision !== revision || !isCurrent()) return [];

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить уведомления");
      }

      const incoming = items.value.filter((item) => !previousIds.has(item.id));
      const merged = new Map(
        [...response.data, ...incoming].map((item) => [item.id, item])
      );

      for (const item of response.data) knownIds.add(item.id);
      items.value = [...merged.values()]
        .filter(
          (item) =>
            item.readAt === null &&
            !readIds.has(item.id) &&
            isNotificationTypeEnabled(item.type)
        )
        .sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            b.id.localeCompare(a.id)
        )
        .slice(0, 5);

      return items.value;
    } catch (error: unknown) {
      if (requestRevision !== revision || !isCurrent()) return [];

      const text =
        error instanceof Error ? error.message : "Ошибка загрузки уведомлений";

      setError(text);
      throw error;
    } finally {
      if (requestRevision === revision && isCurrent()) isLoading.value = false;
    }
  };

  const hydrate = async (userId: string) => {
    if (activeUserId !== userId) {
      revision++;
      items.value = [];
      unreadCount.value = 0;
      knownIds.clear();
      readIds.clear();
    }

    activeUserId = userId;

    const requestRevision = revision;

    await fetchUnreadCount(userId);
    if (requestRevision !== revision) return;
    await fetchNotifications(userId);
  };

  watch(typeQuery, () => {
    revision++;
    if (activeUserId) void hydrate(activeUserId).catch(() => undefined);
  });

  const applyIncoming = (dto: NotificationDto) => {
    // Клиентский гейт: если тип уведомления выключен в настройках — не показываем
    if (!isNotificationTypeEnabled(dto.type) || readIds.has(dto.id)) {
      return;
    }

    const seen = knownIds.has(dto.id);

    knownIds.add(dto.id);

    const idx = items.value.findIndex((n) => n.id === dto.id);

    if (idx >= 0) {
      items.value[idx] = dto;
    } else {
      items.value = [dto, ...items.value];
    }

    items.value = items.value
      .filter((item) => item.readAt === null)
      .slice(0, 5);

    if (!seen && dto.readAt === null) {
      unreadCount.value += 1;
    }
  };

  const markRead = async (userId: string, notificationId: string) => {
    const requestRevision = revision;

    if (!userId?.trim() || !notificationId?.trim()) {
      return null;
    }

    try {
      const response = await useFetch<NotificationDto | null>(
        `/users/${userId}/notifications/${notificationId}/read`,
        { method: FETCH_METHOD.patch }
      );

      if (requestRevision !== revision) return null;

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось отметить прочитанным");
      }

      const updated = response.data;

      if (updated) {
        readIds.add(updated.id);
        items.value = items.value.filter((item) => item.id !== notificationId);
        await Promise.all([
          fetchUnreadCount(userId),
          fetchNotifications(userId),
        ]);
      }

      return updated;
    } catch (error: unknown) {
      if (requestRevision !== revision) return null;

      const text = error instanceof Error ? error.message : "Ошибка обновления";

      setError(text);
      throw error;
    }
  };

  const markAllRead = async (userId: string) => {
    const requestRevision = revision;
    const previouslyVisible = new Set(items.value.map((item) => item.id));

    if (!userId?.trim()) {
      return;
    }

    if (!types.value.length) return;

    try {
      const response = await useFetch<void>(
        `/users/${userId}/notifications/read-all?${typeQuery.value}`,
        { method: FETCH_METHOD.post }
      );

      if (requestRevision !== revision) return;

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось отметить все прочитанными");
      }

      for (const id of previouslyVisible) readIds.add(id);
      items.value = items.value.filter(
        (item) => !previouslyVisible.has(item.id)
      );

      await Promise.all([fetchUnreadCount(userId), fetchNotifications(userId)]);
    } catch (error: unknown) {
      if (requestRevision !== revision) return;

      const text = error instanceof Error ? error.message : "Ошибка обновления";

      setError(text);
      throw error;
    }
  };

  const resetSession = () => {
    revision++;
    listRequests.invalidate();
    countRequests.invalidate();
    knownIds.clear();
    readIds.clear();
    activeUserId = null;
    items.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
    setError(null);
  };

  return {
    items,
    unreadCount,
    isLoading,
    isError,
    fetchUnreadCount,
    fetchNotifications,
    hydrate,
    applyIncoming,
    markRead,
    markAllRead,
    resetSession,
  };
});
