import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import { createRequestGuard } from "@/utils/requestGuard";
import type {
  CreateUserListPayload,
  UpdateUserListPayload,
  UserListDetail,
  UserListSummary,
} from "./types";

export const useUserListsStore = defineStore("userLists", () => {
  const lists = ref<UserListSummary[]>([]);
  const currentList = ref<UserListDetail | null>(null);
  const isListLoading = ref(false);
  const isDetailLoading = ref(false);
  const isLoading = computed(() => isListLoading.value || isDetailLoading.value);
  const isError = ref<string | null>(null);
  const listRequests = createRequestGuard();
  const detailRequests = createRequestGuard();
  let sessionRevision = 0;

  const sortedLists = computed(() =>
    [...lists.value].sort((a, b) => {
      return b.createdAt.localeCompare(a.createdAt);
    })
  );

  const setError = (next: string | null) => {
    isError.value = next;
  };

  const fetchLists = async (userId: string) => {
    if (!userId?.trim()) {
      return [];
    }

    const isCurrent = listRequests.begin();
    isListLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<UserListSummary[]>(`/users/${userId}/lists`, {
        method: FETCH_METHOD.get,
      });
      if (!isCurrent()) return [];

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить списки");
      }

      lists.value = response.data;

      return response.data;
    } catch (error: unknown) {
      if (!isCurrent()) return [];
      const text = error instanceof Error ? error.message : "Ошибка загрузки списков";
      setError(text);
      throw error;
    } finally {
      if (isCurrent()) isListLoading.value = false;
    }
  };

  const fetchListById = async (userId: string, listId: string) => {
    if (!userId?.trim() || !listId?.trim()) {
      return null;
    }

    const isCurrent = detailRequests.begin();
    if (currentList.value?.id !== listId) currentList.value = null;
    isDetailLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<UserListDetail>(
        `/users/${userId}/lists/${listId}`,
        {
          method: FETCH_METHOD.get,
        }
      );
      if (!isCurrent()) return null;

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить список");
      }

      currentList.value = response.data;

      return response.data;
    } catch (error: unknown) {
      if (!isCurrent()) return null;
      const text = error instanceof Error ? error.message : "Ошибка загрузки списка";
      setError(text);
      throw error;
    } finally {
      if (isCurrent()) isDetailLoading.value = false;
    }
  };

  const createList = async (userId: string, payload: CreateUserListPayload) => {
    const requestRevision = sessionRevision;
    const response = await useFetch<UserListSummary>(`/users/${userId}/lists`, {
      method: FETCH_METHOD.post,
      data: payload,
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось создать список");
    }

    const next = response.data;
    const existIdx = lists.value.findIndex((item) => item.id === next.id);

    if (existIdx >= 0) {
      lists.value[existIdx] = next;
    } else {
      lists.value.unshift(next);
    }

    return next;
  };

  const updateList = async (
    userId: string,
    listId: string,
    payload: UpdateUserListPayload
  ) => {
    const requestRevision = sessionRevision;
    const response = await useFetch<UserListSummary>(`/users/${userId}/lists/${listId}`, {
      method: FETCH_METHOD.patch,
      data: payload,
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось обновить список");
    }

    const updated = response.data;
    lists.value = lists.value.map((item) => (item.id === updated.id ? updated : item));

    if (currentList.value?.id === updated.id) {
      currentList.value = {
        ...currentList.value,
        name: updated.name,
        description: updated.description,
        color: updated.color,
        labels: updated.labels,
        updatedAt: updated.updatedAt,
      };
    }

    return updated;
  };

  const deleteList = async (userId: string, listId: string) => {
    const requestRevision = sessionRevision;
    const response = await useFetch<boolean>(`/users/${userId}/lists/${listId}`, {
      method: FETCH_METHOD.delete,
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось удалить список");
    }

    lists.value = lists.value.filter((item) => item.id !== listId);

    if (currentList.value?.id === listId) {
      currentList.value = null;
    }

    return true;
  };

  const addMovieToList = async (userId: string, listId: string, movieId: string) => {
    const requestRevision = sessionRevision;
    const response = await useFetch(`/users/${userId}/lists/${listId}/movies`, {
      method: FETCH_METHOD.post,
      data: { movieId },
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось добавить тайтл в список");
    }

    lists.value = lists.value.map((list) => {
      if (list.id !== listId) {
        return list;
      }

      return {
        ...list,
        _count: {
          ...list._count,
          items: list._count.items + 1,
        },
      };
    });

    return response.data;
  };

  const removeMovieFromList = async (
    userId: string,
    listId: string,
    movieId: string
  ) => {
    const requestRevision = sessionRevision;
    const response = await useFetch<boolean>(
      `/users/${userId}/lists/${listId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.delete,
      }
    );
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось удалить фильм из списка");
    }

    if (currentList.value?.id === listId) {
      currentList.value = {
        ...currentList.value,
        items: currentList.value.items.filter((item) => item.movieId !== movieId),
      };
    }

    lists.value = lists.value.map((list) => list.id === listId ? {
      ...list, _count: { ...list._count, items: Math.max(0, list._count.items - 1) },
    } : list);

    return true;
  };

  const resetSession = () => {
    sessionRevision++;
    listRequests.invalidate();
    detailRequests.invalidate();
    lists.value = [];
    currentList.value = null;
    isListLoading.value = false;
    isDetailLoading.value = false;
    isError.value = null;
  };

  return {
    lists,
    sortedLists,
    currentList,
    isLoading,
    isListLoading,
    isDetailLoading,
    isError,
    fetchLists,
    fetchListById,
    createList,
    updateList,
    deleteList,
    addMovieToList,
    removeMovieFromList,
    resetSession,
  };
});
