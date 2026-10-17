import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogQuality } from "./useCatalogQuality";
import type { CatalogRecord } from "@/utils/catalogQuality";

const mocks = vi.hoisted(() => ({ get: vi.fn(), probe: vi.fn() }));
vi.mock("@/services/api", () => ({ default: { get: mocks.get } }));
vi.mock("@/utils/catalogQuality", async () => ({
  ...(await vi.importActual<typeof import("@/utils/catalogQuality")>(
    "@/utils/catalogQuality"
  )),
  probePoster: mocks.probe,
}));
const movie = (id: string): CatalogRecord => ({
  id,
  title: `Фильм ${id}`,
  description: "Описание",
  genres: ["DRAMA"],
  countryCodes: ["RU"],
  publishDate: "2020-01-01",
  isSerial: false,
  poster: null,
  _count: { actors: 1 },
});
function setup() {
  const scope = effectScope();
  const query = ref({ q: "", kind: "" });
  const state = scope.run(() => useCatalogQuality(() => query.value))!;

  return { state, query, stop: () => scope.stop() };
}

describe("Проверка всего выбранного каталога", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.probe.mockReset().mockResolvedValue("loaded");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());
  it("находит проблемы за пределами первой страницы", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        items: Array.from({ length: 100 }, (_, index) => movie(String(index))),
        total: 101,
      },
    });
    mocks.get.mockResolvedValueOnce({
      data: { items: [movie("last")], total: 101 },
    });
    const { state, stop } = setup();
    await state.run(false);
    expect(state.status.value).toBe("done");
    expect(state.findings.value).toHaveLength(101);
    expect(state.findings.value.at(-1)?.id).toBe("last");
    stop();
  });
  it("не выдаёт изменившийся набор за полную проверку", async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        items: Array.from({ length: 100 }, (_, index) => movie(String(index))),
        total: 101,
      },
    });
    mocks.get.mockResolvedValueOnce({ data: { items: [], total: 100 } });
    const { state, stop } = setup();
    await state.run(false);
    expect(state.status.value).toBe("error");
    expect(state.findings.value).toEqual([]);
    stop();
  });
  it("сбрасывает результат при изменении фильтров", async () => {
    mocks.get.mockResolvedValue({ data: { items: [movie("one")], total: 1 } });
    const { state, query, stop } = setup();
    await state.run(false);
    query.value.q = "Другой";
    await nextTick();
    expect(state.status.value).toBe("idle");
    expect(state.findings.value).toEqual([]);
    stop();
  });
  it("отмена не позволяет позднему ответу заменить состояние", async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const { state, stop } = setup();
    const running = state.run(false);
    state.cancel();
    resolve({ data: { items: [movie("late")], total: 1 } });
    await running;
    expect(state.status.value).toBe("cancelled");
    expect(state.findings.value).toEqual([]);
    stop();
  });
  it("не объявляет постеры недоступными при отсутствии сети", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { state, stop } = setup();
    await state.run(true);
    expect(state.status.value).toBe("error");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.probe).not.toHaveBeenCalled();
    stop();
  });
  it("один внешний адрес проверяется один раз, управляемое медиа не запрашивается", async () => {
    const url = "https://images.example.test/external.webp";
    mocks.get.mockResolvedValue({
      data: {
        items: [
          { ...movie("one"), poster: { url } },
          { ...movie("two"), poster: { url } },
          {
            ...movie("managed"),
            poster: {
              url: "https://media.example.test/own.webp",
              assetId: "asset",
            },
          },
        ],
        total: 3,
      },
    });
    const { state, stop } = setup();
    await state.run(true);
    expect(mocks.probe).toHaveBeenCalledTimes(1);
    expect(state.progress.value.posterTotal).toBe(1);
    expect(state.status.value).toBe("done");
    stop();
  });
});
