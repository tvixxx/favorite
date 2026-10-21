import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia,
} from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMainStore } from "./state";
import { useFriendsStore } from "@/stores/friends/friendsStore";
import { AxiosError } from "axios";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), reset: vi.fn() }));

vi.mock("@/composable", () => ({
  useFetch: mocks.fetch,
  FETCH_METHOD: { get: "GET", post: "POST", patch: "PATCH" },
}));

vi.mock("@/stores/userMovies/userMoviesStore", () => ({
  useUserMoviesStore: () => ({ resetSession: mocks.reset }),
}));

vi.mock("@/stores/userLists/userListsStore", () => ({
  useUserListsStore: () => ({ resetSession: mocks.reset }),
}));

vi.mock("@/stores/notifications/notificationsStore", () => ({
  useNotificationsStore: () => ({ resetSession: mocks.reset }),
}));

vi.mock("@/stores/badges/badgesStore", () => ({
  useBadgesStore: () => ({ resetSession: mocks.reset }),
}));

vi.mock("@/stores/chat/chatStore", () => ({
  useChatStore: () => ({ disconnect: mocks.reset }),
}));

vi.mock("@/composable/useReviews", () => ({
  useReviewsStore: () => ({ resetSession: mocks.reset }),
}));

const profile = {
  id: "user-id",
  email: "example@example.test",
  fullName: "Тест",
};

