import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeaderboardStore } from "./leaderboardStore";
import { useLeaderboardMoviesStore } from "./leaderboardMoviesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET" } }));

describe("Переключение страниц рейтинга", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));

  it.each(["users", "movies"])("оставляет последнюю страницу %s при обратном порядке ответов", async (kind) => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { items: [], total: 60, offset: 40 } });
    const store = kind === "users" ? useLeaderboardStore() : useLeaderboardMoviesStore();
    const pending = store.setPage(2);
    await store.setPage(3);
    finish({ status: 200, data: { items: [], total: 60, offset: 20 } });
    await pending;
    expect(store.currentPage).toBe(3);
    expect(store.isLoading).toBe(false);
  });
});
