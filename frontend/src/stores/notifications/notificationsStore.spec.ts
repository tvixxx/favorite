import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationsStore } from "./notificationsStore";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET" } }));
const rows = [
  { id: "message", type: "CHAT_MESSAGE", readAt: null },
  { id: "request", type: "FRIEND_REQUEST", readAt: null },
];

describe("Видимость уведомлений при первоначальной загрузке", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("fv-notify-new-messages", "false");
    setActivePinia(createPinia());
    mocks.fetch.mockImplementation(async (url: string) => {
      const types = new URL(url, "http://localhost").searchParams.getAll("types");
      const visible = types.length ? rows.filter((row) => types.includes(row.type)) : rows;

      return { status: 200, data: url.includes("unread-count") ? visible.length : visible };
    });
  });
  afterEach(() => { disposePinia(getActivePinia()!); localStorage.clear(); });

  it("исключает отключённые сообщения и из списка, и из счётчика", async () => {
    const store = useNotificationsStore();
    await store.hydrate("user-id");
    expect(store.items.map((item) => item.id)).toEqual(["request"]);
    expect(store.unreadCount).toBe(1);
  });

  it("оставляет пустой список и нулевой счётчик при отключении всех типов", async () => {
    localStorage.setItem("fv-notify-friend-requests", "false");
    const store = useNotificationsStore();
    await store.hydrate("user-id");
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });

  it("не восстанавливает данные завершённой сессии поздним ответом", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const store = useNotificationsStore();
    const pending = store.fetchNotifications("user-id");
    store.resetSession();
    finish({ status: 200, data: [rows[1]] });
    await pending;
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });
});