describe("Жизненный цикл авторизации", () => {
  it("не запускает второе сохранение профиля, пока не завершилось первое", async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 200, data: profile });

    const store = useMainStore();

    await store.fetchUser();

    let finish!: (response: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const pending = store.updateProfile({ watchTonightEnabled: true });

    await expect(
      store.updateProfile({ fullName: "Новое имя" })
    ).rejects.toThrow("Профиль уже сохраняется");

    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    finish({ status: 200, data: { ...profile, watchTonightEnabled: true } });
    await pending;
    expect(store.userData).toMatchObject({
      fullName: profile.fullName,
      watchTonightEnabled: true,
    });
  });

  it("загружает персональные настройки с сервера и сохраняет их после обновления профиля", async () => {
    const preferences = {
      quickAddEnabled: false,
      watchTonightEnabled: true,
      collectionFilesEnabled: true,
      notifyNewMessages: false,
      notifyFriendRequests: false,
      notifyRecommendations: true,
    };

    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { ...profile, ...preferences },
    });

    const store = useMainStore();

    await store.fetchUser();
    expect(store.userData).toMatchObject(preferences);
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { ...profile, ...preferences, fullName: "Новое имя" },
    });

    await store.updateProfile({ fullName: "Новое имя" });
    expect(store.userData).toMatchObject({
      ...preferences,
      fullName: "Новое имя",
    });
  });

  it("не переносит настройки первого аккаунта поздним ответом после входа другим", async () => {
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { ...profile, watchTonightEnabled: false },
    });

    const store = useMainStore();

    await store.fetchUser();

    let finish!: (response: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const pending = store.updateProfile({ watchTonightEnabled: true } as never);

    mocks.fetch.mockResolvedValueOnce({ status: 200, data: true });
    await store.logOut();
    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "second-token" },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ...profile, id: "second", watchTonightEnabled: false },
      });

    await store.logIn({
      email: "second@example.test",
      password: "fixture-password",
    });

    const rejected = expect(pending).rejects.toThrow("Сессия изменилась");

    finish({ status: 200, data: { ...profile, watchTonightEnabled: true } });
    await rejected;
    expect(store.userData).toMatchObject({
      id: "second",
      watchTonightEnabled: false,
    });
  });

  it("применяет общий UTC и сохраняет выбранный пояс после успешного обновления профиля", async () => {
    mocks.fetch
      .mockResolvedValueOnce({ status: 200, data: profile })
      .mockResolvedValueOnce({
        status: 200,
        data: { ...profile, timezone: "Europe/Berlin" },
      });

    const store = useMainStore();

    await store.fetchUser();
    expect(store.userData?.timezone).toBe("UTC");

    const revision = store.sessionRevision;

    await store.updateProfile({ timezone: "Europe/Berlin" });
    expect(store.userData?.timezone).toBe("Europe/Berlin");
    expect(store.userDataRaw?.timezone).toBe("Europe/Berlin");
    expect(store.sessionRevision).toBe(revision);
    expect(mocks.fetch.mock.calls[1][1].data).toEqual({
      timezone: "Europe/Berlin",
    });
  });

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    mocks.fetch.mockReset();
    mocks.reset.mockClear();
  });

  afterEach(() => {
    disposePinia(getActivePinia()!);
    localStorage.clear();
  });

  it("не возвращает профиль поздним auth/me после выхода", async () => {
    let finish!: (value: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

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

  it("повторно проверяет сессию после сетевого сбоя, не доверяя кешированному профилю", async () => {
    mocks.fetch.mockRejectedValueOnce(
      new AxiosError("Network Error", "ERR_NETWORK")
    );

    mocks.fetch.mockResolvedValueOnce({ status: 200, data: profile });

    const store = useMainStore();

    store.userDataRaw = { ...profile, role: "ADMIN" };
    store.applyAccessToken("fixture-access");
    await expect(store.fetchUser()).rejects.toThrow();
    expect(store.isLoggedIn).toBe(false);
    await store.fetchUser();
    expect(store.isLoggedIn).toBe(true);
    expect(store.userData?.role).toBeUndefined();
  });

  it("не повторяет проверку отклонённой сессии как временную сетевую ошибку", async () => {
    mocks.fetch.mockRejectedValueOnce(
      new AxiosError("Unauthorized", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 401,
      } as never)
    );

    const store = useMainStore();

    await expect(store.fetchUser()).rejects.toThrow();
    await store.fetchUser();
    expect(store.isLoggedIn).toBe(false);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("хранит профиль без второй копии токена и завершает загрузку авторизации", async () => {
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { accessToken: "fixture-access" },
    });

    mocks.fetch.mockResolvedValueOnce({ status: 200, data: profile });

    const store = useMainStore();

    await store.logIn({
      email: "example@example.test",
      password: "fixture-password",
    });

    expect(store.userData).toEqual({
      ...profile,
      username: null,
      quickAddEnabled: true,
      watchTonightEnabled: false,
      collectionFilesEnabled: false,
      notifyNewMessages: true,
      notifyFriendRequests: true,
      notifyRecommendations: false,
      timezone: "UTC",
      avatarUrl: null,
      avatarThumbnailUrl: null,
      avatarAssetId: null,
    });

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
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: { accessToken: "fixture-access" },
    });

    mocks.fetch.mockRejectedValueOnce(new Error("Profile unavailable"));

    const store = useMainStore();

    await expect(
      store.logIn({
        email: "example@example.test",
        password: "fixture-password",
      })
    ).rejects.toThrow();

    expect(store.accessToken).toBeNull();
    expect(store.isLoggedIn).toBe(false);
  });

  it("удаляет друзей первого пользователя при выходе и не показывает их после входа вторым", async () => {
    const store = useMainStore();
    const friends = useFriendsStore();

    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "first-access" },
      })
      .mockResolvedValueOnce({ status: 200, data: profile });

    await store.logIn({ email: profile.email, password: "fixture-password" });
    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: [
        {
          friendshipId: "first-relation",
          createdAt: "2026-10-01T00:00:00Z",
          friend: {
            id: "first-friend",
            fullName: "Друг первого пользователя",
            email: "first-friend@example.test",
          },
        },
      ],
    });

    await friends.fetchFriends(profile.id);
    expect(friends.friends.map((entry) => entry.friend.id)).toEqual([
      "first-friend",
    ]);

    mocks.fetch.mockRejectedValueOnce(new Error("Сервер временно недоступен"));
    await store.logOut();
    expect(store.isLoggedIn).toBe(false);
    expect(friends.friends).toEqual([]);

    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "second-access" },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ...profile, id: "second-user" },
      });

    await store.logIn({
      email: "second@example.test",
      password: "fixture-password",
    });

    expect(store.userData?.id).toBe("second-user");
    expect(friends.friends).toEqual([]);
  });

  it("не возвращает друзей поздним ответом первой сессии после входа вторым пользователем", async () => {
    const store = useMainStore();
    const friends = useFriendsStore();

    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "first-access" },
      })
      .mockResolvedValueOnce({ status: 200, data: profile });

    await store.logIn({ email: profile.email, password: "fixture-password" });

    let finish!: (response: unknown) => void;

    mocks.fetch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );

    const pending = friends.fetchFriends(profile.id);

    mocks.fetch.mockResolvedValueOnce({ status: 200, data: true });
    await store.logOut();
    mocks.fetch
      .mockResolvedValueOnce({
        status: 200,
        data: { accessToken: "second-access" },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { ...profile, id: "second-user" },
      });

    await store.logIn({
      email: "second@example.test",
      password: "fixture-password",
    });

    finish({
      status: 200,
      data: [
        {
          friendshipId: "old-relation",
          createdAt: "2026-10-01T00:00:00Z",
          friend: {
            id: "old-friend",
            fullName: "Друг первой сессии",
            email: "old@example.test",
          },
        },
      ],
    });

    await pending;
    expect(store.userData?.id).toBe("second-user");
    expect(friends.friends).toEqual([]);

    mocks.fetch.mockResolvedValueOnce({
      status: 200,
      data: [
        {
          friendshipId: "new-relation",
          createdAt: "2026-10-02T00:00:00Z",
          friend: {
            id: "new-friend",
            fullName: "Друг второй сессии",
            email: "new@example.test",
          },
        },
      ],
    });

    await friends.fetchFriends("second-user");
    expect(friends.friends.map((entry) => entry.friend.id)).toEqual([
      "new-friend",
    ]);
  });
});
