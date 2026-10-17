import { computed, type ComputedRef } from "vue";
import { useMainStore } from "@/state/state";
import { getUserPreference } from "@/utils/userPreferences";
import type { NotificationType } from "@/stores/notifications/types";

export interface NotificationPrefs {
  newMessages: ComputedRef<boolean>;
  friendRequests: ComputedRef<boolean>;
  recommendations: ComputedRef<boolean>;
}

export function useNotificationPrefs(): NotificationPrefs {
  const store = useMainStore();

  return {
    newMessages: computed(() => getUserPreference(store.userData, "notifyNewMessages")),
    friendRequests: computed(() => getUserPreference(store.userData, "notifyFriendRequests")),
    recommendations: computed(() => getUserPreference(store.userData, "notifyRecommendations")),
  };
}

export function isNotificationTypeEnabled(type: NotificationType): boolean {
  const user = useMainStore().userData;
  switch (type) {
    case "CHAT_MESSAGE":
      return getUserPreference(user, "notifyNewMessages");
    case "FRIEND_REQUEST":
    case "FRIEND_ACCEPTED":
      return getUserPreference(user, "notifyFriendRequests");
    default:
      return true;
  }
}
