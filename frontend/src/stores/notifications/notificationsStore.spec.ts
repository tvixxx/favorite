import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationsStore } from "./notificationsStore";
import { useMainStore } from "@/state/state";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET" },
}));

const rows = [
  { id: "message", type: "CHAT_MESSAGE", readAt: null },
  { id: "request", type: "FRIEND_REQUEST", readAt: null },
];

describe("Видимость уведомлений при первоначальной загрузке", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("fv-notify-new-messages", "true");
    setActivePinia(createPinia());
    useMainStore().state.user.data = {
      id: "user-id",
      fullName: "Тест",
      email: "test@example.test",
      notifyNewMessages: false,
      notifyFriendRequests: true,
    };

    mocks.fetch.mockImplementation(async (url: string) => {
      const types = new URL(url, "http://localhost").searchParams.getAll(
        "types"
      );
      const visible = types.length
        ? rows.filter((row) => types.includes(row.type))
        : rows;

      return {
        status: 200,
        data: url.includes("unread-count") ? visible.length : visible,
      };
    });
  });

  afterEach(() => {
    disposePinia(getActivePinia()!);
    localStorage.clear();
  });

  it("исключает отключённые сообщения и из списка, и из счётчика", async () => {
    const store = useNotificationsStore();

    await store.hydrate("user-id");
    expect(store.items.map((item) => item.id)).toEqual(["request"]);
    expect(store.unreadCount).toBe(1);
  });

  it("оставляет пустой список и нулевой счётчик при отключении всех типов", async () => {
    useMainStore().state.user.data!.notifyFriendRequests = false;

    const store = useNotificationsStore();

    await store.hydrate("user-id");
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });

  it("оставляет в колокольчике пять непрочитанных, сохраняя полный счётчик", async () => {
    const store = useNotificationsStore();

    for (let index = 0; index < 8; index++)
      store.applyIncoming({
        id: `notice-${index}`,
        userId: "user-id",
        type: "FRIEND_REQUEST",
        readAt: null,
        payload: {},
        createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
      });
    expect(store.items).toHaveLength(5);
    expect(store.unreadCount).toBe(8);
    store.applyIncoming({
      id: "notice-0",
      userId: "user-id",
      type: "FRIEND_REQUEST",
      readAt: null,
      payload: {},
      createdAt: new Date().toISOString(),
    });

    expect(store.unreadCount).toBe(8);
  });

  it("после прочтения убирает запись и подгружает следующую", async () => {
    const data = Array.from({ length: 6 }, (_, index) => ({
      id: `notice-${index}`,
      userId: "user-id",
      type: "FRIEND_REQUEST" as const,
      readAt: null as string | null,
      payload: {},
      createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
    }));

    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/notice-5/read")) {
        data[5].readAt = new Date().toISOString();

        return { status: 200, data: data[5] };
      }

      const unread = data.filter((item) => !item.readAt).reverse();

      return {
        status: 200,
        data: url.includes("unread-count") ? unread.length : unread.slice(0, 5),
      };
    });

    const store = useNotificationsStore();

    await store.hydrate("user-id");
    await store.markRead("user-id", "notice-5");
    expect(store.items.map((item) => item.id)).toEqual([
      "notice-4",
      "notice-3",
      "notice-2",
      "notice-1",
      "notice-0",
    ]);

    expect(store.unreadCount).toBe(5);
  });

  it("не теряет новое событие при запоздавшей загрузке колокольчика", async () => {
    let finish!: (value: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const store = useNotificationsStore();
    const fetching = store.fetchNotifications("user-id");

    store.applyIncoming({
      id: "new",
      userId: "user-id",
      type: "FRIEND_REQUEST",
      payload: {},
      readAt: null,
      createdAt: "2026-10-21T12:00:00Z",
    });

    finish({ status: 200, data: [] });
    await fetching;
    expect(store.items.map((item) => item.id)).toEqual(["new"]);
  });

  it("не восстанавливает данные завершённой сессии поздним ответом", async () => {
    let finish!: (value: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const store = useNotificationsStore();
    const pending = store.fetchNotifications("user-id");

    store.resetSession();
    finish({ status: 200, data: [rows[1]] });
    await pending;
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });
});
