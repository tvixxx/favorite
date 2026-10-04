import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import ReviewsWidget from "./ReviewsWidget.vue";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: { id: "user-id" }, isLoggedIn: true }) }));
vi.mock("@/composable/useReviews", () => ({ useReviews: () => ({
  reviews: ref([]), isLoading: ref(false), isLoaded: ref(true), isError: ref(false), totalReviews: ref(0),
  fetchReviews: vi.fn(), createReview: mocks.create, updateReview: vi.fn(), deleteReview: vi.fn(),
}) }));

describe("Сохранение отзыва", () => {
  it("не отправляет повторный submit и обрезает пробелы", async () => {
    let finish!: () => void;
    mocks.create.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    const wrapper = mount(ReviewsWidget, { props: { movieId: "movie-id" }, global: { stubs: {
      ReviewForm: { name: "ReviewForm", emits: ["submit"], template: '<button @click="$emit(\'submit\', \'  Достаточно длинный отзыв  \', 7)">Сохранить</button>' },
      BaseIcon: true, StateBlock: true, RowsSkeleton: true, "a-button": true,
    } } });
    const button = wrapper.get("button");
    await button.trigger("click");
    await button.trigger("click");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith({ text: "Достаточно длинный отзыв", rate: 7, movieId: "movie-id" });
    finish();
    await flushPromises();
    wrapper.unmount();
  });
});
