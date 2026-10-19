import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Review } from "@/stores";
import MovieDetail from "./MovieDetail.vue";

const mocks = vi.hoisted(() => ({
  average: 5.3 as number | null,
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
const reviews = ref<Review[]>([]);
const ownReview = {
  id: "own-review",
  movieId: "movie-id",
  userId: "user-id",
  text: "Существующий отзыв",
  rate: 7,
} as Review;

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "movie-id" }, query: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ isLoggedIn: true, userData: { id: "user-id" } }),
}));

vi.mock("@/state/utils", () => ({ showErrorRequest: vi.fn() }));
vi.mock("@/services/api", () => ({
  getApiResponseMessage: vi.fn(),
  isApiConflictError: () => false,
}));

vi.mock("@/stores", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useUserListsStore: () => ({ lists: [], isLoading: false }),
  useUserMoviesStore: () => ({
    userMovies: [],
    fetchUserMovieById: async () => ({
      id: "entry-id",
      movieId: "movie-id",
      userId: "user-id",
      personalRate: 6,
      watchStatus: "NOT_STARTED",
      createdAt: "2026-10-13T10:00:00Z",
      movie: {
        id: "movie-id",
        title: "Тестовый фильм",
        description: "Описание фильма",
        genres: [],
        countryCodes: [],
        actors: [],
        averageRating: mocks.average,
      },
    }),
  }),
}));

vi.mock("@/composable/useReviews", () => ({
  useReviews: () => ({
    reviews,
    totalReviews: computed(() => reviews.value.length),
    isLoading: ref(false),
    isLoaded: ref(true),
    isError: ref(false),
    fetchReviews: vi.fn(),
    createReview: mocks.create,
    updateReview: mocks.update,
    deleteReview: mocks.remove,
  }),
}));

vi.mock("@/composable", () => ({
  useFetch: async () => ({ status: 200, data: [] }),
  useEscapeKey: vi.fn(),
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("@/components/Skeleton/useMinLoading", () => ({
  useMinLoading: (get: () => boolean) => computed(get),
}));

describe("Средняя оценка на странице фильма", () => {
  let wrapper: ReturnType<typeof mount>;

  beforeEach(() => {
    mocks.average = 5.3;
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.remove.mockReset();
    reviews.value = [];
  });

  afterEach(() => wrapper?.unmount());

  const render = async (): Promise<void> => {
    wrapper = mount(MovieDetail, {
      global: {
        stubs: {
          BaseIcon: true,
          BaseModal: true,
          MovieShareButton: true,
          WatchStatusSelect: true,
          RateMovieModal: true,
          DetailSkeleton: true,
          "a-input": true,
          "a-input-number": true,
          ReviewItem: {
            props: ["review"],
            emits: ["edit", "delete"],
            template: `<article>
              <p>{{ review.text }}</p>
              <button @click="$emit('delete', review.id)">Удалить отзыв</button>
            </article>`,
          },
          ReviewForm: {
            emits: ["submit"],
            template: `<button @click="$emit('submit', 'Новый текст отзыва', 7)">Сохранить отзыв</button>`,
          },
          "a-button": { template: "<button><slot/></button>" },
        },
      },
    });

    await flushPromises();
  };

  const click = async (text: string): Promise<void> => {
    const button = wrapper
      .findAll("button")
      .find((item) => item.text() === text);

    expect(button).toBeDefined();
    await button!.trigger("click");
    await flushPromises();
  };

  const average = () => wrapper.findAll(".detail-panel__rate-num")[1].text();

  it("показывает серверную среднюю после создания, а не среднюю загруженных отзывов", async () => {
    mocks.create.mockImplementation(async () => {
      reviews.value = [ownReview];
      mocks.average = 8.7;
    });

    await render();
    expect(average()).toBe("5,3");
    await click("Сохранить отзыв");
    expect(average()).toBe("8,7");
    expect(wrapper.get(".detail-panel__rate-num_mine").text()).toBe("6");
  });

  it("обновляет среднюю после редактирования своего отзыва", async () => {
    reviews.value = [ownReview];
    mocks.update.mockImplementation(async () => {
      mocks.average = 6.4;
    });

    await render();
    await click("Редактировать мой отзыв");
    await click("Сохранить отзыв");
    expect(average()).toBe("6,4");
  });

  it("убирает среднюю после удаления последнего отзыва", async () => {
    reviews.value = [ownReview];
    mocks.remove.mockImplementation(async () => {
      reviews.value = [];
      mocks.average = null;
    });

    await render();
    await click("Удалить отзыв");
    expect(average()).toBe("нет");
  });

  it("сохраняет прежнюю оценку и форму при ошибке отправки", async () => {
    mocks.create.mockRejectedValue(new Error("Нет соединения"));
    await render();
    await click("Сохранить отзыв");
    expect(average()).toBe("5,3");
    expect(wrapper.text()).toContain("Сохранить отзыв");
  });
});
