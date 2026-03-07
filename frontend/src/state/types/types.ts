export interface UserData {
  email: string;
  fullName: string;
  id: string;
  accessToken: string;
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
export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  fullname?: string;
  name?: string;
}
