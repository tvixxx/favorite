import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBadgesStore } from "./badgesStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET" } }));

describe("Сброс достижений между аккаунтами", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));
  it("не возвращает достижения старой сессии поздним ответом", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useBadgesStore();
    const pending = store.fetchUserBadges("user-id");
    store.resetSession();
    finish([{ id: "old-badge", isUnlocked: true }]);
    await pending;
    expect(store.badges).toEqual([]);
  });
});
