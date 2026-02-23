import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getDefaultLoaderDelayTime, MOVIES_ENDPOINTS } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { FETCH_METHOD, useFetch } from "@/composable";
import { showErrorRequest } from "@/state/utils";
import {
  ERROR_FETCH_MOVIES_STATS_TEXT,
  ERROR_FETCH_MOVIES_TEXT,
} from "@/state/constants";
import type { Movie, MoviesStats } from "@/stores/movies/types";
import { MOVIE_STORE_NAME } from "@/stores/movies/constants";

export const useMoviesStore = defineStore(MOVIE_STORE_NAME, () => {
  const router = useRouter();

  // Movies
  const moviesList = ref<Movie[]>([]);
  const isMoviesLoaded = ref<boolean>(false);
  const isMoviesLoading = ref(false);
  const isMoviesError = ref<string | null>(null);

  // Movie
  const currentMovie = ref<Movie | null>(null);
  const isMovieLoading = ref(false);
  const isMovieError = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = ref(6);

  // Movies stats
  const moviesStats = ref<MoviesStats | null>(null);
  const isMoviesStatsLoading = ref<boolean>(false);
  const isMoviesStatsError = ref<string | null>(null);

  const setCurrentPage = (page: number) => {
    currentPage.value = page;
  };

  const setPageSize = (size: number) => {
    pageSize.value = size;
    currentPage.value = 1;
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
    setMoviesStatsLoading(true);
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
    currentMovie.value = item;
  };

  const paginatedMovies = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return moviesList.value.slice(start, start + pageSize.value);
  });

  const totalPages = computed(() =>
    Math.ceil(moviesList.value.length / pageSize.value)
  );

  const favoriteMovies = computed(() =>
    moviesList.value.filter((movie: Movie) => movie.isFavorite)
  );

  const isSerial = computed(() => currentMovie.value?.isSerial);

  const seeLater = computed(() => currentMovie.value?.seeLater);

  const createMovie = async (movieData: Partial<Movie>): Promise<void> => {
    const requestData: Partial<Movie> = { ...movieData };

    try {
      const response = await useFetch(MOVIES_ENDPOINTS, {
        method: FETCH_METHOD.post,
        data: requestData,
      });
      const createdAt = new Date();

      if (response?.data && isSuccessStatus(response.status)) {
        const { data } = response;
        const movie: Movie = {
          id: data.id,
          ...movieData,
          isFavorite: movieData.isFavorite || false,
          createdAt,
        } as Movie;
        moviesList.value.push(movie);
      }
    } catch (error) {
      showErrorRequest(error);
    }
  };

  const updateMovie = async (movieData: Movie): Promise<void> => {
    const requestData: Partial<Movie> = { ...movieData };

    try {
      const response = await useFetch(`${MOVIES_ENDPOINTS}/${movieData.id}`, {
        method: FETCH_METHOD.patch,
        data: requestData,
      });

      if (isSuccessStatus(response.status)) {
        // Обновляем локальное состояние
        const movies = moviesList.value.map((movie: Movie) =>
          movie.id === movieData.id ? { ...movie, ...requestData } : movie
        );

        setMovies(movies);
      }
    } catch (error) {
      showErrorRequest(error);
    }
  };

  const removeMovie = async (movieId: string): Promise<void> => {
    try {
      const response = await useFetch(`${MOVIES_ENDPOINTS}/${movieId}`, {
        method: FETCH_METHOD.delete,
      });

      if (isSuccessStatus(response.status)) {
        moviesList.value = moviesList.value.filter(
          (movie) => movie.id !== movieId
        );
      }
    } catch (error) {
      showErrorRequest(error);
    }
  };

  const fetchMovies = async () => {
    setLoadingMovies(true);
    setErrorMovies(null);

    const start = Date.now();

    try {
      const { data, status } = await useFetch(`${MOVIES_ENDPOINTS}`);

      if (status !== 200) {
        router.push("/login");
        return;
      }

      setMovies(data);
    } catch (err) {
      setErrorMovies(ERROR_FETCH_MOVIES_TEXT);
      message.error(isMovieError.value);
    } finally {
      setTimeout(() => {
        setLoadingMovies(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const fetchMoviesStats = async () => {
    setMoviesStatsLoading(true);
    setMoviesStatsError(null);

    const start = Date.now();

    try {
      const { data, status } = await useFetch(`${MOVIES_ENDPOINTS}/stats`);

      if (status !== 200) {
        router.push("/login");
        return;
      }

      setMoviesStats(data);
    } catch (err) {
      setMoviesStatsError(ERROR_FETCH_MOVIES_STATS_TEXT);
      message.error(isMoviesStatsError.value);
    } finally {
      setTimeout(() => {
        setMoviesStatsLoading(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  const getMovieById = (movieId: string | null) => {
    return (
      moviesList.value.find((movie: Movie) => movie.id === movieId) ?? null
    );
  };

  const getMovieDetail = async (movieId: string | null) => {
    if (!isMoviesLoaded.value) {
      setLoadingMovie(true);
      setErrorMovie(null);

      const start = Date.now();

      try {
        const { data, status } = await useFetch(
          `${MOVIES_ENDPOINTS}/${movieId}`,
          {
            method: FETCH_METHOD.get,
          }
        );

        if (status !== 200) {
          setErrorMovie("Ошибка загрузки фильма");
          message.error(isMovieError.value);
          return;
        }

        setCurrentMovie(data);
      } catch (error) {
        showErrorRequest(error);
        setErrorMovie("Ошибка загрузки фильма");
      } finally {
        setTimeout(() => {
          setLoadingMovie(false);
        }, getDefaultLoaderDelayTime(start));
      }

      return;
    }

    if (movieId) {
      const foundMovie = getMovieById(`${movieId}`);

      if (foundMovie) {
        setCurrentMovie(foundMovie);

        return;
      }
    }
  };

  return {
    // Movies refs
    moviesList,
    isMoviesLoaded,
    isMoviesLoading,
    isMoviesError,
    // Movies list refs
    currentPage,
    pageSize,
    // Movies page info refs
    paginatedMovies,
    totalPages,
    favoriteMovies,
    seeLater,
    isSerial,

    // Movie refs
    currentMovie,
    isMovieLoading,
    isMovieError,

    // Movies stats
    moviesStats,
    isMoviesStatsLoading,
    isMoviesStatsError,

    setMovies,
    setCurrentMovie,
    setLoadingMovies,
    setErrorMovies,
    setLoadingMovie,
    setErrorMovie,
    setCurrentPage,
    setPageSize,

    getMovieById,
    getMovieDetail,

    // Movies
    fetchMovies,

    // Movies stats
    fetchMoviesStats,
    setMoviesStatsLoading,
    setMoviesStatsError,

    // Movie handlers
    createMovie,
    updateMovie,
    removeMovie,
  };
});
