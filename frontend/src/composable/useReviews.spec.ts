import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReviews } from "./useReviews";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable/useFetch", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST", put: "PUT", delete: "DELETE" } }));

describe("Изоляция отзывов", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));

  it("не меняет счётчик нового фильма поздним удалением отзыва предыдущего", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [{ id: "old-review", movieId: "old" }] });
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [{ id: "new-review", movieId: "new" }] });
    const store = useReviews();
    await store.fetchReviews("old");
    const deletion = store.deleteReview("old-review");
    await store.fetchReviews("new");
    finish({ status: 200, data: "old-review" });
    await deletion;
    expect(store.totalReviews.value).toBe(1);
    expect(store.reviews.value.map((item) => item.id)).toEqual(["new-review"]);
  });

  it("сбрасывает отзывы и незавершённые запросы при завершении сессии", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const store = useReviews();
    const pending = store.fetchReviews("old");
    store.resetSession();
    finish({ status: 200, data: [{ id: "old-review", movieId: "old" }] });
    await pending;
    expect(store.reviews.value).toEqual([]);
    expect(store.totalReviews.value).toBe(0);
  });
});
