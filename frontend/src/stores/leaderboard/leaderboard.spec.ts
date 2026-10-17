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
    const row = (id: string, rank: number) => kind === "users" ? {
      rank, userId: id, displayName: `Пользователь ${id}`,
      registeredAt: "2026-01-01T00:00:00Z", filmsCount: 10,
      serialsTotal: 3, serialsCompleted: 2, totalScore: 50, badges: [],
    } : {
      rank, movieId: id, title: `Фильм ${id}`, isSerial: false,
      publishDate: "2025-01-01", posterUrl: null, avgPersonalRate: 8, ratingsCount: 4,
    };
    const latestItems = [row("new", 41)];
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { items: latestItems, total: 82, limit: 20, offset: 40 } });
    const store = kind === "users" ? useLeaderboardStore() : useLeaderboardMoviesStore();
    const pending = store.setPage(2);
    await store.setPage(3);
    expect(store.items).toEqual(latestItems);
    finish({ status: 200, data: { items: [row("old", 21)], total: 61, limit: 20, offset: 20 } });
    await pending;
    expect(store.currentPage).toBe(3);
    expect(store.items).toEqual(latestItems);
    expect(store.total).toBe(82);
    expect(store.offset).toBe(40);
    expect(store.isLoading).toBe(false);
  });
});
