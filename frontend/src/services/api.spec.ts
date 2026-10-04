import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./api";

const mocks = vi.hoisted(() => ({
  store: { accessToken: "fixture-old-access" as string | null, sessionRevision: 0, applyAccessToken: vi.fn() },
  router: { currentRoute: { value: { path: "/profile", matched: [{}] } }, replace: vi.fn() },
}));
vi.mock("@/composable", () => ({ useAuthToken: () => ({ value: mocks.store.accessToken }) }));
vi.mock("@/state/state", () => ({ useMainStore: () => mocks.store }));
vi.mock("@/router", () => ({ default: mocks.router }));

const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ data, config, status: 200, statusText: "OK", headers: {} });
const unauthorized = (config: InternalAxiosRequestConfig) => Promise.reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, { ...response(config, {}), status: 401 }));

describe("Повтор HTTP-запросов после refresh", () => {
  let oldAdapter: AxiosAdapter | undefined;
  beforeEach(() => {
    oldAdapter = axios.defaults.adapter as AxiosAdapter;
    mocks.store.accessToken = "fixture-old-access";
    mocks.store.sessionRevision = 0;
    mocks.store.applyAccessToken.mockReset();
    mocks.store.applyAccessToken.mockImplementation((token: string, expectedRevision = mocks.store.sessionRevision) => {
      if (expectedRevision !== mocks.store.sessionRevision) return false;
      mocks.store.accessToken = token;

      return true;
    });
    mocks.router.replace.mockClear();
  });
  afterEach(() => { axios.defaults.adapter = oldAdapter; });

  it("объединяет параллельные 401 в один refresh и повторяет оба запроса с новым токеном", async () => {
    let complete!: (data: unknown) => void;
    let refreshConfig!: InternalAxiosRequestConfig;
    const refresh = vi.fn((config: InternalAxiosRequestConfig) => { refreshConfig = config;

 return new Promise<AxiosResponse>((resolve) => { complete = (data) => resolve(response(config, data)); }); });
    axios.defaults.adapter = refresh;
    api.defaults.adapter = (config) => config.headers.get("Authorization") === "Bearer fixture-new-access" ? Promise.resolve(response(config, "saved")) : unauthorized(config);
    const pending = Promise.all([api.get("/users/user-id/movies"), api.get("/users/user-id/lists")]);
    await flushPromises();
    expect(refresh).toHaveBeenCalledOnce();
    expect(refreshConfig.withCredentials).toBe(true);
    complete({ accessToken: "fixture-new-access" });
    expect((await pending).map((item) => item.data)).toEqual(["saved", "saved"]);
  });

  it("не обновляет сессию и не перенаправляет при ошибке входа", async () => {
    const refresh = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(response(config, { accessToken: "unexpected" })));
    axios.defaults.adapter = refresh;
    api.defaults.adapter = unauthorized;
    await expect(api.post("/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(refresh).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("не отдаёт успешный ответ предыдущей сессии после выхода", async () => {
    let complete!: () => void;
    api.defaults.adapter = (config) => new Promise<AxiosResponse>((resolve) => { complete = () => resolve(response(config, { privateData: "fixture" })); });
    const pending = api.get("/users/user-id/movies").catch((error: unknown) => error);
    await flushPromises();
    mocks.store.sessionRevision++;
    complete();
    expect(axios.isCancel(await pending)).toBe(true);
  });

  it("не применяет поздний refresh предыдущего аккаунта и не разлогинивает новую сессию", async () => {
    let complete!: (data: unknown) => void;
    axios.defaults.adapter = (config) => new Promise<AxiosResponse>((resolve) => { complete = (data) => resolve(response(config, data)); });
    api.defaults.adapter = unauthorized;
    const pending = api.get("/users/user-id/movies").catch((error: unknown) => error);
    await flushPromises();
    mocks.store.sessionRevision++;
    mocks.store.accessToken = "fixture-another-account";
    complete({ accessToken: "fixture-previous-account" });
    expect(await pending).toBeInstanceOf(AxiosError);
    expect(mocks.store.accessToken).toBe("fixture-another-account");
    expect(mocks.store.applyAccessToken).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
