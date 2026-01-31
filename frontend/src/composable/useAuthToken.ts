import { computed } from "vue";
import { useMainStore } from "@/state/state";
import { CURRENT_USER_TOKEN } from "@/constants";

export function useAuthToken() {
  const store = useMainStore();

  return computed(() => {
    const lsToken = localStorage.getItem(CURRENT_USER_TOKEN);

    return store.accessToken || lsToken || store.userData?.accessToken || null;
  });
}
