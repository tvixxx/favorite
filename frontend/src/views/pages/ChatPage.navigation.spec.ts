import { shallowMount, flushPromises } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPage from "./ChatPage.vue";
import MobileTabBar from "@/components/MobileTabBar/MobileTabBar.vue";

const mocks = vi.hoisted(() => ({
  mobile: true,
  chat: null as unknown as ReturnType<typeof makeChat>,
}));

vi.mock("@/stores", () => ({
  useChatStore: () => mocks.chat,
  useUserStatusStore: () => ({ isUserOnline: () => false }),
  useFriendsStore: () => ({ friends: [] }),
}));

vi.mock("@/stores/chat/chatStore", () => ({ useChatStore: () => mocks.chat }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "me" } }),
}));

vi.mock("@/composable/useDateTime", () => ({
  useDateTime: () => ({ formatInstant: () => "12:00" }),
}));

vi.mock("@vueuse/core", async (original) => ({
  ...(await original<typeof import("@vueuse/core")>()),
  useMediaQuery: () => ref(mocks.mobile),
}));

function conversation(id: string, unread = 0) {
  return {
    otherUser: { id, fullName: "Пользователь " + id },
    unreadCount: unread,
    lastMessage: {
      id: "last-" + id,
      content: "Сообщение",
      createdAt: "2026-10-23T08:00:00Z",
    },
  };
}

function makeChat() {
  const chat = reactive({
    currentChatUserId: "first" as string | null,
    conversations: [conversation("first"), conversation("second", 2)],
    currentMessages: [],
    isLoading: false,
    isMessagesLoading: false,
    isMessagesError: false,
    isError: null,
    totalUnreadCount: 2,
    fetchConversations: vi.fn().mockResolvedValue(undefined),
    openChat: vi.fn(async (_user: string, peer: string) => {
      chat.currentChatUserId = peer;
    }),
    closeChat: vi.fn(() => {
      chat.currentChatUserId = null;
    }),
  });

  return chat;
}

const mounted: Array<ReturnType<typeof shallowMount>> = [];

afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()));

async function setup(path = "/chat", mobile = true, single = false) {
  mocks.mobile = mobile;
  mocks.chat = makeChat();
  if (single) {
    mocks.chat.currentChatUserId = null;
    mocks.chat.conversations = [conversation("second", 2)];
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/chat/:userId?", name: "chat", component: ChatPage }],
  });

  await router.push(path);
  await router.isReady();

  const wrapper = shallowMount(ChatPage, { global: { plugins: [router] } });

  mounted.push(wrapper);
  await flushPromises();

  return { wrapper, router, chat: mocks.chat };
}

describe("Переходы в общение", () => {
  it.each([
    [0, ""],
    [1, "1"],
    [10, "10"],
    [11, "10+"],
    [100, "10+"],
  ] as const)(
    "счётчик нижнего таббара при количестве %s: %s",
    async (count, label) => {
      const { router, chat } = await setup();

      chat.totalUnreadCount = count;

      const tabbar = shallowMount(MobileTabBar, {
        global: { plugins: [router] },
      });

      mounted.push(tabbar);
      expect(tabbar.find(".mobile-tabbar__badge").exists()).toBe(!!count);
      if (count) {
        expect(tabbar.get(".mobile-tabbar__badge").text()).toBe(label);
      }

      expect(chat.totalUnreadCount).toBe(count);
    }
  );

  it.each([false, true])(
    "на мобильном входе показывает список, даже если запомнен чат или остался один диалог: %s",
    async (single) => {
      const { wrapper, chat } = await setup("/chat", true, single);

      expect(chat.currentChatUserId).toBeNull();
      expect(chat.openChat).not.toHaveBeenCalled();
      expect(wrapper.find(".chat-page--conversation").exists()).toBe(false);
      expect(wrapper.get(".conversation-item__badge").text()).toBe("2");
      expect(wrapper.get(".conversation-item--unread").text()).toContain(
        "Пользователь second"
      );
    }
  );

  it("из уведомления открывает нужный диалог и реагирует на следующую ссылку без перемонтирования", async () => {
    const { wrapper, router, chat } = await setup("/chat/first");

    expect(chat.openChat).toHaveBeenLastCalledWith("me", "first");
    await router.push("/chat/second");
    await flushPromises();
    expect(chat.openChat).toHaveBeenLastCalledWith("me", "second");
    expect(wrapper.get(".chat-page__header-username").text()).toBe(
      "Пользователь second"
    );

    await wrapper.get(".chat-page__header-back").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/chat");
    expect(chat.currentChatUserId).toBeNull();
  });

  it("открывает выбранную строку списка через адрес конкретного чата", async () => {
    const { wrapper, router, chat } = await setup();

    await wrapper.findAll(".conversation-item")[1].trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/chat/second");
    expect(chat.currentChatUserId).toBe("second");
  });

  it("повторный тап по Общению возвращает список из уже открытого чата", async () => {
    const { router, chat } = await setup("/chat/first");
    const tabbar = shallowMount(MobileTabBar, {
      global: { plugins: [router] },
    });

    mounted.push(tabbar);
    await tabbar.get('[data-tour="tab-social"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/chat");
    expect(chat.currentChatUserId).toBeNull();
    expect(chat.conversations[1].unreadCount).toBe(2);
  });

  it.each([false, true])(
    "сохраняет автоматическое открытие на десктопе: %s",
    async (single) => {
      const { chat } = await setup("/chat", false, single);

      expect(chat.openChat).toHaveBeenLastCalledWith(
        "me",
        single ? "second" : "first"
      );
    }
  );
});
