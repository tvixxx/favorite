import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import { useFriendsStore } from "@/stores";
import SettingBlock from "./SettingBlock.vue";
vi.mock("vue-router", async (original) => ({
  ...(await original<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Склонения счётчиков общения в профиле", () => {
  it.each([1, 2, 5, 11, 21])("согласует подписи с количеством %s", (count) => {
    const pinia = createPinia();

    setActivePinia(pinia);
    useFriendsStore().stats = {
      friendsCount: count,
      subscribersCount: count,
      subscriptionsCount: count,
      pendingRequestsCount: 0,
    };

    const wrapper = mount(SettingBlock, {
      props: {
        type: "friends",
        title: "Друзья",
        description: "",
        icon: "ph:users",
      },
      global: {
        plugins: [pinia],
        stubs: {
          BaseIcon: true,
          AButton: { template: "<button><slot /></button>" },
        },
      },
    });
    const forms: Record<number, string[]> = {
      1: ["друг", "подписчик", "подписка"],
      2: ["друга", "подписчика", "подписки"],
      5: ["друзей", "подписчиков", "подписок"],
      11: ["друзей", "подписчиков", "подписок"],
      21: ["друг", "подписчик", "подписка"],
    };

    expect(
      wrapper.findAll(".friends-stats__label").map((label) => label.text())
    ).toEqual(forms[count]);

    wrapper.unmount();
  });
});
