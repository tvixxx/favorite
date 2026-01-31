import { API_BASE_URL } from "@/constants/api/endpoints";

// Using the auth @me endpoint which returns user profile information
export const PROFILE_ENDPOINT = `${API_BASE_URL}/auth/@me`; // Matches backend auth controller @me endpoint
