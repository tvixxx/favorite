import { ref } from "vue";
import type { Review } from "@/stores";
import { MOVIES_ENDPOINTS, REVIEWS_ENDPOINT } from "@/constants";
import { FETCH_METHOD, useFetch } from "@/composable/useFetch";
import { isSuccessStatus } from "@/utils";

interface UpdateReviewPayload {
  text: string;
  rate: number;
}

const reviews = ref<Review[]>([]);
const isLoading = ref<boolean>(false);
const isLoaded = ref<boolean>(false);
const isError = ref<boolean>(false);
const totalReviews = ref(0);
const loadedMovieId = ref<string | null>(null);
let fetchGeneration = 0;

export function useReviews() {
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

  const createReview = async (payload: Partial<Review>): Promise<void> => {
    const requestedMovieId = payload.movieId;
    try {
      const { data, status } = await useFetch<Review>(`${REVIEWS_ENDPOINT}`, {
        method: FETCH_METHOD.post,
        data: payload,
      });

      if (!isSuccessStatus(status) || !data) {
        return;
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
    try {
      const { data, status } = await useFetch<Review>(
        `${REVIEWS_ENDPOINT}/${reviewId}`,
        {
          method: FETCH_METHOD.put,
          data: payload,
        }
      );

      if (isSuccessStatus(status) && data) {
        reviews.value = reviews.value.map((review) => {
          return review.id === reviewId ? data : review;
        });
      }
    } catch {
      throw new Error("Не удалось обновить отзыв");
    }
  };

  const deleteReview = async (reviewId: string) => {
    try {
      const { data, status } = await useFetch<string>(
        `${REVIEWS_ENDPOINT}/${reviewId}`,
        {
          method: FETCH_METHOD.delete,
        }
      );

      if (isSuccessStatus(status) && data) {
        reviews.value = reviews.value.filter(
          (review) => review.id !== reviewId
        );
        totalReviews.value -= 1;
      }
    } catch {
      throw new Error("Не удалось удалить отзыв");
    }
  };

  return {
    reviews,
    isLoading,
    isLoaded,
    isError,
    totalReviews,

    setIsLoading,
    setIsError,

    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  };
}
