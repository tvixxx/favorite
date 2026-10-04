import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActorsStore } from "./actorsStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST" } }));

describe("Поиск и выбор актёров", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));

  it("собирает варианты селекта страницами с учётом лимита API 100", async () => {
    const actors = Array.from({ length: 101 }, (_, index) => ({ id: `actor-${index}`, name: `Актёр ${index}` }));
    mocks.fetch.mockImplementation(async (url: string) => {
      const params = new URL(url, "http://localhost").searchParams;
      const offset = Number(params.get("offset"));
      const limit = Math.min(100, Number(params.get("limit")));

      return { status: 200, data: { items: actors.slice(offset, offset + limit), total: actors.length } };
    });
    const store = useActorsStore();
    await store.fetchActorsForPickers();
    expect(store.pickerActors).toHaveLength(101);
    expect(store.pickerActors[100].id).toBe("actor-100");
  });

  it("не заменяет новый поиск старым ответом страницы", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { items: [{ id: "new", name: "Новый" }], total: 1 } });
    const store = useActorsStore();
    const pending = store.fetchActorsPage({ q: "old" });
    await store.fetchActorsPage({ q: "new" });
    finish({ items: [{ id: "old", name: "Старый" }], total: 1 });
    await pending;
    expect(store.actorsPageItems.map((actor) => actor.id)).toEqual(["new"]);
  });

  it("обрезает пробелы и повторно использует актёра с тем же именем", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { items: [{ id: "existing", name: "Том Хэнкс" }], total: 1 } });
    const store = useActorsStore();
    await store.fetchActorsForPickers();
    expect((await store.addActorByName("  том хэнкс  ")).id).toBe("existing");
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it("объединяет параллельное создание актёра с одним именем", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const store = useActorsStore();
    const first = store.addActorByName("Том Хэнкс");
    const second = store.addActorByName("  том хэнкс  ");
    expect(mocks.fetch).toHaveBeenCalledOnce();
    finish({ status: 201, data: { id: "actor-id", name: "Том Хэнкс" } });
    expect((await Promise.all([first, second])).map((actor) => actor.id)).toEqual(["actor-id", "actor-id"]);
  });
});
