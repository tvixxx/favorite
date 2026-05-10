export type NotificationType =
  | "CHAT_MESSAGE"
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED";

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface ChatMessagePayload {
  messageId?: string;
  senderId?: string;
  senderName?: string;
  preview?: string;
}

export interface FriendRequestPayload {
  friendshipId?: string;
  requesterId?: string;
  requesterName?: string;
}

export interface FriendAcceptedPayload {
  friendshipId?: string;
  friendId?: string;
  friendName?: string;
}
