import { createPinia, disposePinia, getActivePinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainStore } from "./state";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), reset: vi.fn() }));
vi.mock("@/composable", () => ({ useFetch: mocks.fetch, FETCH_METHOD: { post: "POST", patch: "PATCH" } }));
vi.mock("@/stores/userMovies/userMoviesStore", () => ({ useUserMoviesStore: () => ({ resetSession: mocks.reset }) }));
vi.mock("@/stores/userLists/userListsStore", () => ({ useUserListsStore: () => ({ resetSession: mocks.reset }) }));
vi.mock("@/stores/notifications/notificationsStore", () => ({ useNotificationsStore: () => ({ resetSession: mocks.reset }) }));
vi.mock("@/stores/friends/friendsStore", () => ({ useFriendsStore: () => ({ resetSession: mocks.reset }) }));
vi.mock("@/stores/badges/badgesStore", () => ({ useBadgesStore: () => ({ resetSession: mocks.reset }) }));
vi.mock("@/stores/chat/chatStore", () => ({ useChatStore: () => ({ disconnect: mocks.reset }) }));
vi.mock("@/composable/useReviews", () => ({ useReviewsStore: () => ({ resetSession: mocks.reset }) }));

const profile = { id: "user-id", email: "example@example.test", fullName: "Тест" };

describe("Жизненный цикл авторизации", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    mocks.fetch.mockReset();
    mocks.reset.mockClear();
  });
  afterEach(() => { disposePinia(getActivePinia()!); localStorage.clear(); });

  it("не возвращает профиль поздним auth/me после выхода", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: true });
    const store = useMainStore();
    const pending = store.fetchUser();
    await store.logOut();
    finish({ status: 200, data: profile });
    await pending;
    expect(store.isLoggedIn).toBe(false);
    expect(store.userData).toBeNull();
    expect(store.accessToken).toBeNull();
  });

  it("хранит профиль без второй копии токена и завершает загрузку авторизации", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { accessToken: "fixture-access" } });
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: profile });
    const store = useMainStore();
    await store.logIn({ email: "example@example.test", password: "fixture-password" });
    expect(store.userData).toEqual(profile);
    expect(store.accessToken).toBe("fixture-access");
    expect(store.user.isAuthLoaded).toBe(true);
  });

  it("не восстанавливает loggedIn из кешированного профиля при refresh", () => {
    const store = useMainStore();
    store.userDataRaw = profile;
    store.applyAccessToken("fixture-access");
    expect(store.isLoggedIn).toBe(false);
    expect(store.userData).toBeNull();
    expect(store.accessToken).toBe("fixture-access");
  });

  it("очищает токен при ошибке получения профиля во время входа", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: { accessToken: "fixture-access" } });
    mocks.fetch.mockRejectedValueOnce(new Error("Profile unavailable"));
    const store = useMainStore();
    await expect(store.logIn({ email: "example@example.test", password: "fixture-password" })).rejects.toThrow();
    expect(store.accessToken).toBeNull();
    expect(store.isLoggedIn).toBe(false);
  });
});
