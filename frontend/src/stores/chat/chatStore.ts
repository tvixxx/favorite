import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { io, Socket } from "socket.io-client";
import { useFetch, FETCH_METHOD } from "@/composable";
import { isSuccessStatus } from "@/utils";
import { useUserStatusStore } from "../userStatus/userStatusStore";
import { useNotificationsStore } from "../notifications/notificationsStore";
import type { NotificationDto } from "../notifications/types";

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    email: string;
  };
  receiver?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface Conversation {
  otherUser: {
    id: string;
    email: string;
    fullName?: string;
    username?: string;
  };
  lastMessage: Message;
  unreadCount: number;
}

export const useChatStore = defineStore("chat", () => {
  const socket = ref<Socket | null>(null);
  const conversations = ref<Conversation[]>([]);
  const messages = ref<Map<string, Message[]>>(new Map());
  const currentChatUserId = ref<string | null>(null);
  const currentUserId = ref<string | null>(null);
  const isConnected = ref(false);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

  const userStatusStore = useUserStatusStore();

  const markAsRead = (otherUserId: string) => {
    const me = currentUserId.value;
    if (!me) {
      return;
    }

    const conversation = conversations.value.find(
      (c) => c.otherUser.id === otherUserId,
    );
    if (conversation) {
      conversation.unreadCount = 0;
    }

    const thread = messages.value.get(otherUserId);
    if (thread) {
      thread.forEach((msg) => {
        if (msg.senderId === otherUserId && msg.receiverId === me) {
          msg.isRead = true;
        }
      });
    }

    if (socket.value?.connected) {
      socket.value.emit("message:read", { otherUserId });
    }
  };

  const connect = (userId: string) => {
    if (socket.value?.connected) {
      return;
    }

    currentUserId.value = userId;

    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

    socket.value = io(`${backendUrl}/chat`, {
      auth: { userId },
      query: { userId },
    });

    socket.value.on("connect", () => {
      isConnected.value = true;
      console.log("WebSocket connected");
      if (currentChatUserId.value) {
        markAsRead(currentChatUserId.value);
      }
    });

    socket.value.on("disconnect", () => {
      isConnected.value = false;
      console.log("WebSocket disconnected");
    });

    socket.value.on("message:received", async (message: Message) => {
      const me = userId;
      const peerId =
        message.senderId === me ? message.receiverId : message.senderId;

      if (!peerId || peerId === me) {
        return;
      }

      if (!messages.value.has(peerId)) {
        messages.value.set(peerId, []);
      }

      messages.value.get(peerId)?.push(message);

      await fetchConversations(userId);

      const openPeer = currentChatUserId.value;

      if (openPeer) {
        markAsRead(openPeer);
      }
    });

    socket.value.on(
      "messages:read",
      ({ userId: readByUserId }: { userId: string }) => {
        const userMessages = messages.value.get(readByUserId);

        if (userMessages) {
          userMessages.forEach((msg) => {
            if (msg.senderId === userId) {
              msg.isRead = true;
            }
          });
        }
      },
    );

    socket.value.on(
      "user:online",
      ({ userId: onlineUserId }: { userId: string }) => {
        userStatusStore.setUserOnline(onlineUserId, "");
      },
    );

    socket.value.on(
      "user:offline",
      ({ userId: offlineUserId }: { userId: string }) => {
        userStatusStore.setUserOffline(offlineUserId);
      },
    );

    socket.value.on("notification:new", (dto: NotificationDto) => {
      const notificationsStore = useNotificationsStore();

      notificationsStore.applyIncoming(dto);
    });
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
      isConnected.value = false;
      currentUserId.value = null;
      userStatusStore.clearStatuses();
    }
  };

  const fetchConversations = async (userId: string) => {
    isLoading.value = true;
    isError.value = null;

    try {
      const response = await useFetch<Conversation[]>(
        `/users/${userId}/messages/conversations`,
        { method: FETCH_METHOD.get },
      );

      if (isSuccessStatus(response.status)) {
        conversations.value = response.data;
      } else {
        isError.value = "Failed to load conversations";
      }
    } catch (error: any) {
      isError.value = error.message;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchMessages = async (
    userId: string,
    otherUserId: string,
    limit = 50,
  ) => {
    try {
      const response = await useFetch<Message[]>(
        `/users/${userId}/messages/${otherUserId}?limit=${limit}`,
        { method: FETCH_METHOD.get },
      );

      if (isSuccessStatus(response.status)) {
        messages.value.set(otherUserId, response.data);

        return response.data;
      }
    } catch (error: any) {
      console.error("Failed to load messages:", error);
    }
  };

  const sendMessage = (receiverId: string, content: string) => {
    if (!socket.value?.connected) {
      throw new Error("WebSocket not connected");
    }

    if (!currentUserId.value) {
      throw new Error("User not authenticated");
    }

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId.value,
      receiverId,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    if (!messages.value.has(receiverId)) {
      messages.value.set(receiverId, []);
    }

    messages.value.get(receiverId)?.push(optimisticMessage);

    socket.value.emit("message:send", { receiverId, content });
  };

  const openChat = async (userId: string, otherUserId: string) => {
    currentChatUserId.value = otherUserId;
    await fetchMessages(userId, otherUserId);
    markAsRead(otherUserId);
  };

  const closeChat = () => {
    currentChatUserId.value = null;
  };

  const totalUnreadCount = computed(() => {
    return conversations.value.reduce((sum, conv) => sum + conv.unreadCount, 0);
  });

  const currentMessages = computed(() => {
    if (!currentChatUserId.value) {
      return [];
    }

    return messages.value.get(currentChatUserId.value) || [];
  });

  return {
    socket,
    conversations,
    messages,
    currentChatUserId,
    currentUserId,
    isConnected,
    isLoading,
    isError,
    totalUnreadCount,
    currentMessages,
    connect,
    disconnect,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
    openChat,
    closeChat,
  };
});
