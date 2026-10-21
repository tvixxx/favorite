import { shallowMount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ChatPage from "./ChatPage.vue";

const mocks = vi.hoisted(() => ({
  chat: {
    currentChatUserId: "peer",
    conversations: [] as Array<{ otherUser: { id: string; fullName: string } }>,
    currentMessages: [],
    isLoading: false,
    fetchConversations: vi.fn(),
    openChat: vi.fn(),
    closeChat: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useChatStore: () => mocks.chat,
  useUserStatusStore: () => ({ isUserOnline: () => false }),
  useFriendsStore: () => ({
    friends: [{ friend: { id: "peer", fullName: "Михаил" } }],
  }),
}));

vi.mock("@/state/state", () => ({
  useMainStore: () => ({ userData: { id: "me" } }),
}));

vi.mock("vue-router", async (original) => ({
  ...(await original<typeof import("vue-router")>()),
  useRoute: () => ({ params: { userId: "peer" } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/composable/useDateTime", () => ({
  useDateTime: () => ({ formatInstant: () => "" }),
}));

describe("Имя собеседника в новом диалоге", () => {
  it("показывает имя друга ещё до первого сообщения", async () => {
    const wrapper = shallowMount(ChatPage);

    await flushPromises();
    expect(wrapper.get(".chat-page__header-username").text()).toBe("Михаил");
    wrapper.unmount();
  });
});
