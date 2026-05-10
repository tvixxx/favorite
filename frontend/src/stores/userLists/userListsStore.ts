import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { isSuccessStatus } from "@/utils";
import type {
  CreateUserListPayload,
  UpdateUserListPayload,
  UserListDetail,
  UserListSummary,
} from "./types";

export const useUserListsStore = defineStore("userLists", () => {
  const lists = ref<UserListSummary[]>([]);
  const currentList = ref<UserListDetail | null>(null);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

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

    isLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<UserListSummary[]>(`/users/${userId}/lists`, {
        method: FETCH_METHOD.get,
      });

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить списки");
      }

      lists.value = response.data;

      return response.data;
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Ошибка загрузки списков";
      setError(text);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchListById = async (userId: string, listId: string) => {
    if (!userId?.trim() || !listId?.trim()) {
      return null;
    }

    isLoading.value = true;
    setError(null);

    try {
      const response = await useFetch<UserListDetail>(
        `/users/${userId}/lists/${listId}`,
        {
          method: FETCH_METHOD.get,
        }
      );

      if (!isSuccessStatus(response.status)) {
        throw new Error("Не удалось загрузить список");
      }

      currentList.value = response.data;

      return response.data;
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Ошибка загрузки списка";
      setError(text);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const createList = async (userId: string, payload: CreateUserListPayload) => {
    const response = await useFetch<UserListSummary>(`/users/${userId}/lists`, {
      method: FETCH_METHOD.post,
      data: payload,
    });

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
    const response = await useFetch<UserListSummary>(`/users/${userId}/lists/${listId}`, {
      method: FETCH_METHOD.patch,
      data: payload,
    });

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
        labels: updated.labels,
        updatedAt: updated.updatedAt,
      };
    }

    return updated;
  };

  const deleteList = async (userId: string, listId: string) => {
    const response = await useFetch<boolean>(`/users/${userId}/lists/${listId}`, {
      method: FETCH_METHOD.delete,
    });

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
    const response = await useFetch(`/users/${userId}/lists/${listId}/movies`, {
      method: FETCH_METHOD.post,
      data: { movieId },
    });

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
    const response = await useFetch<boolean>(
      `/users/${userId}/lists/${listId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.delete,
      }
    );

    if (!isSuccessStatus(response.status)) {
      throw new Error("Не удалось удалить фильм из списка");
    }

    if (currentList.value?.id === listId) {
      currentList.value = {
        ...currentList.value,
        items: currentList.value.items.filter((item) => item.movieId !== movieId),
      };
    }

    return true;
  };

  const resetSession = () => {
    lists.value = [];
    currentList.value = null;
    isLoading.value = false;
    isError.value = null;
  };

  return {
    lists,
    sortedLists,
    currentList,
    isLoading,
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
