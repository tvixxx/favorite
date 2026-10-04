import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "./chatStore";

const mocks = vi.hoisted(() => ({ io: vi.fn(), useFetch: vi.fn() }));
const token = ref<string | null>("first-access");

vi.mock("socket.io-client", () => ({ io: mocks.io }));
vi.mock("@/composable", () => ({
  useFetch: mocks.useFetch,
  useAuthToken: () => token,
  FETCH_METHOD: { get: "GET" },
}));
vi.mock("../userStatus/userStatusStore", () => ({
  useUserStatusStore: () => ({ setUserOnline: vi.fn(), setUserOffline: vi.fn(), clearStatuses: vi.fn() }),
}));
vi.mock("../notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ applyIncoming: vi.fn() }),
}));

describe("Авторизация соединения чата", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    token.value = "first-access";
    mocks.io.mockReset();
    mocks.useFetch.mockReset();
    mocks.io.mockReturnValue({
      on: vi.fn(), emit: vi.fn(), disconnect: vi.fn().mockReturnThis(), connect: vi.fn().mockReturnThis(), removeAllListeners: vi.fn(),
    });
  });

  afterEach(() => disposePinia(getActivePinia()!));

  it("передаёт актуальный access при каждом подключении, без заявленного userId", () => {
    useChatStore().connect("user-id");
    const options = mocks.io.mock.calls[0][1];
    const handshake = () => {
      let result: unknown;
      if (typeof options.auth === "function") options.auth((value: unknown) => { result = value; });
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
    const delivered = { id: "saved-id", senderId: "user-id", receiverId: "peer-id", content: "Привет", isRead: false, createdAt: "2026-01-01" };
    const emit = vi.fn((_event, _payload, ack) => ack(null, delivered));
    store.socket!.timeout = vi.fn(() => ({ emit })) as never;
    const saved = await store.sendMessage("peer-id", "Привет");
    expect(saved).toEqual(delivered);
    expect(store.messages.get("peer-id")).toEqual([delivered]);
    expect(emit).toHaveBeenCalledWith("message:send", { receiverId: "peer-id", content: "Привет" }, expect.any(Function));
  });

  it("при таймауте не оставляет ложное отправленное сообщение", async () => {
    const store = useChatStore();
    store.connect("user-id");
    store.socket!.connected = true;
    store.socket!.timeout = vi.fn(() => ({ emit: vi.fn((_event, _payload, ack) => ack(new Error("timeout"))) })) as never;
    await expect(store.sendMessage("peer-id", "Привет")).rejects.toThrow();
    expect(store.messages.get("peer-id") ?? []).toEqual([]);
  });

  it.each(["conversations", "messages"])("не возвращает %s старой сессии после выхода", async (kind) => {
    let finish!: (value: unknown) => void;
    mocks.useFetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const store = useChatStore();
    const pending = kind === "conversations" ? store.fetchConversations("user-id") : store.fetchMessages("user-id", "peer-id");
    store.disconnect();
    finish({ status: 200, data: [{ id: "old-session-data" }] });
    await pending;
    expect(store.conversations).toEqual([]);
    expect(store.messages.size).toBe(0);
  });
});
