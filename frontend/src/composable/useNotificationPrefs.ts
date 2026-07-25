import { useStorage, type RemovableRef } from "@vueuse/core";
import type { NotificationType } from "@/stores/notifications/types";

/**
 * Локальные (без бэкенда) настройки уведомлений. Единый источник ключей —
 * их читают и UI-тумблеры (ProfilePage), и гейт входящих уведомлений (store).
 */
export const NOTIFY_KEYS = {
  newMessages: "fv-notify-new-messages",
  friendRequests: "fv-notify-friend-requests",
  recommendations: "fv-notify-recommendations",
} as const;

const NOTIFY_DEFAULTS = {
  newMessages: true,
  friendRequests: true,
  recommendations: false,
} as const;

export interface NotificationPrefs {
  newMessages: RemovableRef<boolean>;
  friendRequests: RemovableRef<boolean>;
  recommendations: RemovableRef<boolean>;
}

/** Реактивные тумблеры для UI (persist в localStorage). */
export function useNotificationPrefs(): NotificationPrefs {
  return {
    newMessages: useStorage(NOTIFY_KEYS.newMessages, NOTIFY_DEFAULTS.newMessages),
    friendRequests: useStorage(
      NOTIFY_KEYS.friendRequests,
      NOTIFY_DEFAULTS.friendRequests,
    ),
    recommendations: useStorage(
      NOTIFY_KEYS.recommendations,
      NOTIFY_DEFAULTS.recommendations,
    ),
  };
}

// Точечное чтение localStorage без создания реактивных подписок
// (вызывается на каждое входящее уведомление). useStorage сериализует
// boolean как "true"/"false".
function readPref(key: string, fallback: boolean): boolean {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  const raw = localStorage.getItem(key);

  return raw === null ? fallback : raw === "true";
}

/**
 * Показывать ли уведомление данного типа (клиентский гейт по локальным настройкам).
 * CHAT_MESSAGE → «Новые сообщения»; FRIEND_REQUEST/FRIEND_ACCEPTED → «Запросы в друзья».
 */
export function isNotificationTypeEnabled(type: NotificationType): boolean {
  switch (type) {
    case "CHAT_MESSAGE":
      return readPref(NOTIFY_KEYS.newMessages, NOTIFY_DEFAULTS.newMessages);
    case "FRIEND_REQUEST":
    case "FRIEND_ACCEPTED":
      return readPref(
        NOTIFY_KEYS.friendRequests,
        NOTIFY_DEFAULTS.friendRequests,
      );
    default:
      return true;
  }
}
