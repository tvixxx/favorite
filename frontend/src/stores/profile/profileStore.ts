import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useMainStore } from "@/state/state";
import api from "@/services/api";
import { PROFILE_ENDPOINT } from "@/constants/api/profile-endpoints";
import { isSuccessStatus } from "@/utils";
import { PROFILE_STORE_NAME } from "@/stores/profile/constants";
import type { ProfileData } from "@/stores/profile/types";

export const useProfileStore = defineStore(PROFILE_STORE_NAME, () => {
  const mainStore = useMainStore();

  const profile = ref<ProfileData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isProfileLoaded = computed(() => !!profile.value);
  const profileName = computed(() => profile.value?.fullName || "Unknown User");
  const isLoggedIn = computed(() => mainStore.isLoggedIn);

  const setLoading = (value: boolean) => {
    isLoading.value = value;
  };

  const setError = (errorText: string | null) => {
    error.value = errorText;
  };

  const setProfile = (data: ProfileData) => {
    profile.value = data;
  };

  const fetchProfile = async (): Promise<void> => {
    if (!isLoggedIn.value) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(PROFILE_ENDPOINT);

      if (response?.data && isSuccessStatus(response.status)) {
        // Map backend user object to frontend profile object
        const userData = response.data;
        const profileData: ProfileData = {
          id: userData.id, // Convert string ID to number
          fullName:
            userData.fullName || userData.fullname || userData.name || "",
          email: userData.email || "",
          avatar: userData.avatar || userData.image || undefined,
        };
        setProfile(profileData);
      } else {
        throw new Error("Failed to fetch profile");
      }
    } catch (err) {
      console.error("Fetch profile error:", err);
      setError("Unable to load profile");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (
    updates: Partial<ProfileData>
  ): Promise<void> => {
    if (!isLoggedIn.value) {
      setError("User not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestData: Record<string, any> = {};

      if (updates.fullName) requestData.fullName = updates.fullName;
      if (updates.email) requestData.email = updates.email;
      if (updates.avatar) requestData.avatar = updates.avatar;

      const response = await api.put(PROFILE_ENDPOINT, requestData);

      if (response?.data && isSuccessStatus(response.status)) {
        const userData = response.data;
        const updatedProfileData: ProfileData = {
          id: userData.id || profile.value!.id, // Keep original ID if not returned
          fullName:
            userData.fullName ||
            userData.fullname ||
            userData.name ||
            updates.fullName ||
            profile.value!.fullName,
          email: userData.email || updates.email || profile.value!.email,
          avatar:
            userData.avatar ||
            userData.image ||
            updates.avatar ||
            profile.value!.avatar,
        };
        setProfile(updatedProfileData);
      } else {
        throw new Error("Failed to update profile");
      }
    } catch (err) {
      console.error("Update profile error:", err);
      setError("Unable to update profile");
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    isLoading,
    error,
    isProfileLoaded,
    profileName,

    fetchProfile,
    updateProfile,
  };
});
