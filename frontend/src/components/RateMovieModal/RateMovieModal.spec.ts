import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RateMovieModal from "./RateMovieModal.vue";

const mocks = vi.hoisted(() => ({ writes: [] as string[], atomic: vi.fn(), fetchReviews: vi.fn() }));
const updated = { movieId: "movie-id", personalRate: 7, movie: { averageRating: 7 } };
const reviews = ref([{ id: "review-id", userId: "user-id", rate: 6, text: "Существующий отзыв" }]);
vi.mock("@/stores", () => ({ useUserMoviesStore: () => ({
  rateUserMovie: mocks.atomic,
  updateUserMovie: async () => { mocks.writes.push("personal");

 return updated; },
}) }));
vi.mock("@/state/state", () => ({ useMainStore: () => ({ userData: { id: "user-id" } }) }));
vi.mock("@/composable/useReviews", () => ({ useReviews: () => ({
  reviews, fetchReviews: mocks.fetchReviews,
  createReview: async () => { mocks.writes.push("review"); },
  updateReview: async () => { mocks.writes.push("review"); },
}) }));

describe("Сохранение личной оценки с отзывом", () => {
  let wrapper: ReturnType<typeof mount>;
  beforeEach(() => {
    mocks.writes = [];
    mocks.atomic.mockReset();
    mocks.atomic.mockImplementation(async () => { mocks.writes.push("atomic");

 return updated; });
    mocks.fetchReviews.mockResolvedValue(undefined);
  });
  afterEach(() => wrapper?.unmount());
  const open = async (personalRate: number | null) => {
    wrapper = mount(RateMovieModal, { props: {
      modelValue: false, movieId: "movie-id", title: "Фильм", year: "2026", kind: "фильм", personalRate,
    }, global: { stubs: {
      BaseModal: { props: ["modelValue"], template: '<section v-if="modelValue"><slot name="body"/><slot name="footer"/></section>' },
      BaseIcon: true, "a-rate": true, "a-textarea": true,
      "a-button": { props: ["disabled"], emits: ["click"], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot/></button>' },
    } } });
    await wrapper.setProps({ modelValue: true });
  };

  it("сохраняет через один атомарный запрос и возвращает обновлённую запись", async () => {
    await open(7);
    await wrapper.findAll("button").find((button) => button.text() === "Сохранить оценку")!.trigger("click");
    await flushPromises();
    expect(mocks.writes).toEqual(["atomic"]);
    expect(wrapper.emitted("saved")).toEqual([[updated]]);
  });

  it("не подменяет отсутствующую личную оценку баллом отзыва", async () => {
    await open(null);
    expect(wrapper.find(".rate-modal__score").exists()).toBe(false);
  });
});
