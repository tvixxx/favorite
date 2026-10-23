import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";

vi.mock("@/state/state", () => ({
  useMainStore: () => ({
    user: { isAuthLoaded: true },
    isLoggedIn: true,
    userData: null,
    authUnavailable: false,
  }),
}));

vi.mock("@/composable", () => ({
  themeConfig: {},
  useTheme: vi.fn(),
  useHotThemeKeys: vi.fn(),
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({ disconnect: vi.fn(), totalUnreadCount: 2 }),
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ resetSession: vi.fn() }),
}));

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

async function setup() {
  const page = { template: '<section class="test-page">Содержимое</section>' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/library/catalog", component: page },
      {
        path: "/detail/test",
        component: page,
        meta: { hideMobileTabBar: true },
      },
      { path: "/login", component: page, meta: { guest: true } },
    ],
  });

  await router.push("/library/catalog");

  const wrapper = mount(App, {
    global: {
      plugins: [router],
      stubs: {
        NavigationLinks: true,
        OnboardingModal: true,
        PwaStatus: true,
        BaseIcon: true,
        AppSpinner: true,
      },
    },
  });

  mounted.push(wrapper);
  await flushPromises();

  return { wrapper, router };
}

describe("Нижняя навигация приложения", () => {
  it("расположена после содержимого страницы", async () => {
    const { wrapper } = await setup();
    const page = wrapper.get(".test-page").element;
    const navigation = wrapper.get(
      'nav[aria-label="Основная навигация"]'
    ).element;

    expect(
      page.compareDocumentPosition(navigation) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("не переносит панель по координатам клавиатуры и при последующей прокрутке", async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 800,
      offsetTop: 0,
      scale: 1,
    });

    vi.stubGlobal("visualViewport", viewport);

    const { wrapper } = await setup();
    const navigation = wrapper.get<HTMLElement>(".mobile-tabbar").element;

    for (const [height, offsetTop] of [
      [360, 120],
      [776, 24],
      [776, 0],
    ]) {
      Object.assign(viewport, { height, offsetTop });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
      await nextTick();

      expect(navigation.style.top).toBe("");
      expect(navigation.style.transform).toBe("");
      expect(navigation.textContent).toContain("Каталог");
    }
  });

  it("скрыта на гостевом экране и странице со своей панелью, возвращается в каталог", async () => {
    const { wrapper, router } = await setup();

    for (const path of ["/detail/test", "/login", "/library/catalog"]) {
      await router.push(path);
      await flushPromises();

      expect(wrapper.find(".mobile-tabbar").exists()).toBe(
        path === "/library/catalog"
      );

      expect(wrapper.find(".test-page").exists()).toBe(true);
    }
  });
});
