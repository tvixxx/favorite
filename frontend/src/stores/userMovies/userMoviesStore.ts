import { defineStore } from "pinia";
import { useUserListsStore } from "@/stores/userLists/userListsStore";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { getDefaultLoaderDelayTime } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { isAxiosError } from "axios";
import { createRequestGuard } from "@/utils/requestGuard";
import { buildUserSearchParams } from "./build-user-search-params";
import type {
  UserMovie,
  UserMovieApiResponse,
  UserMoviesAnalytics,
  UserMoviesFilters,
  UserMoviesStats,
} from "@/stores/movies/types";
import {
  mapUserMovieFromApi,
  mapUserMoviesFromApi,
} from "@/stores/movies/utils";

export const useUserMoviesStore = defineStore("userMovies", () => {
  // State
  const userMovies = ref<UserMovie[]>([]);
  const isLoaded = ref<boolean>(false);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const totalCount = ref(0);
  const isError = ref<string | null>(null);

  // Search
  const searchResults = ref<UserMovie[]>([]);
  const searchQuery = ref<string>("");
  const isSearching = ref<boolean>(false);

  // Filters
  const filters = ref<UserMoviesFilters>({});

  const queryRequests = createRequestGuard();
  const detailRequests = createRequestGuard();
  const statsRequests = createRequestGuard();
  const analyticsRequests = createRequestGuard();
  let sessionRevision = 0;

  // Pagination
  const currentPage = ref(1);
  // Порция догрузки: 20 = 4 полных ряда сетки на десктопе (5 карточек в ряд)
  const pageSize = ref(20);

  // Stats
  const stats = ref<UserMoviesStats | null>(null);
  const isStatsLoading = ref<boolean>(false);
  const isStatsError = ref<string | null>(null);
  const analytics = ref<UserMoviesAnalytics | null>(null);
  const isAnalyticsLoading = ref<boolean>(false);
  const isAnalyticsError = ref<string | null>(null);

  // Computed
  const currentList = computed(() => {
    // Текстовый поиск хранится отдельно: пока в сторе есть q — показываем searchResults.
    // Иначе загруженные страницы коллекции, включая фильтры без поиска.
    if (searchQuery.value.trim()) {
      return searchResults.value;
    }

    return userMovies.value;
  });

  // Догрузка: показываем все порции до текущей включительно («Показать ещё»)
  const visibleUserMovies = computed(() => currentList.value);

  const hasMoreUserMovies = computed(
    () => currentList.value.length < totalCount.value,
  );

  const totalPages = computed(() => {
    return Math.ceil(totalCount.value / pageSize.value);
  });

  const favoriteUserMovies = computed(() =>
    userMovies.value.filter((um) => um.isFavorite),
  );

  const seeLaterUserMovies = computed(() =>
    userMovies.value.filter((um) => um.seeLater),
  );

  const hasActiveFilters = computed(() => {
    return (
      !!searchQuery.value ||
      !!filters.value.genres?.length ||
      !!filters.value.countryCodes?.length ||
      filters.value.personalRateMin !== undefined ||
      filters.value.personalRateMax !== undefined ||
      !!filters.value.publishDateFrom ||
      !!filters.value.publishDateTo ||
      filters.value.isFavorite !== undefined ||
      filters.value.seeLater !== undefined ||
      !!filters.value.watchStatus ||
      filters.value.isSerial !== undefined
    );
  });

  // Actions
  const setLoading = (value: boolean) => {
    isLoading.value = value;
  };

  const setError = (errorText: string | null) => {
    isError.value = errorText;
  };

  const setUserMovies = (items: UserMovie[], total = items.length): void => {
    userMovies.value = items;
    totalCount.value = total;
    isLoaded.value = true;
  };

  const setCurrentPage = (page: number) => {
    currentPage.value = page;
  };

  const setPageSize = (size: number) => {
    pageSize.value = size;
    currentPage.value = 1;
  };

  const setFilters = (newFilters: UserMoviesFilters) => {
    if (JSON.stringify(filters.value) !== JSON.stringify(newFilters)) {
      queryRequests.invalidate();
      isLoaded.value = false;
    }

    filters.value = newFilters;
  };

  const clearSearch = () => {
    queryRequests.invalidate();
    setLoading(false);
    setError(null);
    searchQuery.value = "";
    searchResults.value = [];
    isSearching.value = false;
    isLoadingMore.value = false;
  };

  // API calls
  const requestPage = async (userId: string, query: string, append = false): Promise<void> => {
    if (!userId?.trim()) {
      return;
    }

    const isCurrent = queryRequests.begin();
    searchQuery.value = query;
    isSearching.value = !!query;
    isLoadingMore.value = append;
    if (!append) {
      setLoading(true);
      setError(null);
    }

    const start = Date.now();

    try {
      const params = buildUserSearchParams(filters.value, query || undefined);
      params.set("limit", String(pageSize.value));
      params.set("offset", String(append ? currentList.value.length : 0));

      const queryString = params.toString();
      const endpoint = `/users/${userId}/movies/page${
        queryString ? `?${queryString}` : ""
      }`;

      const { data, status } = await useFetch<{items: UserMovieApiResponse[]; total: number}>(
        endpoint,
        {
          method: FETCH_METHOD.get,
        },
      );
      if (!isCurrent()) return;

      if (status !== 200 || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0) {
        throw new Error("Ошибка загрузки фильмов");
      }

      const incoming = mapUserMoviesFromApi(data.items);
      const loadedIds = new Set(currentList.value.map(row => row.movieId));
      if (append && (data.total !== totalCount.value || incoming.some(row => loadedIds.has(row.movieId)))) {
        await requestPage(userId, query);

        return;
      }

      if ((!incoming.length && data.total > (append ? currentList.value.length : 0)) || new Set(incoming.map(row => row.movieId)).size !== incoming.length) {
        throw new Error("Некорректная страница коллекции");
      }

      const items = append ? [...currentList.value, ...incoming] : incoming;
      if (query) searchResults.value = items;
      else setUserMovies(items, data.total);
      totalCount.value = data.total;
      currentPage.value = append ? currentPage.value + 1 : 1;
      isLoaded.value = true;
    } catch (err) {
      if (!isCurrent()) return;
      if (!append) setError("Ошибка загрузки фильмов");
      throw err;
    } finally {
      if (isCurrent()) isLoadingMore.value = false;
      setTimeout(() => {
        if (isCurrent()) {
          setLoading(false);
          isSearching.value = false;
        }
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const fetchUserMovies = (userId: string): Promise<void> => requestPage(userId, "");
  const searchUserMovies = (userId: string, query: string): Promise<void> => requestPage(userId, query.trim());
  const loadMore = async (userId: string): Promise<void> => {
    if (isLoadingMore.value || isLoading.value || !isLoaded.value || !hasMoreUserMovies.value) return;

    return requestPage(userId, searchQuery.value.trim(), true);
  };

  const fetchUserMoviesStats = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    const isCurrent = statsRequests.begin();
    isStatsLoading.value = true;
    isStatsError.value = null;

    const start = Date.now();

    try {
      const { data, status } = await useFetch<UserMoviesStats>(
        `/users/${userId}/movies/stats`,
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка загрузки статистики");
      }

      stats.value = data;
    } catch (err) {
      if (!isCurrent()) return;
      isStatsError.value = "Ошибка загрузки статистики";
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) isStatsLoading.value = false;
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const fetchUserMoviesAnalytics = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    const isCurrent = analyticsRequests.begin();
    isAnalyticsLoading.value = true;
    isAnalyticsError.value = null;

    const start = Date.now();

    try {
      const { data, status } = await useFetch<UserMoviesAnalytics>(
        `/users/${userId}/movies/analytics`,
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка загрузки аналитики");
      }

      analytics.value = data;
    } catch (err) {
      if (!isCurrent()) return;
      isAnalyticsError.value = "Ошибка загрузки аналитики";
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) isAnalyticsLoading.value = false;
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const refreshDerivedData = async (userId: string): Promise<void> => {
    statsRequests.invalidate();
    analyticsRequests.invalidate();
    stats.value = null;
    analytics.value = null;
    await fetchUserMoviesStats(userId).catch(() => undefined);
  };

  const refreshAfterImport = async (userId: string): Promise<void> => {
    await Promise.allSettled([
      requestPage(userId, searchQuery.value.trim()),
      refreshDerivedData(userId),
    ]);
  };

  const addUserMovie = async (
    userId: string,
    movieId: string,
    data: Partial<UserMovie>,
  ) => {
    if (!userId?.trim()) {
      throw new Error("Не указан пользователь");
    }

    const requestRevision = sessionRevision;
    const response = await useFetch<UserMovieApiResponse>(
      `/users/${userId}/movies`,
      {
        method: FETCH_METHOD.post,
        data: {
          ...data,
          movieId,
        },
      },
    );
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (response?.data && isSuccessStatus(response.status)) {
      const userMovie = mapUserMovieFromApi(response.data);
      if (isLoaded.value) {
        await requestPage(userId, searchQuery.value.trim()).catch(() => undefined);
      } else {
        queryRequests.invalidate();
        userMovies.value = [userMovie, ...userMovies.value.filter((item) => item.movieId !== movieId)];
      }

      await refreshDerivedData(userId);

      return userMovie;
    } else {
      throw new Error("Не удалось добавить фильм");
    }
  };

  const updateUserMovie = async (
    userId: string,
    movieId: string,
    data: Partial<UserMovie>,
  ) => {
    if (!userId?.trim()) {
      throw new Error("Не указан пользователь");
    }

    const requestRevision = sessionRevision;
    const response = await useFetch<UserMovieApiResponse>(
      `/users/${userId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.patch,
        data,
      },
    );
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (isSuccessStatus(response.status)) {
      const updatedUserMovie = mapUserMovieFromApi(response.data);

      userMovies.value = userMovies.value.map((um) =>
        um.movieId === movieId ? updatedUserMovie : um,
      );

      searchResults.value = searchResults.value.map((um) =>
        um.movieId === movieId ? updatedUserMovie : um,
      );
      if (isLoaded.value && (hasActiveFilters.value || searchQuery.value)) {
        await requestPage(userId, searchQuery.value.trim()).catch(() => undefined);
      }

      await refreshDerivedData(userId);

      return updatedUserMovie;
    } else {
      throw new Error("Не удалось обновить фильм");
    }
  };

  const rateUserMovie = async (userId: string, movieId: string, personalRate: number, reviewText: string, isSpoiler?: boolean): Promise<UserMovie> => {
    const requestRevision = sessionRevision;
    const response = await useFetch<UserMovieApiResponse>(`/users/${userId}/movies/${movieId}/rating`, {
      method: FETCH_METHOD.patch, data: { personalRate, reviewText, isSpoiler },
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");
    if (!isSuccessStatus(response.status)) throw new Error("Не удалось сохранить оценку");
    analyticsRequests.invalidate();
    analytics.value = null;
    const updated = mapUserMovieFromApi(response.data);
    userMovies.value = userMovies.value.map((item) => item.movieId === movieId ? updated : item);
    searchResults.value = searchResults.value.map((item) => item.movieId === movieId ? updated : item);
    if (isLoaded.value && (hasActiveFilters.value || searchQuery.value)) {
      await requestPage(userId, searchQuery.value.trim()).catch(() => undefined);
    }

    return updated;
  };

  const fetchUserMovieById = async (
    userId: string,
    movieId: string,
  ): Promise<UserMovie | null> => {
    if (!userId?.trim()) {
      return null;
    }

    const isCurrent = detailRequests.begin();

    try {
      const { data, status } = await useFetch<UserMovieApiResponse>(
        `/users/${userId}/movies/${movieId}`,
        {
          method: FETCH_METHOD.get,
        },
      );
      if (!isCurrent()) return null;

      if (status === 404) {
        forgetMissingMovie(movieId);

        return null;
      }

      if (status !== 200 || !data) throw new Error("Ошибка загрузки фильма");

      const mapped = mapUserMovieFromApi(data);

      if (userMovies.value.some((um) => um.movieId === mapped.movieId)) {
        userMovies.value = userMovies.value.map((item) => item.movieId === mapped.movieId ? mapped : item);
      }

      return mapped;
    } catch (error) {
      if (!isCurrent()) return null;
      if (isAxiosError(error) && error.response?.status === 404) {
        forgetMissingMovie(movieId);

        return null;
      }

      throw error;
    }
  };

  function forgetMissingMovie(movieId: string): void {
    queryRequests.invalidate();
    if (currentList.value.some(item => item.movieId === movieId)) totalCount.value = Math.max(0, totalCount.value - 1);
    userMovies.value = userMovies.value.filter((item) => item.movieId !== movieId);
    searchResults.value = searchResults.value.filter((item) => item.movieId !== movieId);
    isLoaded.value = false;
    setLoading(false);
    isSearching.value = false;
    isLoadingMore.value = false;
    stats.value = null;
    analytics.value = null;
  }

  const removeUserMovie = async (userId: string, movieId: string) => {
    if (!userId?.trim()) {
      throw new Error("Не указан пользователь");
    }

    const requestRevision = sessionRevision;
    const response = await useFetch<string>(
      `/users/${userId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.delete,
      },
    );
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

    if (isSuccessStatus(response.status)) {
      const wasVisible = currentList.value.some((item) => item.movieId === movieId);
      userMovies.value = userMovies.value.filter(
        (um) => um.movieId !== movieId,
      );
      searchResults.value = searchResults.value.filter(
        (um) => um.movieId !== movieId,
      );
      if (wasVisible) totalCount.value = Math.max(0, totalCount.value - 1);
      useUserListsStore().resetSession();
      await refreshDerivedData(userId);
    } else {
      throw new Error("Не удалось удалить фильм");
    }
  };

  const removeFromSearchResults = (movieId: string) => {
    searchResults.value = searchResults.value.filter(
      (um) => um.movieId !== movieId,
    );
  };

  const resetSession = () => {
    sessionRevision++;
    queryRequests.invalidate();
    detailRequests.invalidate();
    statsRequests.invalidate();
    analyticsRequests.invalidate();
    userMovies.value = [];
    isLoaded.value = false;
    isLoading.value = false;
    isLoadingMore.value = false;
    totalCount.value = 0;
    isError.value = null;
    searchResults.value = [];
    searchQuery.value = "";
    isSearching.value = false;
    filters.value = {};
    currentPage.value = 1;
    pageSize.value = 20;
    stats.value = null;
    isStatsLoading.value = false;
    isStatsError.value = null;
    analytics.value = null;
    isAnalyticsLoading.value = false;
    isAnalyticsError.value = null;
  };

  return {
    // State
    userMovies,
    isLoaded,
    isLoading,
    isLoadingMore,
    totalCount,
    isError,
    searchResults,
    searchQuery,
    isSearching,
    filters,
    currentPage,
    pageSize,
    stats,
    isStatsLoading,
    isStatsError,
    analytics,
    isAnalyticsLoading,
    isAnalyticsError,

    // Computed
    currentList,
    visibleUserMovies,
    hasMoreUserMovies,
    totalPages,
    favoriteUserMovies,
    seeLaterUserMovies,
    hasActiveFilters,

    // Actions
    setLoading,
    setError,
    setUserMovies,
    setCurrentPage,
    setPageSize,
    setFilters,
    clearSearch,
    fetchUserMovies,
    loadMore,
    searchUserMovies,
    fetchUserMoviesStats,
    fetchUserMoviesAnalytics,
    refreshAfterImport,
    addUserMovie,
    updateUserMovie,
    rateUserMovie,
    removeUserMovie,
    fetchUserMovieById,
    removeFromSearchResults,
    resetSession,
  };
});
