import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { io, Socket } from "socket.io-client";
import { useFetch, FETCH_METHOD, useAuthToken } from "@/composable";
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
  const isMessagesError = ref(false);
  const isMessagesLoading = ref(false);
  let sessionRevision = 0;

  const userStatusStore = useUserStatusStore();
  const accessToken = useAuthToken();

  watch(accessToken, (next, previous) => {
    if (!next) {
      disconnect();

      return;
    }

    if (next && next !== previous && socket.value) {
      socket.value.disconnect().connect();
    }
  });

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

  // Локально обновить беседу входящим сообщением (без полного refetch на каждое).
  // Возвращает false, если собеседник новый — тогда вызывающий подтянет список.
  const patchConversationFromMessage = (
    message: Message,
    me: string,
  ): boolean => {
    const peerId =
      message.senderId === me ? message.receiverId : message.senderId;

    const existing = conversations.value.find(
      (c) => c.otherUser.id === peerId,
    );

    if (!existing) {
      return false;
    }

    existing.lastMessage = message;

    // входящее и не в открытом чате → +1 непрочитанное
    const inbound = message.senderId === peerId;
    if (inbound && currentChatUserId.value !== peerId) {
      existing.unreadCount += 1;
    }

    // поднять беседу наверх (последняя активность)
    const idx = conversations.value.indexOf(existing);
    if (idx > 0) {
      conversations.value.splice(idx, 1);
      conversations.value.unshift(existing);
    }

    return true;
  };

  const connect = (userId: string) => {
    if (!accessToken.value || !userId.trim()) return;
    // Любой существующий сокет (в т.ч. переподключающийся) не пересоздаём —
    // иначе старый осиротеет с автопереподключением и слушателями
    if (socket.value) {
      return;
    }

    currentUserId.value = userId;

    // За одним доменом сокет ходит на тот же origin (VITE_SOCKET_URL=""),
    // путь /socket.io проксирует nginx. В деве — прямой адрес бэкенда.
    const backendUrl =
      import.meta.env.VITE_SOCKET_URL ??
      import.meta.env.VITE_API_URL ??
      "http://localhost:3005";

    socket.value = io(`${backendUrl}/chat`, {
      auth: (callback) => callback({ token: accessToken.value }),
    });

    socket.value.on("connect", () => {
      isConnected.value = true;
      console.log("WebSocket connected");
      if (currentChatUserId.value) {
        markAsRead(currentChatUserId.value);
      }
    });

    socket.value.on("disconnect", (reason) => {
      isConnected.value = false;
      console.log("WebSocket disconnected");
      if (reason === "io server disconnect" && currentUserId.value) {
        const connection = socket.value;
        const requestRevision = sessionRevision;
        void useFetch("/auth/@me").then(() => {
          if (requestRevision === sessionRevision && socket.value === connection) connection?.connect();
        }).catch(() => {
          if (requestRevision === sessionRevision) isError.value = "Сессия чата истекла. Войдите снова.";
        });
      }
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

      const thread = messages.value.get(peerId)!;
      if (!thread.some((item) => item.id === message.id)) thread.push(message);

      // Патчим беседу локально; полный refetch — только для нового собеседника
      const patched = patchConversationFromMessage(message, me);
      if (!patched) {
        await fetchConversations(userId);
      }

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
    sessionRevision++;
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
      isConnected.value = false;
      currentUserId.value = null;
      userStatusStore.clearStatuses();
    }

    // Чистим чат-состояние, чтобы не текло между сессиями (logout)
    conversations.value = [];
    messages.value = new Map();
    currentChatUserId.value = null;
    currentUserId.value = null;
    isLoading.value = false;
    isMessagesLoading.value = false;
    isMessagesError.value = false;
    isError.value = null;
  };

  const fetchConversations = async (userId: string) => {
    const requestRevision = sessionRevision;
    isLoading.value = true;
    isError.value = null;

    try {
      const response = await useFetch<Conversation[]>(
        `/users/${userId}/messages/conversations`,
        { method: FETCH_METHOD.get },
      );
      if (requestRevision !== sessionRevision) return;

      if (isSuccessStatus(response.status)) {
        conversations.value = response.data;
      } else {
        isError.value = "Failed to load conversations";
      }
    } catch (error) {
      if (requestRevision !== sessionRevision) return;
      isError.value =
        error instanceof Error ? error.message : "Failed to load conversations";
    } finally {
      if (requestRevision === sessionRevision) isLoading.value = false;
    }
  };

  const fetchMessages = async (
    userId: string,
    otherUserId: string,
    limit = 50,
  ) => {
    const requestRevision = sessionRevision;
    isMessagesError.value = false;
    isMessagesLoading.value = true;

    try {
      const response = await useFetch<Message[]>(
        `/users/${userId}/messages/${otherUserId}?limit=${limit}`,
        { method: FETCH_METHOD.get },
      );
      if (requestRevision !== sessionRevision) return;

      if (isSuccessStatus(response.status)) {
        messages.value.set(otherUserId, response.data);

        return response.data;
      }

      isMessagesError.value = true;
    } catch (error) {
      if (requestRevision !== sessionRevision) return;
      console.error("Failed to load messages:", error);
      isMessagesError.value = true;
    } finally {
      if (requestRevision === sessionRevision) isMessagesLoading.value = false;
    }
  };

  const sendMessage = async (receiverId: string, content: string): Promise<Message> => {
    if (!socket.value?.connected) {
      throw new Error("WebSocket not connected");
    }

    if (!currentUserId.value) {
      throw new Error("User not authenticated");
    }

    const connection = socket.value;
    const me = currentUserId.value;
    const saved = await new Promise<Message>((resolve, reject) => {
      connection.timeout(10000).emit("message:send", { receiverId, content }, (error: Error | null, result: Message | undefined) => {
        if (error || !result?.id) reject(new Error("Не удалось подтвердить отправку. Проверьте соединение и историю чата."));
        else resolve(result);
      });
    });
    if (socket.value !== connection || currentUserId.value !== me) throw new Error("Сессия чата завершена");

    if (!messages.value.has(receiverId)) {
      messages.value.set(receiverId, []);
    }

    const thread = messages.value.get(receiverId)!;
    if (!thread.some((item) => item.id === saved.id)) thread.push(saved);
    if (!patchConversationFromMessage(saved, me)) void fetchConversations(me);

    return saved;
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
    isMessagesError,
    isMessagesLoading,
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
