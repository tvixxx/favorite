import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserMoviesStore } from "./userMoviesStore";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST", patch: "PATCH", delete: "DELETE" } }));
vi.mock("@/constants", async (original) => ({ ...await original<object>(), getDefaultLoaderDelayTime: () => 0 }));
const row = (id: string) => ({ id: `link-${id}`, userId: "owner", movieId: id, isFavorite: true, personalRate: null, watchStatus: "NOT_STARTED", addedAt: "2026-01-01", movie: { id, title: id, isSerial: false, genres: [], countryCodes: [], poster: null } });
const response = (ids: string[], total: number) => ({ status: 200, data: { items: ids.map(row), total, limit: 20, offset: 0 } });

describe("Догрузка серверных страниц коллекции", () => {
  beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => { disposePinia(getActivePinia()!); vi.useRealTimers(); });
  it("показывает общее количество и наличие следующей страницы", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["one", "two"], 3));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("owner");
    await vi.runAllTimersAsync();
    expect(store.visibleUserMovies.map((item) => item.movieId)).toEqual(["one", "two"]);
    expect(store.totalCount).toBe(3);
    expect(store.hasMoreUserMovies).toBe(true);
  });
  it("добавляет следующую порцию с сохранением поиска и избранного", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["one"], 2));
    mocks.fetch.mockResolvedValueOnce(response(["two"], 2));
    const store = useUserMoviesStore();
    store.setFilters({ isFavorite: true });
    await store.searchUserMovies("owner", "Фильм");
    await vi.runAllTimersAsync();
    await store.loadMore("owner");
    expect(store.visibleUserMovies.map((item) => item.movieId)).toEqual(["one", "two"]);
    expect(store.hasMoreUserMovies).toBe(false);
    expect(mocks.fetch.mock.calls[1][0]).toContain("/movies/page?");
    const url = new URL(mocks.fetch.mock.calls[1][0], "http://example.test");
    expect(url.searchParams.get("offset")).toBe("1");
    expect(url.searchParams.get("isFavorite")).toBe("true");
    expect(url.searchParams.get("q")).toBe("Фильм");
  });
  it("при ошибке следующей страницы сохраняет уже показанные карточки", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["one"], 2));
    mocks.fetch.mockRejectedValueOnce(new Error("Сеть"));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("owner");
    await vi.runAllTimersAsync();
    await expect(store.loadMore("owner")).rejects.toThrow("Сеть");
    expect(store.visibleUserMovies.map((item) => item.movieId)).toEqual(["one"]);
    expect(store.isError).toBeNull();
    expect(store.isLoadingMore).toBe(false);
  });
  it("поздняя догрузка не смешивается с новым фильтром", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["old"], 2));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("owner");
    await vi.runAllTimersAsync();
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = store.loadMore("owner");
    store.setFilters({ isFavorite: true });
    mocks.fetch.mockResolvedValueOnce(response(["new"], 1));
    await store.fetchUserMovies("owner");
    finish(response(["late"], 2));
    await pending;
    expect(store.visibleUserMovies.map((item) => item.movieId)).toEqual(["new"]);
  });
  it("не отправляет повторную догрузку при двух нажатиях", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["one"], 2));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("owner");
    await vi.runAllTimersAsync();
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const pending = store.loadMore("owner");
    await store.loadMore("owner");
    finish(response(["two"], 2));
    await pending;
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(store.visibleUserMovies).toHaveLength(2);
  });
  it("обновляет список с начала, если коллекция изменилась между страницами", async () => {
    mocks.fetch.mockResolvedValueOnce(response(["old"], 2));
    mocks.fetch.mockResolvedValueOnce(response(["old"], 3));
    mocks.fetch.mockResolvedValueOnce(response(["new", "old"], 3));
    const store = useUserMoviesStore();
    await store.fetchUserMovies("owner");
    await vi.runAllTimersAsync();
    await store.loadMore("owner");
    expect(store.visibleUserMovies.map((item) => item.movieId)).toEqual(["new", "old"]);
    expect(store.totalCount).toBe(3);
    expect(store.currentPage).toBe(1);
  });
  it("при пустой некорректной порции сохраняет карточки и сообщает об ошибке", async () => {
    mocks.fetch.mockResolvedValueOnce(response(['one'], 2)).mockResolvedValueOnce(response([], 2));
    const store = useUserMoviesStore();
    await store.fetchUserMovies('owner');
    await vi.runAllTimersAsync();
    await expect(store.loadMore('owner')).rejects.toThrow();
    expect(store.visibleUserMovies.map(item => item.movieId)).toEqual(['one']);
    expect(store.isLoadingMore).toBe(false);
  });
});
