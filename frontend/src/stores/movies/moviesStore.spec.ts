import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMoviesStore } from "./moviesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST" } }));
vi.mock("@/constants", async (original) => ({ ...await original<object>(), getDefaultLoaderDelayTime: () => 0 }));
const movie = (id: string) => ({ id, title: id, genres: [], countryCodes: [], isSerial: false, poster: null });

describe("Загрузка каталога и предпросмотра", () => {
  beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => { disposePinia(getActivePinia()!); vi.useRealTimers(); });

  it("показывает последний поиск при обратном порядке ответов", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [movie("new")] });
    const store = useMoviesStore();
    const pending = store.findMovie("old");
    await store.findMovie("new");
    finish([movie("old")]);
    await pending;
    expect(store.currentMoviesList.map((item) => item.id)).toEqual(["new"]);
  });

  it("не оставляет прежний поиск при fetchMovies с новым запросом", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [movie("old")] });
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [movie("new")] });
    const store = useMoviesStore();
    await store.findMovie("old");
    await store.fetchMovies("new");
    expect(store.searchQuery).toBe("new");
    expect(store.currentMoviesList.map((item) => item.id)).toEqual(["new"]);
  });

  it("не возвращает фильм в закрытый предпросмотр поздним ответом", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useMoviesStore();
    const pending = store.getMovieDetail("old");
    store.setCurrentMovie(null);
    finish(movie("old"));
    await pending;
    expect(store.currentMovie).toBeNull();
  });
});
