import { API_BASE_URL, APP_ENDPOINTS } from "@/constants/api/endpoints";

export const MOVIES_ENDPOINTS = `${API_BASE_URL}/${APP_ENDPOINTS.movies}`;
// Note: Backend doesn't have a separate favorites endpoint, using movie's isFavorite field instead
// The favorites functionality should be implemented by updating the movie's isFavorite property
export const FAVORITES_ENDPOINT = `${API_BASE_URL}/${APP_ENDPOINTS.movies}`; // Using movies endpoint with isFavorite flag
