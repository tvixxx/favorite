import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "./chatStore";
import { useUserStatusStore } from "../userStatus/userStatusStore";
import { useFriendsStore } from "../friends/friendsStore";

const mocks = vi.hoisted(() => ({ io: vi.fn(), useFetch: vi.fn() }));
const token = ref<string | null>("first-access");

vi.mock("socket.io-client", () => ({ io: mocks.io }));
vi.mock("@/composable", () => ({
  useFetch: mocks.useFetch,
  useAuthToken: () => token,
  FETCH_METHOD: { get: "GET" },
}));

vi.mock("../notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({
    applyIncoming: vi.fn(),
    hydrate: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("Авторизация соединения чата", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    token.value = "first-access";
    mocks.io.mockReset();
    mocks.useFetch.mockReset();
    mocks.io.mockReturnValue({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn().mockReturnThis(),
      connect: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn(),
    });
  });

  afterEach(() => {
    disposePinia(getActivePinia()!);
    vi.restoreAllMocks();
  });

  it("при возвращении во вкладку подтягивает пропущенные сообщения и обновляет присутствие", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    const missed = {
      id: "missed",
      senderId: "peer-id",
      receiverId: "user-id",
      content: "Пока вас не было",
      isRead: false,
      createdAt: "2026-10-20T12:00:00Z",
    };

    mocks.useFetch.mockImplementation(async (url: string) => ({
      status: 200,
      data: url.includes("/messages/peer-id") ? [missed] : [],
    }));

    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;
    store.currentChatUserId = "peer-id";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() =>
      expect(store.currentMessages.map((item) => item.id)).toEqual(["missed"])
    );

    expect(store.socket!.emit).toHaveBeenCalledWith("presence:sync");
  });

  it("возврат из фона не ждёт зависший запрос предыдущего подключения", async () => {
    let visibility: DocumentVisibilityState = "visible";

    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility
    );

    let finish!: (value: unknown) => void;
    let messagesRequested = 0;
    const fresh = {
      id: "fresh",
      senderId: "peer-id",
      receiverId: "user-id",
      content: "После возврата",
      isRead: false,
      createdAt: "2026-10-21T12:00:00Z",
    };

    mocks.useFetch.mockImplementation((url: string) => {
      if (url.includes("/messages/peer-id") && ++messagesRequested === 1)
        return new Promise((resolve) => {
          finish = resolve;
        });

      return Promise.resolve({
        status: 200,
        data: url.includes("/messages/peer-id") ? [fresh] : [],
      });
    });

    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;
    store.currentChatUserId = "peer-id";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(messagesRequested).toBe(1));
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() =>
      expect(store.currentMessages.map((item) => item.id)).toEqual(["fresh"])
    );

    finish({ status: 200, data: [] });
  });

  it("не читает сообщение автоматически, когда открытый чат скрыт", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;
    store.currentChatUserId = "peer-id";

    const incoming = {
      id: "new",
      senderId: "peer-id",
      receiverId: "user-id",
      content: "Привет",
      isRead: false,
      createdAt: "2026-10-20T12:00:00Z",
    };

    store.conversations = [
      {
        otherUser: { id: "peer-id", email: "" },
        lastMessage: incoming,
        unreadCount: 0,
      },
    ];

    const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
      ([event]: [string]) => event === "message:received"
    )[1];

    await handler(incoming);
    expect(store.totalUnreadCount).toBe(1);
    expect(store.currentMessages[0].isRead).toBe(false);
    expect(store.socket!.emit).not.toHaveBeenCalledWith(
      "message:read",
      expect.anything()
    );
  });

  it.each(["messages:read", "conversation:read"])(
    "точечное событие %s не читает остальные сообщения",
    (event) => {
      mocks.useFetch.mockResolvedValue({ status: 200, data: [] });

      const store = useChatStore();

      store.connect("user-id");

      const incoming = event === "conversation:read";
      const message = {
        senderId: incoming ? "peer-id" : "user-id",
        receiverId: incoming ? "user-id" : "peer-id",
        content: "Сообщение",
        isRead: false,
        createdAt: "2026-10-20T12:00:00Z",
      };

      store.messages.set("peer-id", [
        { ...message, id: "older" },
        { ...message, id: "chosen" },
      ]);

      const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
        ([name]: [string]) => name === event
      )[1];

      handler({
        userId: "peer-id",
        otherUserId: "peer-id",
        messageId: "chosen",
        through: "2026-10-20T13:00:00Z",
      });

      expect(store.messages.get("peer-id")?.map((item) => item.isRead)).toEqual(
        [false, true]
      );
    }
  );

  it("обновляет входящие заявки без перехода на другую страницу", async () => {
    mocks.useFetch.mockImplementation(async (url: string) => ({
      status: 200,
      data: url.endsWith("/friends/requests")
        ? [{ id: "repeated-request" }]
        : [],
    }));

    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;

    const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
      ([event]: [string]) => event === "friendship:changed"
    )[1];

    handler();
    await vi.waitFor(() =>
      expect(useFriendsStore().requests.map((item) => item.id)).toEqual([
        "repeated-request",
      ])
    );

    expect(useFriendsStore().pendingRequestsCount).toBe(1);
  });

  it("снимок присутствия убирает устаревший статус после переподключения", () => {
    const store = useChatStore();
    const statuses = useUserStatusStore();

    statuses.setUserOnline("old-peer", "");
    store.connect("user-id");

    const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
      ([event]: [string]) => event === "presence:snapshot"
    )?.[1];

    expect(handler).toBeTypeOf("function");
    handler(["new-peer"]);
    expect(statuses.isUserOnline("old-peer")).toBe(false);
    expect(statuses.isUserOnline("new-peer")).toBe(true);
  });

  it("передаёт актуальный access при каждом подключении, без заявленного userId", () => {
    useChatStore().connect("user-id");

    const options = mocks.io.mock.calls[0][1];
    const handshake = () => {
      let result: unknown;

      if (typeof options.auth === "function")
        options.auth((value: unknown) => {
          result = value;
        });
      else result = options.auth;

      return result;
    };

    expect(handshake()).toEqual({ token: "first-access" });
    token.value = "new-access";
    expect(handshake()).toEqual({ token: "new-access" });
    expect(options.query?.userId).toBeUndefined();
  });

  it("не создаёт соединение без access", () => {
    token.value = null;
    useChatStore().connect("user-id");
    expect(mocks.io).not.toHaveBeenCalled();
  });

  it("добавляет сообщение с серверным id только после подтверждения", async () => {
    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;

    const delivered = {
      id: "saved-id",
      senderId: "user-id",
      receiverId: "peer-id",
      content: "Привет",
      isRead: false,
      createdAt: "2026-01-01",
    };
    const emit = vi.fn((_event, _payload, ack) => ack(null, delivered));

    store.socket!.timeout = vi.fn(() => ({ emit })) as never;

    const saved = await store.sendMessage("peer-id", "Привет");

    expect(saved).toEqual(delivered);
    expect(store.messages.get("peer-id")).toEqual([delivered]);
    expect(emit).toHaveBeenCalledWith(
      "message:send",
      { receiverId: "peer-id", content: "Привет" },
      expect.any(Function)
    );
  });

  it("при таймауте не оставляет ложное отправленное сообщение", async () => {
    const store = useChatStore();

    store.connect("user-id");
    store.socket!.connected = true;
    store.socket!.timeout = vi.fn(() => ({
      emit: vi.fn((_event, _payload, ack) => ack(new Error("timeout"))),
    })) as never;

    await expect(store.sendMessage("peer-id", "Привет")).rejects.toThrow();
    expect(store.messages.get("peer-id") ?? []).toEqual([]);
  });

  it.each(["conversations", "messages"])(
    "не возвращает %s старой сессии после выхода",
    async (kind) => {
      let finish!: (value: unknown) => void;

      mocks.useFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );

      const store = useChatStore();
      const pending =
        kind === "conversations"
          ? store.fetchConversations("user-id")
          : store.fetchMessages("user-id", "peer-id");

      store.disconnect();
      finish({ status: 200, data: [{ id: "old-session-data" }] });
      await pending;
      expect(store.conversations).toEqual([]);
      expect(store.messages.size).toBe(0);
    }
  );

  it("не теряет сообщение сокета при поздней загрузке истории", async () => {
    let finish!: (value: unknown) => void;

    mocks.useFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const store = useChatStore();

    store.connect("user-id");

    const pending = store.fetchMessages("user-id", "peer-id");
    const incoming = {
      id: "incoming",
      senderId: "peer-id",
      receiverId: "user-id",
      content: "Новое",
      isRead: false,
      createdAt: "2026-10-04T12:00:00Z",
    };
    const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
      ([event]: [string]) => event === "message:received"
    )[1];

    await handler(incoming);
    finish({
      status: 200,
      data: [{ ...incoming, id: "old", createdAt: "2026-10-03T12:00:00Z" }],
    });

    await pending;
    expect(store.messages.get("peer-id")?.map((item) => item.id)).toEqual([
      "old",
      "incoming",
    ]);
  });

  it("повтор доставки не увеличивает число непрочитанных", async () => {
    const store = useChatStore();

    store.connect("user-id");

    const incoming = {
      id: "incoming",
      senderId: "peer-id",
      receiverId: "user-id",
      content: "Новое",
      isRead: false,
      createdAt: "2026-10-04T12:00:00Z",
    };

    store.conversations = [
      {
        otherUser: { id: "peer-id", email: "fixture@example.com" },
        lastMessage: incoming,
        unreadCount: 0,
      },
    ];

    const handler = mocks.io.mock.results[0].value.on.mock.calls.find(
      ([event]: [string]) => event === "message:received"
    )[1];

    await handler(incoming);
    await handler(incoming);
    expect(store.totalUnreadCount).toBe(1);
    expect(store.messages.get("peer-id")).toHaveLength(1);
  });
});
