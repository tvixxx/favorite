import { shallowMount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
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
    sendMessage: vi.fn(),
  },
}));

vi.mock("@/stores", () => ({
  useChatStore: () => reactive(mocks.chat),
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
  beforeEach(() => {
    reactive(mocks.chat).currentChatUserId = "peer";
    mocks.chat.sendMessage.mockReset();
  });

  it("показывает имя друга ещё до первого сообщения", async () => {
    const wrapper = shallowMount(ChatPage);

    await flushPromises();
    expect(wrapper.get(".chat-page__header-username").text()).toBe("Михаил");
    wrapper.unmount();
  });

  it("подтверждение сообщения прежнему собеседнику не очищает поле другого диалога", async () => {
    let finish!: () => void;

    mocks.chat.sendMessage.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    const wrapper = shallowMount(ChatPage);

    await flushPromises();

    const input = wrapper.getComponent({ name: "ChatMessageInput" });

    input.vm.$emit("update:modelValue", "Мой текст");
    await flushPromises();
    input.vm.$emit("send", "Мой текст");
    await flushPromises();
    expect(mocks.chat.sendMessage).toHaveBeenCalledWith("peer", "Мой текст");
    reactive(mocks.chat).currentChatUserId = "other";
    await flushPromises();
    finish();
    await flushPromises();
    expect(input.props("modelValue")).toBe("Мой текст");
    wrapper.unmount();
  });
});
