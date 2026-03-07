import axios from "axios";
import { API_BASE_URL } from "@/constants/api/endpoints";
import { useAuthToken } from "@/composable";
import router from "@/router";
import { CURRENT_USER, CURRENT_USER_TOKEN } from "@/constants";

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
      localStorage.removeItem(CURRENT_USER);
      localStorage.removeItem(CURRENT_USER_TOKEN);

      const currentRoute = router.currentRoute.value.path;
      if (currentRoute !== LOGIN_ROUTE) {
        router.push(LOGIN_ROUTE);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
