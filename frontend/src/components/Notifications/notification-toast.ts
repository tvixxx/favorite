import { notification } from "ant-design-vue";
import { h } from "vue";
import type { NotificationDto } from "@/stores/notifications/types";

export function showNotificationToast(item: NotificationDto): void {
  if (document.visibilityState === "hidden") return;

  const sender = String(
    item.payload.senderName ??
      item.payload.requesterName ??
      item.payload.friendName ??
      "пользователя"
  );
  const title =
    item.type === "CHAT_MESSAGE"
      ? "Новое сообщение от " + sender
      : item.type === "SYSTEM"
      ? "Новость Favorite"
      : "Новое событие от " + sender;
  const text = String(
    item.type === "SYSTEM"
      ? item.payload.title ?? ""
      : item.payload.preview ??
          "Откройте уведомления, чтобы узнать подробности."
  );

  notification.open({
    key: "notification:" + item.id,
    style: {
      background: "var(--fv-color-bg-inverted)",
      color: "var(--fv-color-text-inverted)",
      borderRadius: "12px",
    },
    message: h(
      "span",
      { style: { color: "var(--fv-color-text-inverted)" } },
      title
    ),
    description: h(
      "span",
      {
        style: {
          color: "var(--fv-color-text-inverted)",
          overflowWrap: "anywhere",
        },
      },
      text.slice(0, 160)
    ),
    closeIcon: h(
      "span",
      { style: { color: "var(--fv-color-text-inverted)" } },
      "×"
    ),
    duration: 4,
    placement: "topRight",
  });
}
