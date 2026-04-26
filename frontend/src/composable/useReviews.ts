import { ref } from "vue";
import type { Review } from "@/stores";
import { MOVIES_ENDPOINTS, REVIEWS_ENDPOINT } from "@/constants";
import { FETCH_METHOD, useFetch } from "@/composable/useFetch";
import { isSuccessStatus } from "@/utils";

interface CreateReviewPayload {
  text: string;
  rate: number;
  movieId: string;
}

interface UpdateReviewPayload {
  text: string;
  rate: number;
}

const reviews = ref<Review[]>([]);
const isLoading = ref<boolean>(false);
const isLoaded = ref<boolean>(false);
const isError = ref<boolean>(false);
const totalReviews = ref(0);

export function useReviews() {
  const setReviews = (newReviews: Review[]) => {
    reviews.value = newReviews;
    totalReviews.value = newReviews.length;
    setIsLoaded(true);
  };

  const setIsLoading = (loading: boolean) => {
    isLoading.value = loading;
  };

  const setIsLoaded = (loaded: boolean) => {
    isLoaded.value = loaded;
  };

  const setIsError = (error: any) => {
    isError.value = !!error;
    setIsLoaded(false);
  };

  const fetchReviews = async (movieId: string, take: number = 10) => {
    setIsLoading(true);
    setIsError(false);

    try {
      const { data, status } = await useFetch<Review[]>(
        `${MOVIES_ENDPOINTS}/${movieId}/reviews?take=${take}`,
        {
          method: FETCH_METHOD.get,
        }
      );

      if (!isSuccessStatus(status)) {
        throw new Error("Ошибка загрузки отзывов");
      }

      setReviews(data);
    } catch (err) {
      setIsError(true);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createReview = async (payload: Partial<Review>): Promise<void> => {
    try {
      const { data, status } = await useFetch<Review>(`${REVIEWS_ENDPOINT}`, {
        method: FETCH_METHOD.post,
        data: payload,
      });

      console.log("createReview response:", {
        data,
        status,
        isSuccess: isSuccessStatus(status),
      });

      if (isSuccessStatus(status) && data) {
        reviews.value = [data, ...reviews.value];
        totalReviews.value += 1;
        console.log("reviews after update:", reviews.value);
      }
    } catch (err) {
      console.error("createReview error:", err);
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
    } catch (err) {
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
    } catch (err) {
      throw new Error("Не удалось удалить отзыв");
    }
  };

  return {
    reviews,
    isLoading,
    isLoaded,
    isError,
    totalReviews,

    setReviews,
    setIsLoading,
    setIsLoaded,
    setIsError,

    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  };
}
