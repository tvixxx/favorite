import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPreferences } from "@/utils/userPreferences";
import AdditionalSettingsPage from "./AdditionalSettingsPage.vue";

const mocks = vi.hoisted(() => ({
  main: null as unknown as ReturnType<typeof makeMain>,
}));

vi.mock("@/state/state", () => ({ useMainStore: () => mocks.main }));

function makeMain() {
  return reactive({
    userData: { id: "owner", quickAddEnabled: true } as {
      id: string;
    } & Partial<UserPreferences>,
    sessionRevision: 1,
    isUpdatingProfile: false,
    updateProfile: vi.fn(async (patch: Partial<UserPreferences>) => {
      Object.assign(mocks.main.userData, patch);
    }),
  });
}

const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel }));
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate"
);
let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  mocks.main = makeMain();
  cancel.mockClear();
  animate.mockClear();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animate,
  });
});

afterEach(() => {
  wrapper?.unmount();
  if (originalAnimate)
    Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  vi.unstubAllGlobals();
});

async function open(path = "/profile/settings") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/profile/settings",
        name: "profile-settings",
        component: AdditionalSettingsPage,
      },
      { path: "/profile", component: { template: "<div/>" } },
    ],
  });

  await router.push(path);
  wrapper = mount(AdditionalSettingsPage, {
    global: { plugins: [router], stubs: { BaseIcon: true } },
  });

  await flushPromises();

  return router;
}

describe("Дополнительные настройки", () => {
  it("открывает только выбранную категорию и сохраняет изменённый выбор между категориями", async () => {
    const router = await open();

    expect(wrapper.find('[aria-label="Показывать достижения"]').exists()).toBe(
      true
    );

    await wrapper.get("nav button:nth-of-type(2)").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.query.section).toBe("personal");
    expect(wrapper.find('[aria-label="Показывать достижения"]').exists()).toBe(
      false
    );

    await wrapper.get('[aria-label="Быстрый ввод"]').trigger("click");
    await flushPromises();
    await wrapper.get("nav button:nth-of-type(3)").trigger("click");
    await flushPromises();
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Новые сообщения"]').exists()).toBe(true);
    await wrapper.get("nav button:nth-of-type(2)").trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Быстрый ввод"]').attributes("aria-checked")
    ).toBe("false");

    expect(wrapper.get("a").attributes("href")).toBe("/profile");
  });

  it("открывает уведомления по прямой ссылке и возвращает вид приложения для неизвестной категории", async () => {
    const router = await open("/profile/settings?section=notifications");

    expect(wrapper.find('[aria-label="Новые сообщения"]').exists()).toBe(true);
    await router.replace("/profile/settings?section=unknown");
    await flushPromises();
    expect(wrapper.find('[aria-label="Показывать достижения"]').exists()).toBe(
      true
    );

    expect(wrapper.find('[aria-label="Новые сообщения"]').exists()).toBe(false);
  });

  it("показывает новую категорию с тем же появлением, что история уведомлений, и отменяет прежнее движение", async () => {
    await open();
    expect(animate).not.toHaveBeenCalled();
    await wrapper.get("nav button:nth-of-type(2)").trigger("click");
    await flushPromises();
    expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });

    await wrapper.get("nav button:nth-of-type(2)").trigger("click");
    await flushPromises();
    expect(animate).toHaveBeenCalledTimes(1);
    await wrapper.get("nav button:nth-of-type(3)").trigger("click");
    await flushPromises();
    expect(cancel).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("меняет категорию без движения при включённом уменьшении анимации", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await open();
    await wrapper.get("nav button:nth-of-type(2)").trigger("click");
    await flushPromises();
    expect(wrapper.find('[aria-label="Быстрый ввод"]').exists()).toBe(true);
    expect(animate).not.toHaveBeenCalled();
  });
});
