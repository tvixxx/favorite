import { ref } from "vue";
import { defineStore, storeToRefs } from "pinia";
import type { Review } from "@/stores";
import { MOVIES_ENDPOINTS, REVIEWS_ENDPOINT } from "@/constants";
import { FETCH_METHOD, useFetch } from "@/composable/useFetch";
import { isSuccessStatus } from "@/utils";

interface UpdateReviewPayload {
  text: string;
  rate: number;
}
interface CreateReviewPayload extends UpdateReviewPayload {
  movieId: string;
}

export const useReviewsStore = defineStore("movieReviews", () => {
  const reviews = ref<Review[]>([]);
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const isError = ref(false);
  const totalReviews = ref(0);
  const loadedMovieId = ref<string | null>(null);
  let fetchGeneration = 0;
  let sessionRevision = 0;
  const setReviews = (newReviews: Review[]) => {
    reviews.value = newReviews;
    totalReviews.value = newReviews.length;
    isLoaded.value = true;
  };

  const setIsLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setIsError = (error: unknown) => {
    isError.value = !!error;

    if (error) {
      isLoaded.value = false;
    }
  };

  const fetchReviews = async (movieId: string, take: number = 10) => {
    const gen = ++fetchGeneration;

    if (loadedMovieId.value !== movieId) {
      reviews.value = [];
      totalReviews.value = 0;
      isLoaded.value = false;
    }

    loadedMovieId.value = movieId;

    setIsLoading(true);
    setIsError(false);

    try {
      const { data, status } = await useFetch<Review[]>(
        `${MOVIES_ENDPOINTS}/${movieId}/reviews?take=${take}`,
        {
          method: FETCH_METHOD.get,
        }
      );

      if (gen !== fetchGeneration) {
        return;
      }

      if (!isSuccessStatus(status)) {
        throw new Error("Ошибка загрузки отзывов");
      }

      setReviews(data ?? []);
    } catch (err) {
      if (gen !== fetchGeneration) {
        return;
      }

      setIsError(err);
      throw err;
    } finally {
      if (gen === fetchGeneration) {
        setIsLoading(false);
      }
    }
  };

  const createReview = async (payload: CreateReviewPayload): Promise<void> => {
    const requestRevision = sessionRevision;
    const requestedMovieId = payload.movieId;
    try {
      const { data, status } = await useFetch<Review>(`${REVIEWS_ENDPOINT}`, {
        method: FETCH_METHOD.post,
        data: payload,
      });
      if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

      if (!isSuccessStatus(status) || !data) {
        throw new Error("Не удалось создать отзыв");
      }

      const reviewMovieId = data.movieId ?? requestedMovieId;
      const sameMovie = (a: string | null, b: string | undefined | null) =>
        !!a &&
        !!b &&
        String(a).trim() === String(b).trim();

      if (
        reviewMovieId &&
        (loadedMovieId.value === null ||
          sameMovie(loadedMovieId.value, reviewMovieId))
      ) {
        reviews.value = [
          data,
          ...reviews.value.filter((r) => r.id !== data.id),
        ];
        totalReviews.value = reviews.value.length;
        isLoaded.value = true;
        isError.value = false;
      }
    } catch {
      throw new Error("Не удалось создать отзыв");
    }
  };

  const updateReview = async (
    reviewId: string,
    payload: UpdateReviewPayload
  ): Promise<void> => {
    const requestedMovieId = loadedMovieId.value;
    const requestRevision = sessionRevision;
    try {
      const { data, status } = await useFetch<Review>(
        `${REVIEWS_ENDPOINT}/${reviewId}`,
        {
          method: FETCH_METHOD.put,
          data: payload,
        }
      );
      if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

      if (!isSuccessStatus(status) || !data) throw new Error("Не удалось обновить отзыв");
      if (loadedMovieId.value === requestedMovieId) {
        reviews.value = reviews.value.map((review) => {
          return review.id === reviewId ? data : review;
        });
      }
    } catch {
      throw new Error("Не удалось обновить отзыв");
    }
  };

  const deleteReview = async (reviewId: string) => {
    const requestedMovieId = loadedMovieId.value;
    const requestRevision = sessionRevision;
    try {
      const { status } = await useFetch<string>(
        `${REVIEWS_ENDPOINT}/${reviewId}`,
        {
          method: FETCH_METHOD.delete,
        }
      );
      if (requestRevision !== sessionRevision) throw new Error("Сессия изменилась");

      if (!isSuccessStatus(status)) throw new Error("Не удалось удалить отзыв");
      if (loadedMovieId.value === requestedMovieId) {
        reviews.value = reviews.value.filter(
          (review) => review.id !== reviewId
        );
        totalReviews.value = reviews.value.length;
      }
    } catch {
      throw new Error("Не удалось удалить отзыв");
    }
  };

  const resetSession = () => {
    sessionRevision++;
    fetchGeneration++;
    reviews.value = [];
    totalReviews.value = 0;
    loadedMovieId.value = null;
    isLoading.value = false;
    isLoaded.value = false;
    isError.value = false;
  };

  return {
    reviews,
    isLoading,
    isLoaded,
    isError,
    totalReviews,
    loadedMovieId,

    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
    resetSession,
  };
});

/** Сохраняет интерфейс refs для компонентов, которые деструктурируют хук. */
export function useReviews() {
  const store = useReviewsStore();

  return {
    ...storeToRefs(store),
    fetchReviews: store.fetchReviews,
    createReview: store.createReview,
    updateReview: store.updateReview,
    deleteReview: store.deleteReview,
    resetSession: store.resetSession,
  };
}
