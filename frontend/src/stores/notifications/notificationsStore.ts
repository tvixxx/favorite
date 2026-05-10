import { defineStore } from "pinia";
import { ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import type { NotificationDto } from "./types";

export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref<NotificationDto[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

  const setError = (next: string | null) => {
    isError.value = next;
  };

  const fetchUnreadCount = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    try {
      const response = await useFetch<number>(
        `/users/${userId}/notifications/unread-count`,
        { method: FETCH_METHOD.get },
      );

      if (isSuccessStatus(response.status)) {
        unreadCount.value =
          typeof response.data === "number" ? response.data : 0;
      }
    } catch {
      // ignore — badge optional
    }
  };

  const fetchNotifications = async (userId: string, limit = 30) => {
    if (!userId?.trim()) {
      return [];
    }

    isLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<NotificationDto[]>(
        `/users/${userId}/notifications?limit=${limit}`,
        { method: FETCH_METHOD.get },
      );

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить уведомления");
      }

      items.value = response.data;

      return response.data;
    } catch (error: unknown) {
      const text =
        error instanceof Error ? error.message : "Ошибка загрузки уведомлений";
      setError(text);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const hydrate = async (userId: string) => {
    await fetchUnreadCount(userId);
    await fetchNotifications(userId);
  };

  const applyIncoming = (dto: NotificationDto) => {
    const idx = items.value.findIndex((n) => n.id === dto.id);

    if (idx >= 0) {
      items.value[idx] = dto;
    } else {
      items.value = [dto, ...items.value];
    }

    if (idx < 0 && dto.readAt === null) {
      unreadCount.value += 1;
    }
  };

  const markRead = async (userId: string, notificationId: string) => {
    if (!userId?.trim() || !notificationId?.trim()) {
      return null;
    }

    try {
      const response = await useFetch<NotificationDto | null>(
        `/users/${userId}/notifications/${notificationId}/read`,
        { method: FETCH_METHOD.patch },
      );

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось отметить прочитанным");
      }

      const updated = response.data;

      if (updated) {
        const i = items.value.findIndex((n) => n.id === notificationId);

        if (i >= 0) {
          items.value[i] = updated;
        }

        await fetchUnreadCount(userId);
      }

      return updated;
    } catch (error: unknown) {
      const text =
        error instanceof Error ? error.message : "Ошибка обновления";
      setError(text);
      throw error;
    }
  };

  const markAllRead = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    try {
      const response = await useFetch<void>(
        `/users/${userId}/notifications/read-all`,
        { method: FETCH_METHOD.post },
      );

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось отметить все прочитанными");
      }

      const now = new Date().toISOString();

      items.value = items.value.map((n) => ({
        ...n,
        readAt: n.readAt ?? now,
      }));
      unreadCount.value = 0;
    } catch (error: unknown) {
      const text =
        error instanceof Error ? error.message : "Ошибка обновления";
      setError(text);
      throw error;
    }
  };

  const resetSession = () => {
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
