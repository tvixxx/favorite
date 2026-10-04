import { computed } from "vue";
import { useMainStore } from "@/state/state";

export function useAuthToken() {
  const store = useMainStore();

  return computed(() => store.accessToken);
}
