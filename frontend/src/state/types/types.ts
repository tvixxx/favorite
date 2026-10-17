import type { UserPreferences } from "@/utils/userPreferences";

export interface UserData extends Partial<UserPreferences> {
  email: string;
  fullName: string;
  timezone?: string;
  id: string;
  role?: "USER" | "ADMIN";
  avatarUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  avatarAssetId?: string | null;
}

export interface UserInfo {
  loggedIn: boolean;
  isAuthLoaded: boolean;
  data: UserData | null;
}

export interface State {
  user: UserInfo;
  isFetchingUser: boolean;
}

export type ReqType = "login" | "register";

// auth/login и auth/register
export interface AuthResponse {
  accessToken: string;
}

// Ответ от auth/@me и users/:id
export interface UserProfileResponse extends Partial<UserPreferences> {
  id: string;
  email: string;
  fullName: string;
  timezone?: string;
  fullname?: string;
  name?: string;
  role?: "USER" | "ADMIN";
  avatarUrl?: string | null;
  avatarThumbnailUrl?: string | null;
  avatarAssetId?: string | null;
}
