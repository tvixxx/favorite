import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { getDefaultLoaderDelayTime } from "@/constants";
import { isSuccessStatus } from "@/utils";
import type {
  UserMovie,
  UserMovieApiResponse,
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

  // Current movie
  const currentUserMovie = ref<UserMovie | null>(null);
  const isCurrentLoading = ref(false);
  const isCurrentError = ref<string | null>(null);

  // Pagination
  const currentPage = ref(1);
  const pageSize = ref(6);

  // Stats
  const stats = ref<UserMoviesStats | null>(null);
  const isStatsLoading = ref<boolean>(false);
  const isStatsError = ref<string | null>(null);

  // Computed
  const currentList = computed(() => {
    // Текстовый поиск хранится отдельно: пока в сторе есть q — показываем searchResults.
    // Иначе список из GET /users/:id/movies (в т.ч. при фильтрах без поиска).
    if (searchQuery.value.trim()) {
      return searchResults.value;
    }
    return userMovies.value;
  });

  const paginatedUserMovies = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return currentList.value.slice(start, start + pageSize.value);
  });

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
      !!filters.value.watchStatus
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
    filters.value = newFilters;
  };

  const clearSearch = () => {
    searchQuery.value = "";
    searchResults.value = [];
    isSearching.value = false;
  };

  // API calls
  const fetchUserMovies = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      const params = new URLSearchParams();

      for (const g of filters.value.genres ?? []) {
        params.append("genres", g);
      }
      for (const c of filters.value.countryCodes ?? []) {
        params.append("countryCode", c);
      }
      if (filters.value.personalRateMin !== undefined)
        params.append("personalRateMin", String(filters.value.personalRateMin));
      if (filters.value.personalRateMax !== undefined)
        params.append("personalRateMax", String(filters.value.personalRateMax));
      if (filters.value.publishDateFrom)
        params.append("publishDateFrom", filters.value.publishDateFrom);
      if (filters.value.publishDateTo)
        params.append("publishDateTo", filters.value.publishDateTo);
      if (filters.value.isFavorite !== undefined)
        params.append("isFavorite", String(filters.value.isFavorite));
      if (filters.value.seeLater !== undefined)
        params.append("seeLater", String(filters.value.seeLater));
      if (filters.value.watchStatus)
        params.append("watchStatus", filters.value.watchStatus);

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

      if (status !== 200) {
        throw new Error("Ошибка загрузки фильмов");
      }

      setUserMovies(mapUserMoviesFromApi(data));
    } catch (err) {
      setError("Ошибка загрузки фильмов");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
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
    isSearching.value = true;
    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      const params = new URLSearchParams({ q });

      for (const g of filters.value.genres ?? []) {
        params.append("genres", g);
      }
      for (const c of filters.value.countryCodes ?? []) {
        params.append("countryCode", c);
      }
      if (filters.value.personalRateMin !== undefined)
        params.append("personalRateMin", String(filters.value.personalRateMin));
      if (filters.value.personalRateMax !== undefined)
        params.append("personalRateMax", String(filters.value.personalRateMax));
      if (filters.value.publishDateFrom)
        params.append("publishDateFrom", filters.value.publishDateFrom);
      if (filters.value.publishDateTo)
        params.append("publishDateTo", filters.value.publishDateTo);
      if (filters.value.isFavorite !== undefined)
        params.append("isFavorite", String(filters.value.isFavorite));
      if (filters.value.seeLater !== undefined)
        params.append("seeLater", String(filters.value.seeLater));
      if (filters.value.watchStatus)
        params.append("watchStatus", filters.value.watchStatus);

      const endpoint = `/users/${userId}/movies/search?${params.toString()}`;

      const { data, status } = await useFetch<UserMovieApiResponse[]>(
        endpoint,
        {
          method: FETCH_METHOD.get,
        },
      );

      if (status !== 200) {
        throw new Error("Ошибка поиска");
      }

      searchResults.value = mapUserMoviesFromApi(data);
    } catch (err) {
      setError("Ошибка поиска");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
        isSearching.value = false;
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const fetchUserMoviesStats = async (userId: string) => {
    if (!userId?.trim()) {
      return;
    }

    isStatsLoading.value = true;
    isStatsError.value = null;

    const start = Date.now();

    try {
      const { data, status } = await useFetch<UserMoviesStats>(
        `/users/${userId}/movies/stats`,
      );

      if (status !== 200) {
        throw new Error("Ошибка загрузки статистики");
      }

      stats.value = data;
    } catch (err) {
      isStatsError.value = "Ошибка загрузки статистики";
      throw err;
    } finally {
      setTimeout(() => {
        isStatsLoading.value = false;
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

    const response = await useFetch<UserMovieApiResponse>(
      `/users/${userId}/movies`,
      {
        method: FETCH_METHOD.post,
        data: {
          movieId,
          ...data,
        },
      },
    );

    if (response?.data && isSuccessStatus(response.status)) {
      const userMovie = mapUserMovieFromApi(response.data);
      userMovies.value.push(userMovie);
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

    const response = await useFetch<UserMovieApiResponse>(
      `/users/${userId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.patch,
        data,
      },
    );

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

  const fetchUserMovieById = async (
    userId: string,
    movieId: string,
  ): Promise<UserMovie | null> => {
    if (!userId?.trim()) {
      return null;
    }

    isCurrentLoading.value = true;
    isCurrentError.value = null;

    try {
      const { data, status } = await useFetch<UserMovieApiResponse>(
        `/users/${userId}/movies/${movieId}`,
        {
          method: FETCH_METHOD.get,
        },
      );

      if (status !== 200 || !data) {
        return null;
      }

      const mapped = mapUserMovieFromApi(data);

      if (!userMovies.value.some((um) => um.movieId === mapped.movieId)) {
        userMovies.value.push(mapped);
      }

      return mapped;
    } catch {
      return null;
    } finally {
      isCurrentLoading.value = false;
    }
  };

  const removeUserMovie = async (userId: string, movieId: string) => {
    if (!userId?.trim()) {
      throw new Error("Не указан пользователь");
    }

    const response = await useFetch<string>(
      `/users/${userId}/movies/${movieId}`,
      {
        method: FETCH_METHOD.delete,
      },
    );

    if (isSuccessStatus(response.status)) {
      userMovies.value = userMovies.value.filter(
        (um) => um.movieId !== movieId,
      );
      searchResults.value = searchResults.value.filter(
        (um) => um.movieId !== movieId,
      );
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
    userMovies.value = [];
    isLoaded.value = false;
    isLoading.value = false;
    isError.value = null;
    searchResults.value = [];
    searchQuery.value = "";
    isSearching.value = false;
    filters.value = {};
    currentUserMovie.value = null;
    isCurrentLoading.value = false;
    isCurrentError.value = null;
    currentPage.value = 1;
    pageSize.value = 6;
    stats.value = null;
    isStatsLoading.value = false;
    isStatsError.value = null;
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
    currentUserMovie,
    isCurrentLoading,
    isCurrentError,
    currentPage,
    pageSize,
    stats,
    isStatsLoading,
    isStatsError,

    // Computed
    currentList,
    paginatedUserMovies,
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
    addUserMovie,
    updateUserMovie,
    removeUserMovie,
    fetchUserMovieById,
    removeFromSearchResults,
    resetSession,
  };
});
