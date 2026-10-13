import { defineStore } from "pinia";
import { computed, onScopeDispose, ref } from "vue";
import { isAxiosError } from "axios";
import {
  AUTH_ME_ENDPOINT,
  AUTH_USER_ENDPOINT,
  CURRENT_USER,
  CURRENT_USER_TOKEN,
  LOGOUT_ENDPOINT,
  REGISTER_USER_ENDPOINT,
  USERS_ENDPOINTS,
} from "@/constants";
import { isSuccessStatus } from "@/utils";
import { FETCH_METHOD, useFetch } from "@/composable";
import { StorageSerializers, useStorage } from "@vueuse/core";
import type {
  AuthResponse,
  State,
  UserData,
  UserProfileResponse,
} from "@/state/types";
import { DEFAULT_MAIN_STATE, MAIN_STORE_NAME } from "@/state/constants";
import { useUserMoviesStore } from "@/stores/userMovies/userMoviesStore";
import { useUserListsStore } from "@/stores/userLists/userListsStore";
import { useNotificationsStore } from "@/stores/notifications/notificationsStore";
import { useFriendsStore } from "@/stores/friends/friendsStore";
import { useBadgesStore } from "@/stores/badges/badgesStore";
import { useChatStore } from "@/stores/chat/chatStore";
import { useReviewsStore } from "@/composable/useReviews";

function profileData(profile: UserProfileResponse): UserData {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName || profile.fullname || profile.name || "",
    role: profile.role,
    avatarUrl: profile.avatarUrl ?? null,
    avatarThumbnailUrl: profile.avatarThumbnailUrl ?? null,
    avatarAssetId: profile.avatarAssetId ?? null,
  };
}

