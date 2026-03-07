import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { getDefaultLoaderDelayTime, MOVIES_ENDPOINTS } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { FAVORITES_STORE_NAME } from "@/stores/favorites/constants";
import {
  type Movie,
  type MovieApiResponse,
  useMoviesStore,
} from "@/stores/movies";
import { mapMoviesFromApi } from "@/stores/movies/utils";

export const useFavoritesStore = defineStore(FAVORITES_STORE_NAME, () => {
  const moviesStore = useMoviesStore();

  // Favorites
  const isError = ref<string | null>(null);
  const isLoading = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(6);

  const setCurrentPage = (page: number) => {
    currentPage.value = page;
  };

  const setPageSize = (size: number) => {
    pageSize.value = size;
    currentPage.value = 1;
  };

  const setLoading = (value: boolean) => {
    isLoading.value = value;
  };

  const setError = (errorText: string | null) => {
    isError.value = errorText;
  };

  const favoritesList = computed(() =>
    moviesStore.moviesList.filter((movie) => movie.isFavorite)
  );

  const paginatedFavorites = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return favoritesList.value.slice(start, start + pageSize.value);
  });

  const totalPagesFavorites = computed(() =>
    Math.ceil(favoritesList.value.length / pageSize.value)
  );

  const addToFavorite = async (item: Movie): Promise<void> => {
    const { status } = await useFetch(`${MOVIES_ENDPOINTS}/${item.id}`, {
      method: FETCH_METHOD.patch,
      data: {
        isFavorite: true,
      },
    });

    if (isSuccessStatus(status)) {
      const updatedMovies = moviesStore.moviesList.map((movie) =>
        movie.id === item.id ? { ...movie, isFavorite: true } : movie
      );
      moviesStore.setMovies(updatedMovies);
    } else {
      throw new Error("Не удалось добавить в избранное");
    }
  };

  const removeFromFavorite = async (item: Movie): Promise<void> => {
    const { status } = await useFetch(`${MOVIES_ENDPOINTS}/${item.id}`, {
      method: FETCH_METHOD.patch,
      data: {
        isFavorite: false,
      },
    });

    if (isSuccessStatus(status)) {
      const updatedMovies = moviesStore.moviesList.map((movie) =>
        movie.id === item.id ? { ...movie, isFavorite: false } : movie
      );
      moviesStore.setMovies(updatedMovies);
    } else {
      throw new Error("Не удалось убрать из избранного");
    }
  };

  const fetchFavorites = async () => {
    if (moviesStore.isMoviesLoaded) {
      return;
    }

    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      const { data, status } = await useFetch<MovieApiResponse[]>(
        `${MOVIES_ENDPOINTS}`
      );

      if (status !== 200) {
        throw new Error("Ошибка загрузки избранного");
      }

      moviesStore.setMovies(mapMoviesFromApi(data));
    } catch (err) {
      setError("Ошибка загрузки избранного");
      throw err;
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, getDefaultLoaderDelayTime(start));
    }
  };

  return {
    // Favorites refs
    favoritesList,
    isError,
    isLoading,
    // Favorites list refs
    pageSize,
    currentPage,
    // Favorites page info refs
    paginatedFavorites,
    totalPagesFavorites,

    // Favorites setters
    setPageSize,
    setCurrentPage,

    // Favorites
    fetchFavorites,
    // Favorite handlers
    addToFavorite,
    removeFromFavorite,
  };
});
