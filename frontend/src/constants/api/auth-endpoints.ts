import { API_BASE_URL, APP_ENDPOINTS } from "@/constants/api/endpoints";

// Updated auth endpoints to match backend structure
export const REGISTER_USER_ENDPOINT = `${API_BASE_URL}/${APP_ENDPOINTS.register}`;
export const AUTH_USER_ENDPOINT = `${API_BASE_URL}/${APP_ENDPOINTS.login}`;
export const AUTH_ME_ENDPOINT = `${API_BASE_URL}/${APP_ENDPOINTS.authMe}`;
