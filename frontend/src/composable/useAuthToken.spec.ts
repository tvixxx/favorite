import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthToken } from "./useAuthToken";
import { CURRENT_USER_TOKEN } from "@/constants";

const mocks = vi.hoisted(() => ({ store: { accessToken: null as string | null, userData: { accessToken: "legacy-token" } } }));
vi.mock("@/state/state", () => ({ useMainStore: () => mocks.store }));

describe("Единственный источник access token", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.store = reactive({ accessToken: null as string | null, userData: { accessToken: "legacy-token" } });
  });

  it("не восстанавливает токен из старого кеша профиля после выхода", () => {
    localStorage.setItem(CURRENT_USER_TOKEN, "old-storage-token");
    expect(useAuthToken().value).toBeNull();
  });

  it("реактивно следует авторитетному состоянию сессии", () => {
    const token = useAuthToken();
    mocks.store.accessToken = "current-access";
    expect(token.value).toBe("current-access");
    mocks.store.accessToken = null;
    expect(token.value).toBeNull();
  });
});
