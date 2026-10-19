import { reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  store: null as unknown as {
    authUnavailable: boolean;
    isFetchingUser: boolean;
    isLoggedIn: boolean;
    userData: null;
    user: { isAuthLoaded: boolean };
    fetchUser: () => Promise<void>;
  },
}));

vi.mock("@/state/state", () => ({ useMainStore: () => mocks.store }));
vi.mock("@/composable", () => ({
  themeConfig: {},
  useTheme: vi.fn(),
  useHotThemeKeys: vi.fn(),
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fetchConversations: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({
    hydrate: vi.fn().mockResolvedValue(undefined),
    resetSession: vi.fn(),
  }),
}));

async function render(redirect = "/admin?tab=catalog") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/login",
        component: { template: "<h1>Вход</h1>" },
        meta: { guest: true },
      },
      { path: "/admin", component: { template: "<h1>Администрирование</h1>" } },
      {
        path: "/library/collection",
        component: { template: "<h1>Коллекция</h1>" },
      },
    ],
  });

  await router.push({ path: "/login", query: { redirect } });

  const wrapper = mount(App, {
    global: {
      plugins: [router],
      stubs: {
        NavigationLinks: true,
        MobileTabBar: true,
        OnboardingModal: true,
        PwaStatus: true,
        BaseIcon: true,
        AppSpinner: true,
      },
    },
  });

  await flushPromises();

  return { wrapper, router };
}

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.store = reactive({
    authUnavailable: true,
    isFetchingUser: false,
    isLoggedIn: false,
    userData: null,
    user: { isAuthLoaded: true },
    fetchUser: mocks.fetch,
  });
});

afterEach(() => vi.restoreAllMocks());

describe("Восстановление PWA после отсутствия соединения", () => {
  it("проверяет сессию после возврата сети и возвращает исходную страницу", async () => {
    const connection = vi
      .spyOn(navigator, "onLine", "get")
      .mockReturnValue(false);

    mocks.fetch.mockImplementation(async () => {
      mocks.store.authUnavailable = false;
      mocks.store.isLoggedIn = true;
    });

    const { wrapper, router } = await render();

    expect(wrapper.text()).toContain("Не удалось подключиться");
    connection.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await flushPromises();
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.fullPath).toBe("/admin?tab=catalog");
    wrapper.unmount();
  });

  it("оставляет повторную попытку доступной, если сервер всё ещё недоступен", async () => {
    mocks.fetch.mockRejectedValue(new Error("still offline"));

    const { wrapper, router } = await render();

    await wrapper.get(".stateblock__btn").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Не удалось подключиться");
    expect(
      wrapper.get<HTMLButtonElement>(".stateblock__btn").element.disabled
    ).toBe(false);

    expect(router.currentRoute.value.path).toBe("/login");
    wrapper.unmount();
  });

  it("не использует внешний адрес из параметра возврата", async () => {
    mocks.fetch.mockImplementation(async () => {
      mocks.store.authUnavailable = false;
      mocks.store.isLoggedIn = true;
    });

    const { wrapper, router } = await render("//outside.example/path");

    await wrapper.get(".stateblock__btn").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/library/collection");
    wrapper.unmount();
  });
});
