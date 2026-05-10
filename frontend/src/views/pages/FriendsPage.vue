<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useFriendsStore, useUserStatusStore } from '@/stores';
import { useMainStore } from '@/state/state';
import { FriendshipType } from '@/stores/friends/friendsStore';
import { useRouter } from 'vue-router';
import AppBackButton from '@/components/AppBackButton/AppBackButton.vue';
import { useFetch, FETCH_METHOD } from '@/composable';
import { isSuccessStatus } from '@/utils';
import {
  Tabs,
  TabPane,
  List,
  ListItem,
  Button,
  Input,
  Empty,
  Avatar,
  Badge,
  Modal,
  message,
} from 'ant-design-vue';
import {
  UserAddOutlined,
  MessageOutlined,
  UserDeleteOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue';

const router = useRouter();
const friendsStore = useFriendsStore();
const userStatusStore = useUserStatusStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || '');
const searchQuery = ref('');
const isAddModalVisible = ref(false);
const isLoading = ref(false);
const newFriendEmail = ref('');
const requestType = ref<FriendshipType>(FriendshipType.FRIEND_REQUEST);

const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friendsStore.friends;
  }

  const query = searchQuery.value.toLowerCase();

  return friendsStore.friends.filter(f =>
    f.friend.fullName.toLowerCase().includes(query) ||
    f.friend.email.toLowerCase().includes(query)
  );
});

const openAddModal = () => {
  isAddModalVisible.value = true;
  newFriendEmail.value = '';
  requestType.value = FriendshipType.FRIEND_REQUEST;
};

const closeAddModal = () => {
  isAddModalVisible.value = false;
};

const sendFriendRequest = async () => {
  if (!newFriendEmail.value.trim()) {
    message.error('Введите email пользователя');

    return;
  }

  isLoading.value = true;

  try {
    // Найти пользователя по email
    const searchResponse = await useFetch<{ id: string; email: string; fullName: string }>(
      `/users/search?email=${encodeURIComponent(newFriendEmail.value.trim())}`,
      { method: FETCH_METHOD.get }
    );

    if (!isSuccessStatus(searchResponse.status)) {
      message.error('Пользователь с таким email не найден');

      return;
    }

    const addresseeId = searchResponse.data.id;

    await friendsStore.sendRequest(userId.value, addresseeId, requestType.value);

    message.success(
      requestType.value === FriendshipType.FRIEND_REQUEST
        ? 'Запрос в друзья отправлен'
        : 'Вы подписались на пользователя'
    );

    closeAddModal();
  } catch (error: any) {
    message.error(error.message || 'Ошибка при отправке запроса');
  } finally {
    isLoading.value = false;
  }
};

const acceptRequest = async (friendshipId: string) => {
  try {
    await friendsStore.acceptRequest(userId.value, friendshipId);
    message.success('Запрос принят');
  } catch (error: any) {
    message.error(error.message || 'Ошибка при принятии запроса');
  }
};

const rejectRequest = async (friendshipId: string) => {
  try {
    await friendsStore.rejectRequest(userId.value, friendshipId);
    message.success('Запрос отклонён');
  } catch (error: any) {
    message.error(error.message || 'Ошибка при отклонении запроса');
  }
};

const removeFriend = async (friendshipId: string) => {
  try {
    await friendsStore.removeFriendship(userId.value, friendshipId);
    message.success('Удалено');
  } catch (error: any) {
    message.error(error.message || 'Ошибка при удалении');
  }
};

const openChat = (otherUserId: string) => {
  router.push(`/chat/${otherUserId}`);
};

const isUserOnline = (otherUserId: string) => {
  return userStatusStore.isUserOnline(otherUserId);
};

onMounted(async () => {
  if (!userId.value) {
    return;
  }

  await Promise.all([
    friendsStore.fetchFriends(userId.value),
    friendsStore.fetchSubscribers(userId.value),
    friendsStore.fetchSubscriptions(userId.value),
    friendsStore.fetchRequests(userId.value),
    friendsStore.fetchStats(userId.value),
  ]);
});
</script>

