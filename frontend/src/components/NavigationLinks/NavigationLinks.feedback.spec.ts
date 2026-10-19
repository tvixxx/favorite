import { flushPromises, shallowMount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NavigationLinks from "./NavigationLinks.vue";

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/services/api", () => ({ default: api }));
vi.mock("@/state/state", () => ({
  useMainStore: () => ({
    isLoggedIn: true,
    userData: { id: "user", fullName: "Пользователь", role: "USER" },
  }),
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ items: [], unreadCount: 0 }),
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({ totalUnreadCount: 0 }),
}));

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/library/collection", component: { template: "<div/>" } },
    ],
  });

  await router.push("/library/collection");

  return shallowMount(NavigationLinks, {
    global: {
      plugins: [router],
      renderStubDefaultSlot: true,
      stubs: {
        AButton: true,
        AAvatar: true,
        ADropdown: { template: "<div><slot/><slot name='overlay'/></div>" },
        ADrawer: { template: "<div><slot/></div>" },
      },
    },
  });
}

beforeEach(() => {
  api.get.mockReset();
});

describe("Обратная связь в меню", () => {
  it.each([false, true])(
    "показывает оба пункта только при разрешении сервера %s",
    async (feedback) => {
      api.get.mockResolvedValue({ data: { feedback } });

      const wrapper = await render();

      await flushPromises();
      expect(
        wrapper
          .findAll("button")
          .filter((button) => button.text() === "Обратная связь")
      ).toHaveLength(feedback ? 2 : 0);

      wrapper.unmount();
    }
  );

  it("скрывает пункты при ошибке проверки", async () => {
    api.get.mockRejectedValue(new Error("Нет связи"));

    const wrapper = await render();

    await flushPromises();
    expect(wrapper.text()).not.toContain("Обратная связь");
    wrapper.unmount();
  });
});
