import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationsStore } from "./notificationsStore";
import { useMainStore } from "@/state/state";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }));

vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { get: "GET", patch: "PATCH", post: "POST" } }));
vi.mock("@/components/Notifications/notification-toast", () => ({ showNotificationToast: mocks.toast }));

let systemRows: { id: string; title: string; body: string; category: string; actions: never[]; createdAt: string; readAt: string | null }[];

beforeEach(() => {
  setActivePinia(createPinia());
  useMainStore().state.user.data = { id: "owner", fullName: "Тест", email: "test@example.test", notifyNewMessages: false, notifyFriendRequests: false };
  systemRows = [{ id: "system-1", title: "Новость", body: "Текст", category: "NEWS", actions: [], createdAt: "2026-10-22T10:00:00Z", readAt: null }];
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.endsWith("/system-1/read")) { systemRows[0].readAt = new Date().toISOString();

 return { status: 200, data: undefined }; }

    if (url.includes("/notification-center/system?")) {
      const rows = systemRows.filter(item => !item.readAt);

      return { status: 200, data: { items: rows, total: rows.length, unread: rows.length } };
    }

    return { status: 200, data: url.includes("unread-count") ? 0 : [] };
  });
});

afterEach(() => { disposePinia(getActivePinia()!); vi.clearAllMocks(); });

describe("Системные уведомления в общем колокольчике", () => {
  it("оставляет системные события при выключенных сообщениях и не показывает тост старой истории", async () => {
    const store = useNotificationsStore();

    await store.hydrate("owner");
    expect(store.items.map(item => item.type)).toEqual(["SYSTEM"]);
    expect(store.unreadCount).toBe(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("показывает одну новую публикацию один раз и учитывает полный счётчик", async () => {
    const store = useNotificationsStore();

    await store.hydrate("owner");
    systemRows.unshift({ ...systemRows[0], id: "system-2", title: "Новая версия", createdAt: "2026-10-22T11:00:00Z" });
    await store.hydrate("owner");
    await store.hydrate("owner");
    expect(store.unreadCount).toBe(2);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ id: "system-2" }));
  });

  it("пишет персональное прочтение в системный маршрут и убирает запись", async () => {
    const store = useNotificationsStore();

    await store.hydrate("owner");
    await store.markRead("owner", "system-1");
    expect(mocks.fetch).toHaveBeenCalledWith("/users/owner/notification-center/system/system-1/read", expect.objectContaining({ method: "PATCH" }));
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });

  it("не показывает повторный тост входящего сообщения с тем же идентификатором", () => {
    useMainStore().state.user.data!.notifyNewMessages = true;

    const store = useNotificationsStore();
    const item = { id: "message", userId: "owner", type: "CHAT_MESSAGE" as const, payload: { senderName: "Друг", preview: "Привет" }, createdAt: new Date().toISOString(), readAt: null };

    store.applyIncoming(item);
    store.applyIncoming(item);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    store.applyIncoming({ ...item, id: "open-chat" }, true);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });
});
