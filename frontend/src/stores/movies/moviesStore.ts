import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getDefaultLoaderDelayTime, MOVIES_ENDPOINTS } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { FETCH_METHOD, useFetch } from "@/composable";
import {
  ERROR_FETCH_MOVIES_STATS_TEXT,
  ERROR_FETCH_MOVIES_TEXT,
} from "@/state/constants";
import type {
  Movie,
  MoviesStats,
  MovieApiResponse,
  MoviesFilters,
  CreateMoviePayload,
} from "@/stores/movies/types";
import { MOVIE_STORE_NAME } from "@/stores/movies/constants";
import { createRequestGuard } from "@/utils/requestGuard";
import {
  buildSearchParams,
  mapMovieFromApi,
  mapMoviesFromApi,
} from "@/stores/movies/utils";

export const useMoviesStore = defineStore(MOVIE_STORE_NAME, () => {
  // Movies
  const moviesList = ref<Movie[]>([]);
  const isMoviesLoaded = ref<boolean>(false);
  const isMoviesLoading = ref(false);
  const isMoviesError = ref<string | null>(null);

  // Search
  const searchResults = ref<Movie[]>([]);
  const searchQuery = ref<string>("");
  const isSearching = ref<boolean>(false);

  // Filters
  const filters = ref<MoviesFilters>({});

  // Movie
  const currentMovie = ref<Movie | null>(null);
  const isMovieLoading = ref(false);
  const isMovieError = ref<string | null>(null);
  const currentPage = ref(1);
  // Порция догрузки: 20 = 4 полных ряда сетки на десктопе (5 карточек в ряд)
  const pageSize = ref(20);

  // Movies stats
  const moviesStats = ref<MoviesStats | null>(null);
  const isMoviesStatsLoading = ref<boolean>(false);
  const isMoviesStatsError = ref<string | null>(null);
  const queryRequests = createRequestGuard();
  const detailRequests = createRequestGuard();
  const statsRequests = createRequestGuard();

  const setCurrentPage = (page: number) => {
    currentPage.value = page;
  };

  const setLoadingMovies = (value: boolean) => {
    isMoviesLoading.value = value;
  };

  const setErrorMovies = (errorText: string | null) => {
    isMoviesError.value = errorText;
  };

  const setMovies = (items: Movie[]): void => {
    moviesList.value = items;
    isMoviesLoaded.value = true;
  };

  const setMoviesStats = (stats: MoviesStats): void => {
    moviesStats.value = stats;
  };

  const setMoviesStatsLoading = (isLoading: boolean): void => {
    isMoviesStatsLoading.value = isLoading;
  };

  const setMoviesStatsError = (error: string | null): void => {
    isMoviesStatsError.value = error;
  };

  const setLoadingMovie = (value: boolean) => {
    isMovieLoading.value = value;
  };

  const setErrorMovie = (errorText: string | null) => {
    isMovieError.value = errorText;
  };

  const setCurrentMovie = (item: Movie | null): void => {
    if (!item) {
      detailRequests.invalidate();
      setLoadingMovie(false);
      setErrorMovie(null);
    }

    currentMovie.value = item;
  };

  const setFilters = (newFilters: MoviesFilters) => {
    queryRequests.invalidate();
    isMoviesLoaded.value = false;
    filters.value = newFilters;
  };

  const currentMoviesList = computed(() => {
    if (searchQuery.value.trim()) {
      return searchResults.value;
    }

    return moviesList.value;
  });

  // Догрузка: показываем все порции до текущей включительно («Показать ещё»)
  const visibleMovies = computed(() =>
    currentMoviesList.value.slice(0, currentPage.value * pageSize.value),
  );

  const hasMoreMovies = computed(
    () => visibleMovies.value.length < currentMoviesList.value.length,
  );

  const hasActiveFilters = computed(() => {
    return (
      !!searchQuery.value ||
      !!filters.value.genres?.length ||
      !!filters.value.countryCodes?.length ||
      !!filters.value.publishDateFrom ||
      !!filters.value.publishDateTo ||
      !!filters.value.actorIds?.length
    );
  });

  const createMovie = async (movieData: CreateMoviePayload): Promise<Movie> => {
    const response = await useFetch<MovieApiResponse>(MOVIES_ENDPOINTS, {
      method: FETCH_METHOD.post,
      data: movieData,
    });

    if (response?.data && isSuccessStatus(response.status)) {
      const movie = mapMovieFromApi(response.data);
      moviesList.value = [movie, ...moviesList.value.filter((item) => item.id !== movie.id)];
      moviesStats.value = null;

      return movie;
    } else {
      throw new Error("Не удалось создать фильм");
    }
  };

  const clearSearch = () => {
    queryRequests.invalidate();
    setLoadingMovies(false);
    setErrorMovies(null);
    searchQuery.value = "";
    searchResults.value = [];
    isSearching.value = false;
  };

  const fetchMovies = async (query = "") => {
    const isCurrent = queryRequests.begin();
    query = query.trim();
    searchQuery.value = query;
    isSearching.value = !!query;
    currentPage.value = 1;
    setLoadingMovies(true);
    setErrorMovies(null);

    const start = Date.now();

    try {
      const params = buildSearchParams(filters.value, query);
      let endpoint = MOVIES_ENDPOINTS;

      if (query) {
        endpoint = `${MOVIES_ENDPOINTS}/search`;
      }

      const queryString = params.toString();
      if (queryString) {
        endpoint = `${endpoint}${
          endpoint.includes("?") ? "&" : "?"
        }${queryString}`;
      }

      const { data, status } = await useFetch<MovieApiResponse[]>(endpoint, {
        method: FETCH_METHOD.get,
      });
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error(ERROR_FETCH_MOVIES_TEXT);
      }

      if (query) searchResults.value = mapMoviesFromApi(data);
      else setMovies(mapMoviesFromApi(data));
    } catch (err) {
      if (!isCurrent()) return;
      setErrorMovies(ERROR_FETCH_MOVIES_TEXT);
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) {
          setLoadingMovies(false);
          isSearching.value = false;
        }
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const findMovie = (query: string) => fetchMovies(query);

  const fetchMoviesStats = async () => {
    const isCurrent = statsRequests.begin();
    setMoviesStatsLoading(true);
    setMoviesStatsError(null);

    const start = Date.now();

    try {
      const { data, status } = await useFetch<MoviesStats>(
        `${MOVIES_ENDPOINTS}/stats`,
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error(ERROR_FETCH_MOVIES_STATS_TEXT);
      }

      setMoviesStats(data);
    } catch (err) {
      if (!isCurrent()) return;
      setMoviesStatsError(ERROR_FETCH_MOVIES_STATS_TEXT);
      throw err;
    } finally {
      setTimeout(() => {
        if (isCurrent()) setMoviesStatsLoading(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const getMovieDetail = async (movieId: string | null) => {
    if (!movieId) {
      return;
    }

    const isCurrent = detailRequests.begin();
    if (currentMovie.value?.id !== movieId) currentMovie.value = null;

    setLoadingMovie(true);
    setErrorMovie(null);

    const start = Date.now();

    try {
      const { data, status } = await useFetch<MovieApiResponse>(
        `${MOVIES_ENDPOINTS}/${movieId}`,
        {
          method: FETCH_METHOD.get,
        },
      );
      if (!isCurrent()) return;

      if (status !== 200) {
        throw new Error("Ошибка загрузки фильма");
      }

      setCurrentMovie(mapMovieFromApi(data));
    } catch (error) {
      if (!isCurrent()) return;
      setErrorMovie("Ошибка загрузки фильма");
      throw error;
    } finally {
      setTimeout(() => {
        if (isCurrent()) setLoadingMovie(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  return {
    // Movies refs
    moviesList,
    isMoviesLoaded,
    isMoviesLoading,
    isMoviesError,
    searchResults,
    // Movies list refs
    currentPage,
    pageSize,
    currentMoviesList,
    // Movies page info refs
    visibleMovies,
    hasMoreMovies,

    // Movie refs
    currentMovie,
    isMovieLoading,
    isMovieError,

    // Movies stats
    moviesStats,
    isMoviesStatsLoading,
    isMoviesStatsError,

    setCurrentMovie,
    setCurrentPage,
    getMovieDetail,

    // Movies
    fetchMovies,

    // Movies stats
    fetchMoviesStats,

    // Movie handlers
    createMovie,

    // Search
    findMovie,
    clearSearch,
    searchQuery,
    isSearching,

    // Filters
    filters,
    setFilters,
    hasActiveFilters,
  };
});
