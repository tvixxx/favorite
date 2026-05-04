import { defineStore } from "pinia";
import { computed, onScopeDispose, ref } from "vue";
import {
  AUTH_ME_ENDPOINT,
  AUTH_USER_ENDPOINT,
  CURRENT_USER,
  CURRENT_USER_TOKEN,
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

export const useMainStore = defineStore(MAIN_STORE_NAME, () => {
  const userDataRaw = useStorage<UserData | null>(
    CURRENT_USER,
    null,
    undefined,
    { serializer: StorageSerializers.object },
  );
  const accessToken = useStorage<string | null>(
    CURRENT_USER_TOKEN,
    null,
    undefined,
    {
      serializer: StorageSerializers.string,
    },
  );

  const state = ref<State>(DEFAULT_MAIN_STATE);

  const user = computed(() => state.value.user);
  const isFetchingUser = computed(() => state.value.isFetchingUser);
  const isLoggedIn = computed(() => user.value.loggedIn);
  const userData = computed(() => user.value.data);

  async function updateDisplayName(displayName: string): Promise<void> {
    if (!displayName) {
      return;
    }

    const id = user.value.data?.id;

    const userProfileData = await useFetch<UserProfileResponse>(
      `${USERS_ENDPOINTS}/${id}`,
      {
        method: FETCH_METHOD.patch,
        data: {
          fullName: displayName,
        },
      },
    );

    if (userProfileData?.data && isSuccessStatus(userProfileData.status)) {
      const { token } = userProfileData;
      const { email, fullName, id: userId } = userProfileData.data;
      const userObj: UserData = {
        email,
        fullName,
        id: userId || user.value.data?.id || "",
        accessToken: token ?? "",
      };

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
    const response = await useFetch<AuthResponse>(REGISTER_USER_ENDPOINT, {
      method: FETCH_METHOD.post,
      data: {
        fullName: name,
        email,
        password,
      },
    });

    if (response?.data && isSuccessStatus(response.status)) {
      const { accessToken: newToken } = response.data;
      await fetchUserProfile(newToken);
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
    const response = await useFetch<AuthResponse>(AUTH_USER_ENDPOINT, {
      method: FETCH_METHOD.post,
      data: {
        email,
        password,
      },
    });

    if (response?.data && isSuccessStatus(response.status)) {
      const { accessToken: newToken } = response.data;
      await fetchUserProfile(newToken);
    } else {
      throw new Error("Не удалось войти");
    }
  }

  async function fetchUser(): Promise<void> {
    if (user.value.isAuthLoaded || isFetchingUser.value) {
      if (userDataRaw.value && !state.value.user.data) {
        const userObj: UserData = {
          ...userDataRaw.value,
          accessToken: accessToken.value || userDataRaw.value.accessToken || "",
        };
        state.value.user.data = userObj;
        state.value.user.loggedIn = !!userDataRaw.value;
      } else {
        state.value.user.data = userDataRaw.value;
        state.value.user.loggedIn = !!userDataRaw.value;
      }

      return;
    }

    state.value.isFetchingUser = true;

    try {
      const { data, status } = await useFetch<UserProfileResponse>(
        AUTH_ME_ENDPOINT,
      );

      if (isSuccessStatus(status)) {
        const userObj: UserData = {
          email: data.email,
          fullName: data.fullName || data.fullname || data.name || "",
          id: data.id,
          accessToken: accessToken.value || "",
        };
        userDataRaw.value = userObj;
        state.value.user.data = userObj;
        state.value.user.loggedIn = true;
      } else {
        userDataRaw.value = null;
        state.value.user.data = null;
        state.value.user.loggedIn = false;
      }
    } catch {
      userDataRaw.value = null;
      state.value.user.data = null;
      state.value.user.loggedIn = false;
      throw new Error("Не удалось получить данные пользователя");
    } finally {
      state.value.user.isAuthLoaded = true;
      state.value.isFetchingUser = false;
    }
  }

  async function fetchUserProfile(newToken: string): Promise<void> {
    if (!newToken) {
      return;
    }

    accessToken.value = newToken;

    const fetchedUser = await useFetch<UserProfileResponse>(AUTH_ME_ENDPOINT);

    if (fetchedUser?.data && isSuccessStatus(fetchedUser.status)) {
      setUserProfile(fetchedUser.data, newToken);
    } else {
      accessToken.value = null;
      throw new Error("Не удалось получить профиль");
    }
  }

  function setUserProfile(userProfile: UserProfileResponse, newToken: string) {
    if (!userProfile) {
      return;
    }

    const { email, fullName, id } = userProfile;
    const userObj: UserData = {
      email,
      fullName,
      id,
      accessToken: newToken,
    };

    userDataRaw.value = userObj;
    state.value.user.data = userObj;
    state.value.user.loggedIn = true;
  }

  function clearAuthState(): void {
    userDataRaw.value = null;
    accessToken.value = null;
    state.value.user.data = null;
    state.value.user.loggedIn = false;
    useUserMoviesStore().resetSession();
  }

  function logOut(): void {
    clearAuthState();
  }

  function applyAccessToken(newToken: string): void {
    accessToken.value = newToken;

    if (userDataRaw.value) {
      const next: UserData = {
        ...userDataRaw.value,
        accessToken: newToken,
      };
      userDataRaw.value = next;
      state.value.user.data = next;
      state.value.user.loggedIn = true;
    }
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

    updateDisplayName,
    register,
    logIn,
    logOut,
    fetchUser,
    applyAccessToken,
  };
});
