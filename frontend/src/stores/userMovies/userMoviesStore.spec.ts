import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserMoviesStore } from "./userMoviesStore";
import { AxiosError, AxiosHeaders } from "axios";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST", patch: "PATCH", delete: "DELETE" } }));
vi.mock("@/constants", async (original) => ({ ...await original<object>(), getDefaultLoaderDelayTime: () => 0 }));
const row = (id: string) => ({ id: `link-${id}`, userId: "user-id", movieId: id, personalRate: null, watchStatus: "NOT_STARTED", addedAt: "2026-01-01", movie: { id, title: id, isSerial: false, genres: [], countryCodes: [], poster: null } });

describe("Конкурентные запросы коллекции", () => {
  beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => { disposePinia(getActivePinia()!); vi.useRealTimers(); });

  it("оставляет результат последнего поискового запроса при обратном порядке ответов", async () => {
    let finishFirst!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finishFirst = (data) => resolve({ status: 200, data }); }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [row("new")] });
    const store = useUserMoviesStore();
    const first = store.searchUserMovies("user-id", "old");
    await store.searchUserMovies("user-id", "new");
    finishFirst([row("old")]);
    await first;
    await vi.runAllTimersAsync();
    expect(store.searchResults.map((item) => item.movieId)).toEqual(["new"]);
    expect(store.searchQuery).toBe("new");
  });

  it.each(["fetchUserMovies", "fetchUserMoviesStats", "fetchUserMoviesAnalytics"] as const)("не восстанавливает данные после resetSession через %s", async (method) => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useUserMoviesStore();
    const pending = store[method]("user-id");
    store.resetSession();
    finish(method === "fetchUserMovies" ? [row("old")] : { totalMovies: 42 });
    await pending;
    await vi.runAllTimersAsync();
    expect(store.userMovies).toEqual([]);
    expect(store.isLoaded).toBe(false);
    expect(store.stats).toBeNull();
    expect(store.analytics).toBeNull();
  });

  it("не добавляет позднюю запись мутации в новую сессию", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useUserMoviesStore();
    const pending = store.addUserMovie("user-id", "old", {}).catch((error: unknown) => error);
    store.resetSession();
    finish(row("old"));
    expect(await pending).toBeInstanceOf(Error);
    expect(store.userMovies).toEqual([]);
  });

  it("различает сетевую ошибку детали и отсутствие фильма в коллекции", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(useUserMoviesStore().fetchUserMovieById("user-id", "movie-id")).rejects.toThrow("Network unavailable");
  });

  it("убирает из кеша тайтл, который сервер больше не находит в коллекции", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [row("gone")] });
    mocks.fetch.mockRejectedValueOnce(new AxiosError("Not found", undefined, undefined, undefined, { status: 404, statusText: "Not found", data: {}, headers: {}, config: { headers: new AxiosHeaders() } }));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("user-id");
    expect(await store.fetchUserMovieById("user-id", "gone")).toBeNull();
    expect(store.userMovies).toEqual([]);
    expect(store.isLoaded).toBe(false);
  });

  it("не оставляет загрузку после очистки поиска с незавершённым запросом", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useUserMoviesStore();
    const pending = store.searchUserMovies("user-id", "old");
    store.clearSearch();
    expect(store.isLoading).toBe(false);
    finish([row("old")]);
    await pending;
    expect(store.searchResults).toEqual([]);
  });
});
