import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFriendsStore } from "./friendsStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", post: "POST", patch: "PATCH", delete: "DELETE" } }));

describe("Сброс и обновление социальных данных", () => {
  beforeEach(() => { setActivePinia(createPinia()); mocks.fetch.mockReset(); });
  afterEach(() => disposePinia(getActivePinia()!));

  it("очищает кеш друзей при завершении сессии", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: [{ friendshipId: "old", friend: { id: "friend", fullName: "Тест", email: "example@example.test" } }] });
    const store = useFriendsStore();
    await store.fetchFriends("user-id");
    store.resetSession();
    expect(store.friends).toEqual([]);
    expect(store.stats).toBeNull();
  });

  it("не возвращает поздний список запросов после сброса", async () => {
    let finish!: (data: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = (data) => resolve({ status: 200, data }); }));
    const store = useFriendsStore();
    const pending = store.fetchRequests("user-id");
    store.resetSession();
    finish([{ id: "old" }]);
    await pending;
    expect(store.requests).toEqual([]);
  });

  it("показывает ошибку загрузки подписчиков вместо ложного пустого состояния", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Network unavailable"));
    const store = useFriendsStore();
    await store.fetchSubscribers("user-id");
    expect(store.isError).not.toBeNull();
  });

  it("обновляет подписчиков после удаления входящей подписки", async () => {
    let deleted = false;
    mocks.fetch.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (options?.method === "DELETE") { deleted = true;

 return { status: 204, data: "" }; }

      return { status: 200, data: url.includes("subscribers") && !deleted ? [{ friendshipId: "relation-id" }] : [] };
    });
    const store = useFriendsStore();
    await store.fetchSubscribers("user-id");
    await store.removeFriendship("user-id", "relation-id");
    expect(store.subscribers).toEqual([]);
  });
});
