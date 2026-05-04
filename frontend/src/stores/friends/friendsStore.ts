import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useFetch, FETCH_METHOD } from '@/composable';
import { isSuccessStatus } from '@/utils';

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
}

export enum FriendshipType {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  type: FriendshipType;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    username: string;
    email: string;
  };
  addressee: {
    id: string;
    username: string;
    email: string;
  };
}

export interface FriendshipStats {
  friendsCount: number;
  subscribersCount: number;
  subscriptionsCount: number;
  pendingRequestsCount: number;
}

export interface RemoveFriendshipResponse {
  message: string;
}

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref<Friendship[]>([]);
  const subscribers = ref<Friendship[]>([]);
  const subscriptions = ref<Friendship[]>([]);
  const requests = ref<Friendship[]>([]);
  const stats = ref<FriendshipStats | null>(null);
  const isLoading = ref(false);
  const isError = ref<string | null>(null);

  const fetchFriends = async (userId: string) => {
    isLoading.value = true;
    isError.value = null;

    try {
      const response = await useFetch<Friendship[]>(
        `/users/${userId}/friends`,
        { method: FETCH_METHOD.get }
      );

      if (isSuccessStatus(response.status)) {
        friends.value = response.data;
      } else {
        isError.value = 'Failed to load friends';
      }
    } catch (error: unknown) {
      isError.value =
        error instanceof Error ? error.message : 'Failed to load friends';
    } finally {
      isLoading.value = false;
    }
  };

  const fetchSubscribers = async (userId: string) => {
    try {
      const response = await useFetch<Friendship[]>(
        `/users/${userId}/friends/subscribers`,
        { method: FETCH_METHOD.get }
      );

      if (isSuccessStatus(response.status)) {
        subscribers.value = response.data;
      }
    } catch (error: unknown) {
      console.error('Failed to load subscribers:', error);
    }
  };

  const fetchSubscriptions = async (userId: string) => {
    try {
      const response = await useFetch<Friendship[]>(
        `/users/${userId}/friends/subscriptions`,
        { method: FETCH_METHOD.get }
      );

      if (isSuccessStatus(response.status)) {
        subscriptions.value = response.data;
      }
    } catch (error: unknown) {
      console.error('Failed to load subscriptions:', error);
    }
  };

  const fetchRequests = async (userId: string) => {
    try {
      const response = await useFetch<Friendship[]>(
        `/users/${userId}/friends/requests`,
        { method: FETCH_METHOD.get }
      );

      if (isSuccessStatus(response.status)) {
        requests.value = response.data;
      }
    } catch (error: unknown) {
      console.error('Failed to load requests:', error);
    }
  };

  const fetchStats = async (userId: string) => {
    try {
      const response = await useFetch<FriendshipStats>(
        `/users/${userId}/friends/stats`,
        { method: FETCH_METHOD.get }
      );

      if (isSuccessStatus(response.status)) {
        stats.value = response.data;
      }
    } catch (error: unknown) {
      console.error('Failed to load stats:', error);
    }
  };

  const sendRequest = async (userId: string, addresseeId: string, type: FriendshipType) => {
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/request`,
        {
          method: FETCH_METHOD.post,
          data: { addresseeId, type }
        }
      );

      if (isSuccessStatus(response.status)) {
        if (type === FriendshipType.FRIEND_REQUEST) {
          // Добавить в исходящие запросы (не показываем в UI, но можно отслеживать)
        } else {
          // Подписка сразу добавляется в subscriptions
          await fetchSubscriptions(userId);
        }

        await fetchStats(userId);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to send request';
      throw new Error(message, { cause: error });
    }
  };

  const acceptRequest = async (userId: string, friendshipId: string) => {
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/${friendshipId}/accept`,
        { method: FETCH_METHOD.patch }
      );

      if (isSuccessStatus(response.status)) {
        await fetchFriends(userId);
        await fetchRequests(userId);
        await fetchStats(userId);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to accept request';
      throw new Error(message, { cause: error });
    }
  };

  const rejectRequest = async (userId: string, friendshipId: string) => {
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/${friendshipId}/reject`,
        { method: FETCH_METHOD.patch }
      );

      if (isSuccessStatus(response.status)) {
        await fetchRequests(userId);
        await fetchStats(userId);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to reject request';
      throw new Error(message, { cause: error });
    }
  };

  const removeFriendship = async (userId: string, friendshipId: string) => {
    try {
      const response = await useFetch<RemoveFriendshipResponse>(
        `/users/${userId}/friends/${friendshipId}`,
        { method: FETCH_METHOD.delete }
      );

      if (isSuccessStatus(response.status)) {
        await fetchFriends(userId);
        await fetchSubscriptions(userId);
        await fetchStats(userId);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove friendship';
      throw new Error(message, { cause: error });
    }
  };

  const pendingRequestsCount = computed(() => requests.value.length);

  return {
    friends,
    subscribers,
    subscriptions,
    requests,
    stats,
    isLoading,
    isError,
    pendingRequestsCount,
    fetchFriends,
    fetchSubscribers,
    fetchSubscriptions,
    fetchRequests,
    fetchStats,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriendship,
  };
});
