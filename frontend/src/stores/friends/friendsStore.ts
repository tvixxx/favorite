import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useFetch, FETCH_METHOD } from '@/composable';
import { isSuccessStatus } from '@/utils';
import { createRequestGuard } from '@/utils/requestGuard';

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

export interface FriendUser {
  id: string;
  fullName: string;
  email: string;
  username?: string;
}

export interface FriendEntry { friendshipId: string; friend: FriendUser; createdAt: string }
export interface SubscriberEntry { friendshipId: string; subscriber: FriendUser; createdAt: string }
export interface SubscriptionEntry { friendshipId: string; subscribedTo: FriendUser; createdAt: string }

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  type: FriendshipType;
  createdAt: string;
  updatedAt: string;
  requester: FriendUser;
  addressee: FriendUser;
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
  const friends = ref<FriendEntry[]>([]);
  const subscribers = ref<SubscriberEntry[]>([]);
  const subscriptions = ref<SubscriptionEntry[]>([]);
  const requests = ref<Friendship[]>([]);
  const stats = ref<FriendshipStats | null>(null);
  const loading = ref({ friends: false, subscribers: false, subscriptions: false, requests: false, stats: false });
  const isLoading = computed(() => Object.values(loading.value).some(Boolean));
  const isError = ref<string | null>(null);
  const requestsGuard = {
    friends: createRequestGuard(), subscribers: createRequestGuard(), subscriptions: createRequestGuard(),
    requests: createRequestGuard(), stats: createRequestGuard(),
  };
  let sessionRevision = 0;

  const fetchFriends = async (userId: string) => {
    if (!userId.trim()) return;
    const isCurrent = requestsGuard.friends.begin();
    loading.value.friends = true;
    isError.value = null;

    try {
      const response = await useFetch<FriendEntry[]>(
        `/users/${userId}/friends`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        friends.value = response.data;
      } else {
        isError.value = 'Не удалось загрузить друзей';
      }
    } catch {
      if (!isCurrent()) return;
      isError.value = 'Не удалось загрузить друзей';
    } finally {
      if (isCurrent()) loading.value.friends = false;
    }
  };

  const fetchSubscribers = async (userId: string) => {
    if (!userId.trim()) return;
    const isCurrent = requestsGuard.subscribers.begin();
    loading.value.subscribers = true;
    try {
      const response = await useFetch<SubscriberEntry[]>(
        `/users/${userId}/friends/subscribers`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        subscribers.value = response.data;
      }
    } catch {
      if (isCurrent()) isError.value = 'Не удалось загрузить подписчиков';
    } finally {
      if (isCurrent()) loading.value.subscribers = false;
    }
  };

  const fetchSubscriptions = async (userId: string) => {
    if (!userId.trim()) return;
    const isCurrent = requestsGuard.subscriptions.begin();
    loading.value.subscriptions = true;
    try {
      const response = await useFetch<SubscriptionEntry[]>(
        `/users/${userId}/friends/subscriptions`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        subscriptions.value = response.data;
      }
    } catch {
      if (isCurrent()) isError.value = 'Не удалось загрузить подписки';
    } finally {
      if (isCurrent()) loading.value.subscriptions = false;
    }
  };

  const fetchRequests = async (userId: string) => {
    if (!userId.trim()) return;
    const isCurrent = requestsGuard.requests.begin();
    loading.value.requests = true;
    try {
      const response = await useFetch<Friendship[]>(
        `/users/${userId}/friends/requests`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        requests.value = response.data;
      }
    } catch {
      if (isCurrent()) isError.value = 'Не удалось загрузить запросы';
    } finally {
      if (isCurrent()) loading.value.requests = false;
    }
  };

  const fetchStats = async (userId: string) => {
    if (!userId.trim()) return;
    const isCurrent = requestsGuard.stats.begin();
    loading.value.stats = true;
    try {
      const response = await useFetch<FriendshipStats>(
        `/users/${userId}/friends/stats`,
        { method: FETCH_METHOD.get }
      );
      if (!isCurrent()) return;

      if (isSuccessStatus(response.status)) {
        stats.value = response.data;
      }
    } catch {
      if (isCurrent()) isError.value = 'Не удалось загрузить статистику общения';
    } finally {
      if (isCurrent()) loading.value.stats = false;
    }
  };

  const sendRequest = async (userId: string, addresseeId: string, type: FriendshipType) => {
    const requestRevision = sessionRevision;
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/request`,
        {
          method: FETCH_METHOD.post,
          data: { addresseeId, type }
        }
      );
      if (requestRevision !== sessionRevision) throw new Error('Сессия изменилась');

      if (isSuccessStatus(response.status)) {
        if (type === FriendshipType.SUBSCRIPTION) {
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
    const requestRevision = sessionRevision;
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/${friendshipId}/accept`,
        { method: FETCH_METHOD.patch }
      );
      if (requestRevision !== sessionRevision) throw new Error('Сессия изменилась');

      if (isSuccessStatus(response.status)) {
        await Promise.all([
          fetchFriends(userId),
          fetchRequests(userId),
          fetchStats(userId),
        ]);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to accept request';
      throw new Error(message, { cause: error });
    }
  };

  const rejectRequest = async (userId: string, friendshipId: string) => {
    const requestRevision = sessionRevision;
    try {
      const response = await useFetch<Friendship>(
        `/users/${userId}/friends/${friendshipId}/reject`,
        { method: FETCH_METHOD.patch }
      );
      if (requestRevision !== sessionRevision) throw new Error('Сессия изменилась');

      if (isSuccessStatus(response.status)) {
        await Promise.all([fetchRequests(userId), fetchStats(userId)]);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to reject request';
      throw new Error(message, { cause: error });
    }
  };

  const removeFriendship = async (userId: string, friendshipId: string) => {
    const requestRevision = sessionRevision;
    try {
      const response = await useFetch<RemoveFriendshipResponse>(
        `/users/${userId}/friends/${friendshipId}`,
        { method: FETCH_METHOD.delete }
      );
      if (requestRevision !== sessionRevision) throw new Error('Сессия изменилась');

      if (isSuccessStatus(response.status)) {
        await Promise.all([
          fetchFriends(userId),
          fetchSubscriptions(userId),
          fetchSubscribers(userId),
          fetchRequests(userId),
          fetchStats(userId),
        ]);

        return response.data;
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove friendship';
      throw new Error(message, { cause: error });
    }
  };

  const pendingRequestsCount = computed(() => requests.value.length);

  const resetSession = () => {
    sessionRevision++;
    friends.value = [];
    subscribers.value = [];
    subscriptions.value = [];
    requests.value = [];
    stats.value = null;
    isError.value = null;
    for (const key of Object.keys(requestsGuard) as Array<keyof typeof requestsGuard>) {
      requestsGuard[key].invalidate();
      loading.value[key] = false;
    }
  };

  return {
    friends,
    subscribers,
    subscriptions,
    requests,
    stats,
    isLoading,
    loading,
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
    resetSession,
  };
});
