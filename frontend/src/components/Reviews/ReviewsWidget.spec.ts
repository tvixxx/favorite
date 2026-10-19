import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Review } from "@/stores";
import ReviewsWidget from "./ReviewsWidget.vue";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  reviews: [] as Review[],
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "user-id" }, isLoggedIn: true }),
}));

vi.mock("@/composable/useReviews", () => ({
  useReviews: () => ({
    reviews: ref(mocks.reviews),
    isLoading: ref(false),
    isLoaded: ref(true),
    isError: ref(false),
    totalReviews: ref(0),
    fetchReviews: vi.fn(),
    createReview: mocks.create,
    updateReview: mocks.update,
    deleteReview: vi.fn(),
  }),
}));

describe("Сохранение отзыва", () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.reviews = [];
  });

  it("предлагает редактирование своего отзыва вместо создания второго", async () => {
    mocks.reviews = [
      {
        id: "own-id",
        userId: "user-id",
        text: "Мой старый отзыв",
        rate: 7,
        isSpoiler: true,
      } as Review,
    ];

    const wrapper = mount(ReviewsWidget, {
      props: { movieId: "movie-id" },
      global: {
        stubs: {
          BaseIcon: true,
          ReviewItem: true,
          "a-button": { template: "<button><slot/></button>" },
          ReviewForm: {
            name: "ReviewForm",
            props: ["initialText", "initialRate", "initialIsSpoiler"],
            emits: ["submit"],
            template:
              "<button @click=\"$emit('submit', 'Новый текст отзыва', 8, false)\">Сохранить отзыв</button>",
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.findComponent({ name: "ReviewForm" }).exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    expect(wrapper.getComponent({ name: "ReviewForm" }).props()).toMatchObject({
      initialText: "Мой старый отзыв",
      initialRate: 7,
      initialIsSpoiler: true,
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Сохранить отзыв")!
      .trigger("click");

    await flushPromises();
    expect(mocks.update).toHaveBeenCalledWith("own-id", {
      text: "Новый текст отзыва",
      rate: 8,
      isSpoiler: false,
    });

    expect(mocks.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("не отправляет повторный submit и обрезает пробелы", async () => {
    let finish!: () => void;

    mocks.create.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = mount(ReviewsWidget, {
      props: { movieId: "movie-id" },
      global: {
        stubs: {
          ReviewForm: {
            name: "ReviewForm",
            emits: ["submit"],
            template:
              "<button @click=\"$emit('submit', '  Достаточно длинный отзыв  ', 7, true)\">Сохранить</button>",
          },
          BaseIcon: true,
          StateBlock: true,
          RowsSkeleton: true,
          "a-button": true,
        },
      },
    });
    const button = wrapper.get("button");

    await button.trigger("click");
    await button.trigger("click");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({
      text: "Достаточно длинный отзыв",
      rate: 7,
      movieId: "movie-id",
      isSpoiler: true,
    });

    finish();
    await flushPromises();
    wrapper.unmount();
  });
});
