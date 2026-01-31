import { defineStore } from "pinia";
import { useMoviesStore } from "@/stores/movies/moviesStore";
import { computed, ref } from "vue";
import { FETCH_METHOD, useFetch } from "@/composable";
import { FAVORITES_ENDPOINT, getDefaultLoaderDelayTime } from "@/constants";
import { isSuccessStatus } from "@/utils";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { FAVORITES_STORE_NAME } from "@/stores/favorites/constants";
import type { Movie } from "@/stores/movies";

export const useFavoritesStore = defineStore(FAVORITES_STORE_NAME, () => {
  const router = useRouter();
  const moviesStore = useMoviesStore();

  // Favorites
  const favoritesList = ref<Movie[]>([]);
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

  const setFavorites = (items: Movie[]): void => {
    favoritesList.value = items;
    setLoading(false);
  };

  const paginatedFavorites = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    return favoritesList.value.slice(start, start + pageSize.value);
  });

  const totalPagesFavorites = computed(() =>
    Math.ceil(favoritesList.value.length / pageSize.value)
  );

  const addToFavorite = async (item: Movie): Promise<void> => {
    const { status } = await useFetch(
      `${FAVORITES_ENDPOINT}/${item.id}`, // Using movies endpoint with movie ID
      {
        method: FETCH_METHOD.patch,
        data: {
          isFavorite: true, // Backend field name
        },
      }
    );

    if (isSuccessStatus(status)) {
      await moviesStore.updateMovie({
        ...item,
        isFavorite: true, // Update the local representation
      });

      // try {
      //   await moviesStore.updateMovie({
      //     ...item,
      //     isFavorite: true, // Update the local representation
      //   });
      // } catch {
      //   await removeFromFavorite(item);
      // }

      const newFavorites = [
        ...favoritesList.value,
        { ...item, isFavorite: true },
      ];

      setFavorites(newFavorites);
    }
  };

  const removeFromFavorite = async (item: Movie): Promise<void> => {
    // Remove from favorite by updating movie's favorite status
    const { status } = await useFetch(
      `${FAVORITES_ENDPOINT}/${item.id}`, // Using movies endpoint with movie ID
      {
        method: FETCH_METHOD.patch,
        data: {
          isFavorite: false, // Backend field name
        },
      }
    );

    if (isSuccessStatus(status)) {
      await moviesStore.updateMovie({
        ...item,
        isFavorite: false, // Update the local representation
      });

      favoritesList.value = favoritesList.value.filter(
        (favorite) => favorite.id !== item.id // Changed from favoriteId to id
      );
    }
  };

  const fetchFavorites = async () => {
    setLoading(true);
    setError(null);

    const start = Date.now();

    try {
      // Fetch all movies and filter for favorites
      const { data, status } = await useFetch(`${FAVORITES_ENDPOINT}`); // Using movies endpoint

      if (status !== 200) {
        router.push("/login");
        return;
      }

      // Filter for favorite movies only
      const favoriteMovies = data.filter((movie: Movie) => movie.isFavorite);
      setFavorites(favoriteMovies);
    } catch (err) {
      setError("Ошибка загрузки избранного. Пожалуйста, попробуйте позже.");
      message.error(isError.value);
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
