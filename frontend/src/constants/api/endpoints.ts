export const APP_ENDPOINTS = {
  auth: "auth",
  login: "auth/login",
  authRefresh: "auth/refresh",
  authMe: "auth/@me",
  register: "auth/register",
  logout: "auth/logout",
  movies: "movies",
  moviesStats: "movies/stats",
  profile: "profile",
  uploads: "uploads",
  users: "users",
  actors: "actors",
  feedback: "feedback",
} as const;

export type AppEndpoints = keyof typeof APP_ENDPOINTS | string;

// Updated to use local backend instead of mokky.dev
/** Адрес API. В проде за одним доменом это относительный «/api» (см. deploy/README.md) */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3005";

export const API_BASE_HOST_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3005";
