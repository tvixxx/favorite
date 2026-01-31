import { defineStore } from "pinia";
import { computed, ref } from "vue";
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
import type { ReqType, State, UserData } from "@/state/types";
import {
  showErrorRequest,
  showFetchRequestError,
  showInfoLogoutMessage,
  showLoginRequestError,
  showRegistrationRequestError,
  showSuccessLoginText,
  showSuccessUpdateUserName,
  showUpdateUserNameError,
} from "@/state/utils";
import { DEFAULT_MAIN_STATE, MAIN_STORE_NAME } from "@/state/constants";

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

    try {
      const userProfileData = await useFetch(`${USERS_ENDPOINTS}/${id}`, {
        method: FETCH_METHOD.patch,
        data: {
          fullName: displayName,
        },
      });

      if (userProfileData?.data && isSuccessStatus(userProfileData.status)) {
        const { token } = userProfileData;
        const { email, fullName, id: userId } = userProfileData.data;
        const userObj: UserData = {
          email,
          fullName,
          id: userId || user.value.data?.id,
          accessToken: token ?? "",
        };

        userDataRaw.value = userObj;
        state.value.user.data = userObj;

        showSuccessUpdateUserName();
      } else {
        showUpdateUserNameError();
      }
    } catch (error: any) {
      showErrorRequest(error);
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
    try {
      const response = await useFetch(REGISTER_USER_ENDPOINT, {
        method: FETCH_METHOD.post,
        data: {
          fullName: name,
          email,
          password,
        },
      });

      if (response?.data && isSuccessStatus(response.status)) {
        const { accessToken: newToken } = response.data;

        await fetchUserProfile(newToken, "register");
      } else {
        showRegistrationRequestError();
      }
    } catch (error: any) {
      showErrorRequest(error);
    }
  }

  async function logIn({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<void> {
    try {
      const response = await useFetch(AUTH_USER_ENDPOINT, {
        method: FETCH_METHOD.post,
        data: {
          email,
          password,
        },
      });

      if (response?.data && isSuccessStatus(response.status)) {
        const { accessToken: newToken } = response.data;

        await fetchUserProfile(newToken, "login");
      } else {
        showLoginRequestError();
      }
    } catch (error: any) {
      // todo: add error type for axios error
      showErrorRequest(error);
    }
  }

  function logOut(): void {
    userDataRaw.value = null;
    accessToken.value = null;
    state.value.user.data = null;
    state.value.user.loggedIn = false;

    showInfoLogoutMessage();
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
      const { data, status } = await useFetch(AUTH_ME_ENDPOINT);

      if (isSuccessStatus(status)) {
        const userObj: UserData = {
          email: data.email,
          fullName: data.fullName || data.fullname || data.name || "",
          id: data.id,
          accessToken: accessToken.value || "", // Use existing token from storage
        };
        userDataRaw.value = userObj;
        state.value.user.data = userObj;
        state.value.user.loggedIn = true;
      } else {
        userDataRaw.value = null;
        state.value.user.data = null;
        state.value.user.loggedIn = false;
      }
    } catch (error) {
      showFetchRequestError();
      userDataRaw.value = null;
      state.value.user.data = null;
      state.value.user.loggedIn = false;
    } finally {
      state.value.user.isAuthLoaded = true;
      state.value.isFetchingUser = false;
    }
  }

  async function fetchUserProfile(newToken: string, reqType: ReqType) {
    if (!newToken) {
      return;
    }

    try {
      accessToken.value = newToken;

      const fetchedUser = await useFetch(AUTH_ME_ENDPOINT);

      if (fetchedUser?.data && isSuccessStatus(fetchedUser.status)) {
        setUserProfile(fetchedUser.data, newToken, reqType);
      } else {
        showFetchRequestError();
      }
    } catch (error) {
      accessToken.value = null;

      switch (reqType) {
        case "login":
          showLoginRequestError();
          break;
        case "register":
          showRegistrationRequestError();
          break;
      }
    }
  }

  function setUserProfile(
    userProfile: UserData,
    newToken: string,
    reqType: ReqType
  ) {
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

    if (reqType === "login") {
      showSuccessLoginText(fullName);
    }

    userDataRaw.value = userObj;
    state.value.user.data = userObj;
    state.value.user.loggedIn = true;
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
  };
});
