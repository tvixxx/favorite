export const APP_ENDPOINTS = {
  auth: "auth",
  login: "auth/login",
  authMe: "auth/@me",
  register: "auth/register",
  movies: "movies",
  profile: "profile",
  uploads: "uploads",
  users: "users",
  actors: "actors",
} as const;

export type AppEndpoints = keyof typeof APP_ENDPOINTS | string;

// Updated to use local backend instead of mokky.dev
export const API_BASE_URL = "http://localhost:3000";

export const API_BASE_HOST_URL = "http://localhost:3000";
