import axios, {
  CanceledError,
  isAxiosError,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { AUTH_REFRESH_ENDPOINT } from "@/constants/api/auth-endpoints";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { useMainStore } from "@/state/state";
import { watch } from "vue";
import router from "@/router";
import type { AuthResponse } from "@/state/types";

const UNAUTHORIZED_STATUS = 401;
const LOGIN_ROUTE = "/login";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function forceLogoutAndRedirectToLogin(): void {
  window.dispatchEvent(new CustomEvent("auth:logout"));

  // Первая навигация ещё не завершилась (сюда попадаем из router-guard, который
  // проверяет сессию): push отсюда прервал бы её и оставил пустой каркас —
  // без шапки и с пустым контентом. Редиректом в этом случае занимается guard.
  if (!router.currentRoute.value.matched.length) {
    return;
  }

  const currentRoute = router.currentRoute.value.path;

  if (currentRoute !== LOGIN_ROUTE) {
    // replace, чтобы «назад» не возвращал на страницу с истёкшей сессией
    router.replace(LOGIN_ROUTE);
  }
}

function isAuthMutation(config: InternalAxiosRequestConfig): boolean {
  const path = (config.url ?? "").split("?")[0];

  return /\/auth\/(login|register|refresh|logout)\/?$/.test(path);
}

type SessionRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean; _authRevision?: number };
let refreshRequest: { revision: number; promise: Promise<string> } | null = null;

function getRefreshedAccessToken(revision: number): Promise<string> {
  if (!refreshRequest || refreshRequest.revision !== revision) {
    const store = useMainStore();
    const controller = new AbortController();
    const stopWatching = watch(() => store.sessionRevision, () => controller.abort(), { flush: "sync" });
    const request = (async () => {
      const { data } = await axios.post<AuthResponse>(
        AUTH_REFRESH_ENDPOINT,
        {},
        { withCredentials: true, signal: controller.signal }
      );

      if (!data?.accessToken) {
        throw new Error("Refresh: empty access token");
      }

      if (store.sessionRevision !== revision || !store.applyAccessToken(data.accessToken, revision)) {
        throw new Error("Сессия изменилась");
      }

      return data.accessToken;
    })().finally(() => {
      stopWatching();
      if (refreshRequest?.promise === request) refreshRequest = null;
    });
    refreshRequest = { revision, promise: request };
  }

  return refreshRequest.promise;
}

api.interceptors.request.use(
  (config) => {
    const store = useMainStore();
    const sessionConfig = config as SessionRequestConfig;
    sessionConfig._authRevision ??= store.sessionRevision;
    const token = store.accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const revision = (response.config as SessionRequestConfig)._authRevision;
    if (revision !== undefined && revision !== useMainStore().sessionRevision) {
      throw new CanceledError("Сессия изменилась");
    }

    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as SessionRequestConfig | undefined;

    if (status !== UNAUTHORIZED_STATUS || !originalRequest) {
      return Promise.reject(error);
    }

    if (isAuthMutation(originalRequest)) {
      return Promise.reject(error);
    }

    const revision = originalRequest._authRevision ?? useMainStore().sessionRevision;
    if (revision !== useMainStore().sessionRevision) return Promise.reject(error);

    if (originalRequest._retry) {
      forceLogoutAndRedirectToLogin();

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await getRefreshedAccessToken(revision);
      if (revision !== useMainStore().sessionRevision) return Promise.reject(error);
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch {
      if (revision === useMainStore().sessionRevision) forceLogoutAndRedirectToLogin();

      return Promise.reject(error);
    }
  }
);

function extractNestMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const m = (data as { message?: unknown }).message;

  if (typeof m === "string") {
    return m;
  }

  if (Array.isArray(m) && m.length > 0) {
    return String(m[0]);
  }

  return undefined;
}

export function getApiResponseMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }

  return extractNestMessage(error.response?.data);
}

export function isApiConflictError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409;
}

export default api;
