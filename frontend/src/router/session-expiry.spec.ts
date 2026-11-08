import { flushPromises } from "@vue/test-utils";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import router from "./index";

const store = vi.hoisted(() => ({
  user: { isAuthLoaded: false },
  isLoggedIn: false,
  authUnavailable: false,
  fetchUser: vi.fn(),
}));

vi.mock("@/state/state", () => ({ useMainStore: () => store }));
vi.mock("@/composable/useFeedbackAvailability", () => ({
  fetchFeedbackAvailability: vi.fn(),
}));
vi.mock("@/views/pages/LoginUser.vue", () => ({
  default: { template: "<div>Вход</div>" },
}));

const protectedPath = "/test-session-expiry";
router.addRoute({
  path: protectedPath,
  component: { template: "<div>Личная страница</div>" },
  meta: { requiresAuth: true },
});

function expireSession(): void {
  store.isLoggedIn = false;
  window.dispatchEvent(new CustomEvent("auth:logout"));
}

afterEach(() => vi.restoreAllMocks());
afterAll(() => router.options.history.destroy());

describe("Маршрутизация при истечении сессии", () => {
  it("при первой навигации даёт guard завершить переход на вход", async () => {
    const replace = vi.spyOn(router, "replace");
    store.fetchUser.mockImplementation(async () => {
      store.user.isAuthLoaded = true;
      expireSession();
    });

    await router.push(protectedPath);

    expect(router.currentRoute.value.path).toBe("/login");
    expect(replace).not.toHaveBeenCalled();
  });

  it("после открытия личной страницы заменяет её входом один раз", async () => {
    store.isLoggedIn = true;
    await router.push(protectedPath);
    const replace = vi.spyOn(router, "replace");

    expireSession();
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/login");
    expect(replace).toHaveBeenCalledExactlyOnceWith("/login");

    expireSession();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
