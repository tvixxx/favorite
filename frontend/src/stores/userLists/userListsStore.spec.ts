import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserListsStore } from "./userListsStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST", patch: "PATCH", delete: "DELETE" } }));
const list = (id: string) => ({ id, name: id, createdAt: "2026-01-01", items: [], _count: { items: 2 } });

describe("Состояние пользовательских списков", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));

  it("не заменяет текущий список поздним ответом предыдущего", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: list("new") });
    const store = useUserListsStore();
    const pending = store.fetchListById("user-id", "old");
    await store.fetchListById("user-id", "new");
    finish(list("old"));
    await pending;
    expect(store.currentList?.id).toBe("new");
  });

  it("не выключает общий loading, пока ещё загружается деталь", async () => {
    let finishLists!: (data: unknown) => void;
    let finishDetail!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finishLists = (data) => resolve({ status: 200, data }); }));
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finishDetail = (data) => resolve({ status: 200, data }); }));
    const store = useUserListsStore();
    const summaries = store.fetchLists("user-id");
    const detail = store.fetchListById("user-id", "list-id");
    finishLists([list("list-id")]);
    await summaries;
    expect(store.isLoading).toBe(true);
    finishDetail(list("list-id"));
    await detail;
    expect(store.isLoading).toBe(false);
  });

  it("не восстанавливает данные списков после выхода", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useUserListsStore();
    const pending = store.fetchLists("user-id");
    store.resetSession();
    finish([list("old")]);
    await pending;
    expect(store.lists).toEqual([]);
  });

  it("обновляет счётчик списка после удаления тайтла", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [list("list-id")] });
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: true });
    const store = useUserListsStore();
    await store.fetchLists("user-id");
    await store.removeMovieFromList("user-id", "list-id", "movie-id");
    expect(store.lists[0]._count.items).toBe(1);
  });
});
