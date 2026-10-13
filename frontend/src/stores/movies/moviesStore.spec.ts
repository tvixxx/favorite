import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMoviesStore } from "./moviesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET", post: "POST" },
}));
vi.mock("@/constants", async (original) => ({
  ...(await original<object>()),
  getDefaultLoaderDelayTime: () => 0,
}));
const movie = (id: string) => ({
  id,
  title: id,
  genres: [],
  countryCodes: [],
  isSerial: false,
  poster: null,
});
const page = (ids: string[], total = ids.length, offset = 0) => ({
  items: ids.map(movie),
  total,
  offset,
  limit: 20,
});

describe("Загрузка каталога и предпросмотра", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    mocks.fetch.mockReset();
  });
  afterEach(() => {
    disposePinia(getActivePinia()!);
    vi.useRealTimers();
  });

  it("показывает последний поиск при обратном порядке ответов", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = (data) => resolve({ status: 200, data });
      })
    );
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["new"]) });
    const store = useMoviesStore();
    const pending = store.findMovie("old");
    await store.findMovie("new");
    finish(page(["old"]));
    await pending;
    expect(store.currentMoviesList.map((item) => item.id)).toEqual(["new"]);
  });

  it("не оставляет прежний поиск при fetchMovies с новым запросом", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["old"]) });
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["new"]) });
    const store = useMoviesStore();
    await store.findMovie("old");
    await store.fetchMovies("new");
    expect(store.searchQuery).toBe("new");
    expect(store.currentMoviesList.map((item) => item.id)).toEqual(["new"]);
  });

  it("не возвращает фильм в закрытый предпросмотр поздним ответом", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = (data) => resolve({ status: 200, data });
      })
    );
    const store = useMoviesStore();
    const pending = store.getMovieDetail("old");
    store.setCurrentMovie(null);
    finish(movie("old"));
    await pending;
    expect(store.currentMovie).toBeNull();
  });

  it("догружает следующую порцию и не считает загруженное количество общим итогом", async () => {
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: page(["one", "two"], 3),
    });
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: page(["three"], 3, 2),
    });
    const store = useMoviesStore();

    await store.fetchMovies();
    await vi.runAllTimersAsync();
    expect(store.totalMovies).toBe(3);
    expect(store.hasMoreMovies).toBe(true);
    await store.loadMoreMovies();
    expect(store.visibleMovies.map((item) => item.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(store.hasMoreMovies).toBe(false);
    expect(mocks.fetch.mock.calls[1][0]).toContain("offset=2");
  });

  it("сохраняет карточки после ошибки догрузки и повторяет ту же порцию", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["one"], 2) });
    const store = useMoviesStore();

    await store.fetchMovies();
    await vi.runAllTimersAsync();
    mocks.fetch.mockRejectedValueOnce(new Error("Сеть недоступна"));
    await expect(store.loadMoreMovies()).rejects.toThrow();
    expect(store.visibleMovies.map((item) => item.id)).toEqual(["one"]);
    expect(store.isMoviesError).toBeNull();
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: page(["two"], 2, 1),
    });
    await store.loadMoreMovies();
    expect(mocks.fetch.mock.calls[2][0]).toContain("offset=1");
    expect(store.visibleMovies).toHaveLength(2);
  });

  it("игнорирует догрузку старого фильтра после начала нового поиска", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["one"], 2) });
    const store = useMoviesStore();

    await store.fetchMovies();
    await vi.runAllTimersAsync();
    let finish!: (data: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = (data) => resolve({ status: 200, data });
      })
    );
    const pending = store.loadMoreMovies();

    mocks.fetch.mockResolvedValueOnce({ status: 200, data: page(["new"]) });
    await store.findMovie("new");
    finish(page(["old"], 2, 1));
    await pending;
    expect(store.visibleMovies.map((item) => item.id)).toEqual(["new"]);
    expect(store.totalMovies).toBe(1);
  });
});