export const useMainStore = defineStore(MAIN_STORE_NAME, () => {
  const userDataRaw = useStorage<UserData | null>(
    CURRENT_USER,
    null,
    undefined,
    { serializer: StorageSerializers.object }
  );
  const accessToken = useStorage<string | null>(
    CURRENT_USER_TOKEN,
    null,
    undefined,
    {
      serializer: StorageSerializers.string,
    }
  );

  // Состояние копируем: DEFAULT_MAIN_STATE — общая константа, её нельзя мутировать
  const state = ref<State>(structuredClone(DEFAULT_MAIN_STATE));
  const sessionRevision = ref(0);
  const authUnavailable = ref(false);

  /** Разделяемый запрос проверки сессии — чтобы не гонять `/auth/@me` дважды */
  let authRequest: Promise<void> | null = null;

  const user = computed(() => state.value.user);
  const isFetchingUser = computed(() => state.value.isFetchingUser);
  const isLoggedIn = computed(() => user.value.loggedIn);
  const userData = computed(() => user.value.data);

  async function updateDisplayName(displayName: string): Promise<void> {
    if (!displayName) {
      return;
    }

    await updateProfile({ fullName: displayName });
  }

  async function updateProfile(payload: {
    fullName?: string;
    avatarUrl?: string | null;
    avatarAssetId?: string | null;
  }): Promise<void> {
    const id = user.value.data?.id;

    if (!id) {
      throw new Error("Войдите в аккаунт");
    }

    const requestRevision = sessionRevision.value;

    const userProfileData = await useFetch<UserProfileResponse>(
      `${USERS_ENDPOINTS}/${id}`,
      {
        method: FETCH_METHOD.patch,
        data: payload,
      }
    );

    if (requestRevision !== sessionRevision.value) {
      throw new Error("Сессия изменилась");
    }

    if (userProfileData?.data && isSuccessStatus(userProfileData.status)) {
      const userObj = profileData(userProfileData.data);

      userDataRaw.value = userObj;
      state.value.user.data = userObj;
    } else {
      throw new Error("Не удалось изменить имя");
    }
  }

  async function register({
    email,
    password,
    name,
  }: {
    email: string;
    password: string;
    name: string;
  }): Promise<void> {
    clearAuthState();
    const requestRevision = sessionRevision.value;
    const response = await useFetch<AuthResponse>(REGISTER_USER_ENDPOINT, {
      method: FETCH_METHOD.post,
      data: {
        fullName: name,
        email,
        password,
      },
    });

    if (requestRevision !== sessionRevision.value) {
      throw new Error("Сессия изменилась");
    }

    if (response?.data && isSuccessStatus(response.status)) {
      const { accessToken: newToken } = response.data;

      await fetchUserProfile(newToken, requestRevision);
    } else {
      throw new Error("Не удалось зарегистрироваться");
    }
  }

  async function logIn({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<void> {
    clearAuthState();
    const requestRevision = sessionRevision.value;
    const response = await useFetch<AuthResponse>(AUTH_USER_ENDPOINT, {
      method: FETCH_METHOD.post,
      data: {
        email,
        password,
      },
    });

    if (requestRevision !== sessionRevision.value) {
      throw new Error("Сессия изменилась");
    }

    if (response?.data && isSuccessStatus(response.status)) {
      const { accessToken: newToken } = response.data;

      await fetchUserProfile(newToken, requestRevision);
    } else {
      throw new Error("Не удалось войти");
    }
  }

  /**
   * Проверяет сессию по `/auth/@me`.
   *
   * Вызывается и из router-guard, и (исторически) из других мест, поэтому
   * параллельные вызовы ждут ОДИН запрос. Раньше второй вызов подставлял
   * `loggedIn` из localStorage, не дожидаясь ответа, — из-за этого можно было
   * оказаться «залогиненным» с истёкшим токеном и увидеть шапку на /login.
   */
  async function fetchUser(): Promise<void> {
    if (user.value.isAuthLoaded && !authUnavailable.value) {
      return;
    }

    if (authRequest) {
      return authRequest;
    }

    const request = requestCurrentUser().finally(() => {
      if (authRequest === request) {
        authRequest = null;
      }
    });

    authRequest = request;

    return authRequest;
  }

  async function requestCurrentUser(): Promise<void> {
    const requestRevision = sessionRevision.value;

    state.value.isFetchingUser = true;

    try {
      const { data, status } = await useFetch<UserProfileResponse>(
        AUTH_ME_ENDPOINT
      );

      if (requestRevision !== sessionRevision.value) {
        return;
      }

      authUnavailable.value = false;

      if (isSuccessStatus(status)) {
        const userObj = profileData(data);

        userDataRaw.value = userObj;
        state.value.user.data = userObj;
        state.value.user.loggedIn = true;
      } else {
        userDataRaw.value = null;
        state.value.user.data = null;
        state.value.user.loggedIn = false;
      }
    } catch (error) {
      if (requestRevision !== sessionRevision.value) {
        return;
      }

      authUnavailable.value =
        isAxiosError(error) &&
        (!error.response || error.response.status >= 500);
      userDataRaw.value = null;
      state.value.user.data = null;
      state.value.user.loggedIn = false;
      throw new Error("Не удалось получить данные пользователя", { cause: error });
    } finally {
      if (requestRevision === sessionRevision.value) {
        state.value.user.isAuthLoaded = true;
        state.value.isFetchingUser = false;
      }
    }
  }

  async function fetchUserProfile(
    newToken: string,
    requestRevision: number
  ): Promise<void> {
    if (!newToken) {
      throw new Error("Не удалось получить токен");
    }

    accessToken.value = newToken;
    state.value.isFetchingUser = true;

    try {
      const fetchedUser = await useFetch<UserProfileResponse>(AUTH_ME_ENDPOINT);

      if (requestRevision !== sessionRevision.value) {
        throw new Error("Сессия изменилась");
      }

      if (!fetchedUser.data || !isSuccessStatus(fetchedUser.status)) {
        throw new Error("Не удалось получить профиль");
      }

      setUserProfile(fetchedUser.data);
    } catch (error) {
      if (requestRevision === sessionRevision.value) {
        clearAuthState();
      }

      throw error;
    } finally {
      if (requestRevision === sessionRevision.value) {
        state.value.isFetchingUser = false;
      }
    }
  }

  function setUserProfile(userProfile: UserProfileResponse) {
    if (!userProfile) {
      return;
    }

    const userObj = profileData(userProfile);

    userDataRaw.value = userObj;
    state.value.user.data = userObj;
    state.value.user.loggedIn = true;
    state.value.user.isAuthLoaded = true;
  }

  function clearAuthState(): void {
    sessionRevision.value++;
    authRequest = null;
    authUnavailable.value = false;
    userDataRaw.value = null;
    accessToken.value = null;
    state.value.user.data = null;
    state.value.user.loggedIn = false;
    state.value.user.isAuthLoaded = true;
    state.value.isFetchingUser = false;
    useUserMoviesStore().resetSession();
    useUserListsStore().resetSession();
    useNotificationsStore().resetSession();
    useFriendsStore().resetSession();
    useBadgesStore().resetSession();
    useChatStore().disconnect();
    useReviewsStore().resetSession();
  }

  async function logOut(): Promise<void> {
    // Локально разлогиниваемся сразу (без гонки с guest-guard),
    clearAuthState();

    // …и гасим серверную сессию: бэкенд чистит httpOnly refresh-cookie.
    // Best-effort — при сетевой ошибке локально мы уже разлогинены.
    try {
      await useFetch(LOGOUT_ENDPOINT, { method: FETCH_METHOD.post });
    } catch {
      // no-op
    }
  }

  function applyAccessToken(
    newToken: string,
    expectedRevision = sessionRevision.value
  ): boolean {
    if (expectedRevision !== sessionRevision.value) {
      return false;
    }

    accessToken.value = newToken;

    return true;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("auth:logout", clearAuthState);

    onScopeDispose(() => {
      window.removeEventListener("auth:logout", clearAuthState);
    });
  }

  return {
    state,

    user,
    isFetchingUser,
    isLoggedIn,
    userData,
    userDataRaw,
    accessToken,
    sessionRevision,
    authUnavailable,

    updateDisplayName,
    updateProfile,
    register,
    logIn,
    logOut,
    fetchUser,
    applyAccessToken,
  };
});
