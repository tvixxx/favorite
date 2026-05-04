import axios, {
  isAxiosError,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { AUTH_REFRESH_ENDPOINT } from "@/constants/api/auth-endpoints";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { useAuthToken } from "@/composable";
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
  const currentRoute = router.currentRoute.value.path;

  if (currentRoute !== LOGIN_ROUTE) {
    router.push(LOGIN_ROUTE);
  }
}

function isAuthRefreshRequest(config: InternalAxiosRequestConfig): boolean {
  const path = config.url ?? "";

  return path.includes("auth/refresh");
}

let refreshPromise: Promise<string> | null = null;

function getRefreshedAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data } = await axios.post<AuthResponse>(
        AUTH_REFRESH_ENDPOINT,
        {},
        { withCredentials: true }
      );

      if (!data?.accessToken) {
        throw new Error("Refresh: empty access token");
      }

      const { useMainStore } = await import("@/state/state");
      useMainStore().applyAccessToken(data.accessToken);

      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  (config) => {
    const token = useAuthToken().value;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (status !== UNAUTHORIZED_STATUS || !originalRequest) {
      return Promise.reject(error);
    }

    if (isAuthRefreshRequest(originalRequest)) {
      forceLogoutAndRedirectToLogin();

      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      forceLogoutAndRedirectToLogin();

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await getRefreshedAccessToken();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch {
      forceLogoutAndRedirectToLogin();

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
