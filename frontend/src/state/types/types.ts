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
