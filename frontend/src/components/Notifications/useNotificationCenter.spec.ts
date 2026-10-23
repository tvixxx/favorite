import { effectScope, nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationCenter } from "./useNotificationCenter";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  hydrate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/api", () => ({
  default: { get: mocks.get, patch: mocks.patch, post: mocks.post },
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ changeVersion: 0, hydrate: mocks.hydrate }),
}));

const first = {
  id: "peer-1",
  name: "Анна",
  username: null,
  total: 40,
  unread: 1,
  preview: "",
  lastAt: "2026-10-22T12:00:00Z",
};
const second = { ...first, id: "peer-2", name: "Максим" };
const event = (id: string) => ({
  id,
  title: id,
  type: "CHAT_MESSAGE",
  body: id,
  readAt: null,
  createdAt: "2026-10-22T12:00:00Z",
  actions: [],
});
let scope: ReturnType<typeof effectScope>;

function setup() {
  const user = ref<string | undefined>("owner");

  scope = effectScope();

  const state = scope.run(() => useNotificationCenter(user))!;

  return { state, user };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.get.mockImplementation(async (url: string) => ({
    data: url.endsWith("/summary")
      ? { people: 1, system: 1, asOf: "2026-10-22T12:30:00Z" }
      : url.endsWith("/senders")
      ? { items: [first, second], total: 12 }
      : {
          items: [event(url.endsWith("peer-2") ? "second" : "first")],
          total: 40,
        },
  }));
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Загрузка центра уведомлений", () => {
  it("ждёт триста миллисекунд после последнего ввода", async () => {
    const { state } = setup();

    await flushPromises();
    mocks.get.mockClear();
    state.senderQuery.value = "Ан";
    await nextTick();
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.get).not.toHaveBeenCalled();
    state.senderQuery.value = "Анна";
    await nextTick();
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.get).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(mocks.get).toHaveBeenCalledWith(
      expect.stringContaining("/senders"),
      expect.objectContaining({
        params: expect.objectContaining({ q: "Анна", offset: 0 }),
      })
    );
  });

  it("не заменяет нового отправителя запоздавшим ответом предыдущего", async () => {
    const { state } = setup();

    await flushPromises();

    let finish!: (value: unknown) => void;

    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const pending = state.loadEvents();

    state.choose(second);
    await flushPromises();
    expect(state.events.items[0].id).toBe("second");
    finish({ data: { items: [event("late")], total: 1 } });
    await pending;
    await flushPromises();
    expect(state.events.items[0].id).toBe("second");
  });

  it("при быстром переключении категорий сохраняет результат до ответа и игнорирует старую выборку", async () => {
    const { state } = setup();

    await flushPromises();
    state.section.value = "system";
    await flushPromises();

    const completed = state.events.items;
    const pending: Array<(value: unknown) => void> = [];

    mocks.get.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve))
    );

    state.category.value = "NEWS";
    await nextTick();
    expect(state.events.ready).toBe(true);
    expect(state.events.items).toBe(completed);
    state.category.value = "SERVICE";
    await nextTick();
    pending[1]({ data: { items: [], total: 0 } });
    await flushPromises();
    expect(state.events.items).toEqual([]);
    expect(state.events.loading).toBe(false);
    pending[0]({ data: { items: [event("запоздалое")], total: 1 } });
    await flushPromises();
    expect(state.events.items).toEqual([]);
    expect(state.events.ready).toBe(true);
  });

  it("не подменяет ошибку пустым состоянием до ответа повторного запроса", async () => {
    const { state } = setup();

    await flushPromises();
    mocks.get.mockRejectedValueOnce(new Error("Нет связи"));
    await state.loadEvents();

    const previousError = state.events.error;

    expect(previousError).not.toBe("");

    let finish!: (value: unknown) => void;

    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const request = state.loadEvents();

    expect(state.events.error).toBe(previousError);
    finish({ data: { items: [], total: 0 } });
    await request;
    expect(state.events.error).toBe("");
    expect(state.events.items).toEqual([]);
  });

  it("сохраняет независимые страницы людей и системных событий", async () => {
    const { state } = setup();

    await flushPromises();
    state.eventPage.value = 2;
    await flushPromises();
    state.section.value = "system";
    await flushPromises();
    state.eventPage.value = 3;
    await flushPromises();
    state.section.value = "people";
    await flushPromises();
    expect(state.eventPage.value).toBe(2);
    state.section.value = "system";
    await flushPromises();
    expect(state.eventPage.value).toBe(3);
  });

  it("после выхода очищает прежние данные и игнорирует поздний ответ", async () => {
    const { state, user } = setup();

    await flushPromises();

    let finish!: (value: unknown) => void;

    mocks.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    const pending = state.loadSenders();

    user.value = undefined;
    await nextTick();
    finish({ data: { items: [first], total: 1 } });
    await pending;
    await flushPromises();
    expect(state.senders.items).toEqual([]);
    expect(state.selected.value).toBeNull();
    expect(state.events.items).toEqual([]);
  });
});
