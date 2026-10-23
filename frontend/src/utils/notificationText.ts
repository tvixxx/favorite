import type { NotificationDto } from "@/stores/notifications/types";

export function notificationText(item: NotificationDto): string {
  const payload = item.payload;

  switch (item.type) {
    case "SYSTEM":
      return String(payload.title ?? "Новость Favorite");
    case "CHAT_MESSAGE": {
      const name = String(payload.senderName ?? "Сообщение");
      const preview = String(payload.preview ?? "").trim();

      return preview ? `${name}: ${preview}` : name;
    }

    case "FRIEND_REQUEST":
      return `${
        payload.requesterName ?? "Пользователь"
      } хочет добавить вас в друзья`;
    case "FRIEND_ACCEPTED":
      return `${payload.friendName ?? "Пользователь"} принял(а) вашу заявку`;
    case "FRIEND_REJECTED":
      return `${
        payload.friendName ?? "Пользователь"
      } отклонил(а) вашу заявку в друзья`;
    default:
      return "Уведомление";
  }
}

export function notificationTarget(item: NotificationDto): string {
  if (item.type === "SYSTEM") return "/notifications?section=system";
  if (item.type === "CHAT_MESSAGE") {
    const id = item.payload.senderId;

    return typeof id === "string" && id
      ? `/chat/${encodeURIComponent(id)}`
      : "/chat";
  }

  return item.type === "FRIEND_REQUEST" ? "/friends?tab=requests" : "/friends";
}
