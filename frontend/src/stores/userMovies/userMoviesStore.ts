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
    // Иначе список из GET /users/:id/movies (в т.ч. при фильтрах без поиска).
    if (searchQuery.value.trim()) {
      return searchResults.value;
    }

    return userMovies.value;
  });

  // Догрузка: показываем все порции до текущей включительно («Показать ещё»)
  const visibleUserMovies = computed(() =>
    currentList.value.slice(0, currentPage.value * pageSize.value),
  );

  const hasMoreUserMovies = computed(
    () => visibleUserMovies.value.length < currentList.value.length,
  );

  const totalPages = computed(() => {
    return Math.ceil(currentList.value.length / pageSize.value);
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

  const setUserMovies = (items: UserMovie[]): void => {
    userMovies.value = items;
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
  };

  // API calls
  const fetchUserMovies = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    const isCurrent = queryRequests.begin();
    isSearching.value = false;
    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      const params = buildUserSearchParams(filters.value);

      const queryString = params.toString();
      const endpoint = `/users/${userId}/movies${
        queryString ? `?${queryString}` : ""
      }`;

      const { data, status } = await useFetch<UserMovieApiResponse[]>(
        endpoint,
        {
          method: FETCH_METHOD.get,
        },
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка загрузки фильмов");
      }

      setUserMovies(mapUserMoviesFromApi(data));
    } catch (err) {
      if (!isCurrent()) return;
      setError("Ошибка загрузки фильмов");
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) setLoading(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const searchUserMovies = async (userId: string, query: string) => {
    if (!userId?.trim()) {
      return;
    }

    const q = query.trim();
    if (!q) {
      clearSearch();

      return fetchUserMovies(userId);
    }

    searchQuery.value = q;
    const isCurrent = queryRequests.begin();
    isSearching.value = true;
    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      const params = buildUserSearchParams(filters.value, q);

      const endpoint = `/users/${userId}/movies/search?${params.toString()}`;

      const { data, status } = await useFetch<UserMovieApiResponse[]>(
        endpoint,
        {
          method: FETCH_METHOD.get,
        },
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка поиска");
      }

      searchResults.value = mapUserMoviesFromApi(data);
    } catch (err) {
      if (!isCurrent()) return;
      setError("Ошибка поиска");
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) {
          setLoading(false);
          isSearching.value = false;
        }
      }, getDefaultLoaderDelayTime(start));
    }
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
      userMovies.value = [...userMovies.value.filter((item) => item.movieId !== movieId), userMovie];

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

      return updatedUserMovie;
    } else {
      throw new Error("Не удалось обновить фильм");
    }
  };

  const rateUserMovie = async (userId: string, movieId: string, personalRate: number, reviewText: string): Promise<UserMovie> => {
    const requestRevision = sessionRevision;
    const response = await useFetch<UserMovieApiResponse>(`/users/${userId}/movies/${movieId}/rating`, {
      method: FETCH_METHOD.patch, data: { personalRate, reviewText },
    });
    if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");
    if (!isSuccessStatus(response.status)) throw new Error("Не удалось сохранить оценку");
    const updated = mapUserMovieFromApi(response.data);
    userMovies.value = userMovies.value.map((item) => item.movieId === movieId ? updated : item);
    searchResults.value = searchResults.value.map((item) => item.movieId === movieId ? updated : item);

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
      } else {
        userMovies.value.push(mapped);
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
    userMovies.value = userMovies.value.filter((item) => item.movieId !== movieId);
    searchResults.value = searchResults.value.filter((item) => item.movieId !== movieId);
    isLoaded.value = false;
    setLoading(false);
    isSearching.value = false;
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
      userMovies.value = userMovies.value.filter(
        (um) => um.movieId !== movieId,
      );
      searchResults.value = searchResults.value.filter(
        (um) => um.movieId !== movieId,
      );
      useUserListsStore().resetSession();
      analytics.value = null;
      await fetchUserMoviesStats(userId).catch(() => undefined);
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
    searchUserMovies,
    fetchUserMoviesStats,
    fetchUserMoviesAnalytics,
    addUserMovie,
    updateUserMovie,
    rateUserMovie,
    removeUserMovie,
    fetchUserMovieById,
    removeFromSearchResults,
    resetSession,
  };
});
