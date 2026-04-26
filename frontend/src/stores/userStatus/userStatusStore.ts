import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface UserStatus {
  userId: string;
  isOnline: boolean;
  socketId: string | null;
  lastSeenAt: string;
}

export const useUserStatusStore = defineStore('userStatus', () => {
  const onlineUsers = ref<Map<string, UserStatus>>(new Map());

  const setUserOnline = (userId: string, socketId: string) => {
    onlineUsers.value.set(userId, {
      userId,
      isOnline: true,
      socketId,
      lastSeenAt: new Date().toISOString(),
    });
  };

  const setUserOffline = (userId: string) => {
    const user = onlineUsers.value.get(userId);
    if (user) {
      onlineUsers.value.set(userId, {
        ...user,
        isOnline: false,
        socketId: null,
        lastSeenAt: new Date().toISOString(),
      });
    }
  };

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.value.get(userId)?.isOnline ?? false;
  };

  const getUserStatus = (userId: string): UserStatus | undefined => {
    return onlineUsers.value.get(userId);
  };

  const clearStatuses = () => {
    onlineUsers.value.clear();
  };

  return {
    onlineUsers,
    setUserOnline,
    setUserOffline,
    isUserOnline,
    getUserStatus,
    clearStatuses,
  };
});
