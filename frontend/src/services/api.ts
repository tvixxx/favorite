import axios, { isAxiosError } from "axios";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { useAuthToken } from "@/composable";
import router from "@/router";

const UNAUTHORIZED_STATUS = 401;
const LOGIN_ROUTE = "/login";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

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
  (error) => {
    const status = error.response?.status;

    if (status === UNAUTHORIZED_STATUS) {
      window.dispatchEvent(new CustomEvent("auth:logout"));

      const currentRoute = router.currentRoute.value.path;
      if (currentRoute !== LOGIN_ROUTE) {
        router.push(LOGIN_ROUTE);
      }
    }

    return Promise.reject(error);
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