<template>
  <div class="friends-page">
    <div class="friends-page__header">
      <AppBackButton
        class="friends-page__back"
        :fallback="{ path: '/profile' }"
      />
      <div class="friends-page__header-main">
        <h1 class="friends-page__title">Друзья и подписки</h1>
        <Button
          type="primary"
          size="large"
          data-tour="friends-add-btn"
          @click="openAddModal"
        >
          <UserAddOutlined />
          Добавить
        </Button>
      </div>
    </div>

    <div class="friends-page__stats" v-if="friendsStore.stats">
      <div class="stat-card">
        <span class="stat-card__value">{{ friendsStore.stats.friendsCount }}</span>
        <span class="stat-card__label">Друзей</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__value">{{ friendsStore.stats.subscribersCount }}</span>
        <span class="stat-card__label">Подписчиков</span>
      </div>
      <div class="stat-card">
        <span class="stat-card__value">{{ friendsStore.stats.subscriptionsCount }}</span>
        <span class="stat-card__label">Подписок</span>
      </div>
      <div class="stat-card stat-card--highlight">
        <span class="stat-card__value">{{ friendsStore.stats.pendingRequestsCount }}</span>
        <span class="stat-card__label">Запросов</span>
      </div>
    </div>

    <Tabs default-active-key="friends" class="friends-page__tabs">
      <TabPane key="friends" tab="Друзья">
        <Input
          v-model:value="searchQuery"
          placeholder="Поиск друзей..."
          size="large"
          class="friends-page__search"
        />

        <List
          v-if="filteredFriends.length > 0"
          :data-source="filteredFriends"
          class="friends-list"
        >
          <template #renderItem="{ item }">
            <ListItem class="friend-item">
              <div class="friend-item__info">
                <Badge :dot="isUserOnline(item.friend.id)" color="green">
                  <Avatar :size="48">
                    {{ item.friend.fullName[0].toUpperCase() }}
                  </Avatar>
                </Badge>
                <div class="friend-item__details">
                  <span class="friend-item__username">{{ item.friend.fullName }}</span>
                  <span class="friend-item__email">{{ item.friend.email }}</span>
                </div>
              </div>
              <div class="friend-item__actions">
                <Button type="primary" @click="openChat(item.friend.id)">
                  <MessageOutlined />
                  Написать
                </Button>
                <Button danger @click="removeFriend(item.friendshipId)">
                  <UserDeleteOutlined />
                </Button>
              </div>
            </ListItem>
          </template>
        </List>

        <div v-else class="friends-page__empty-block">
          <Empty>
            <template #description>
              <span class="friends-page__empty-text">
                Пока никого нет в списке друзей. Добавьте человека по email —
                сможете переписываться в чате и делиться контекстом коллекции.
              </span>
            </template>
          </Empty>

          <Button
            type="primary"
            size="large"
            class="friends-page__empty-cta"
            @click="openAddModal"
          >
            <UserAddOutlined />
            Добавить по email
          </Button>
        </div>
      </TabPane>

      <TabPane key="requests" :tab="`Запросы (${friendsStore.pendingRequestsCount})`">
        <List
          v-if="friendsStore.requests.length > 0"
          :data-source="friendsStore.requests"
          class="friends-list"
        >
          <template #renderItem="{ item }">
            <ListItem class="friend-item">
              <div class="friend-item__info">
                <Avatar :size="48">
                  {{ item.requester.fullName[0].toUpperCase() }}
                </Avatar>
                <div class="friend-item__details">
                  <span class="friend-item__username">{{ item.requester.fullName }}</span>
                  <span class="friend-item__email">{{ item.requester.email }}</span>
                </div>
              </div>
              <div class="friend-item__actions">
                <Button type="primary" @click="acceptRequest(item.id)">
                  <CheckOutlined />
                  Принять
                </Button>
                <Button danger @click="rejectRequest(item.id)">
                  <CloseOutlined />
                  Отклонить
                </Button>
              </div>
            </ListItem>
          </template>
        </List>

        <Empty v-else description="Нет входящих запросов" />
      </TabPane>

      <TabPane key="subscribers" tab="Подписчики">
        <List
          v-if="friendsStore.subscribers.length > 0"
          :data-source="friendsStore.subscribers"
          class="friends-list"
        >
          <template #renderItem="{ item }">
            <ListItem class="friend-item">
              <div class="friend-item__info">
                <Badge :dot="isUserOnline(item.subscriber.id)" color="green">
                  <Avatar :size="48">
                    {{ item.subscriber.fullName[0].toUpperCase() }}
                  </Avatar>
                </Badge>
                <div class="friend-item__details">
                  <span class="friend-item__username">{{ item.subscriber.fullName }}</span>
                  <span class="friend-item__email">{{ item.subscriber.email }}</span>
                </div>
              </div>
              <div class="friend-item__actions">
                <Button type="primary" @click="openChat(item.subscriber.id)">
                  <MessageOutlined />
                </Button>
              </div>
            </ListItem>
          </template>
        </List>

        <Empty v-else description="Нет подписчиков" />
      </TabPane>

      <TabPane key="subscriptions" tab="Подписки">
        <List
          v-if="friendsStore.subscriptions.length > 0"
          :data-source="friendsStore.subscriptions"
          class="friends-list"
        >
          <template #renderItem="{ item }">
            <ListItem class="friend-item">
              <div class="friend-item__info">
                <Badge :dot="isUserOnline(item.subscribedTo.id)" color="green">
                  <Avatar :size="48">
                    {{ item.subscribedTo.fullName[0].toUpperCase() }}
                  </Avatar>
                </Badge>
                <div class="friend-item__details">
                  <span class="friend-item__username">{{ item.subscribedTo.fullName }}</span>
                  <span class="friend-item__email">{{ item.subscribedTo.email }}</span>
                </div>
              </div>
              <div class="friend-item__actions">
                <Button type="primary" @click="openChat(item.subscribedTo.id)">
                  <MessageOutlined />
                </Button>
                <Button danger @click="removeFriend(item.friendshipId)">
                  Отписаться
                </Button>
              </div>
            </ListItem>
          </template>
        </List>

        <Empty v-else description="Нет подписок" />
      </TabPane>
    </Tabs>

    <Modal
      v-model:open="isAddModalVisible"
      title="Добавить пользователя"
      :confirm-loading="isLoading"
      @ok="sendFriendRequest"
      @cancel="closeAddModal"
      :ok-button-props="{ htmlType: 'button' }"
    >
      <div class="add-modal">
        <Input
          v-model:value="newFriendEmail"
          placeholder="Email пользователя"
          size="large"
        />

        <div class="add-modal__type">
          <label>
            <input
              type="radio"
              :value="FriendshipType.FRIEND_REQUEST"
              v-model="requestType"
            />
            Запрос в друзья (требует подтверждения)
          </label>
          <label>
            <input
              type="radio"
              :value="FriendshipType.SUBSCRIPTION"
              v-model="requestType"
            />
            Подписаться (без подтверждения)
          </label>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.friends-page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;

  &__header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  &__back {
    :deep(.app-back-btn) {
      margin: 0;
    }
  }

  &__header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  &__title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  &__search {
    margin-bottom: 1rem;
  }

  &__tabs {
    background: var(--bg-primary);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
  }

  &__empty-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 2rem 1rem;
    text-align: center;
  }

  &__empty-text {
    display: block;
    max-width: 28rem;
    margin: 0 auto;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  &__empty-cta {
    align-self: center;
  }
}

.stat-card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  &--highlight {
    border-color: var(--ant-color-primary);
  }

  &__value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ant-color-primary);
  }

  &__label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
}

.friends-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.friend-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  border: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;

  &__info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__details {
    display: flex;
    flex-direction: column;
  }

  &__username {
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  &__email {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
  }
}

.add-modal {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem 0;

  &__type {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      padding: 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      transition: all 0.2s;

      &:hover {
        background: var(--bg-secondary);
      }

      input[type="radio"] {
        cursor: pointer;
      }
    }
  }
}
</style>
