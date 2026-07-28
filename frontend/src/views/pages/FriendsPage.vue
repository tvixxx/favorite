<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useFriendsStore, useUserStatusStore, useChatStore } from '@/stores';
import { useMainStore } from '@/state/state';
import { FriendshipType } from '@/stores/friends/friendsStore';
import { useRouter } from 'vue-router';
import SocialHubTabs from '@/components/SocialHubTabs/SocialHubTabs.vue';
import BaseModal from '@/components/BaseModal/BaseModal.vue';
import BaseIcon from '@/components/BaseIcon/BaseIcon.vue';
import BaseRadio from '@/components/BaseRadio/BaseRadio.vue';
import StateBlock from '@/components/StateBlock/StateBlock.vue';
import { STATE_PRESETS } from '@/components/StateBlock/stateBlockPresets';
import SkeletonBar from '@/components/Skeleton/SkeletonBar.vue';
import { useMinLoading } from '@/components/Skeleton/useMinLoading';
import { useFetch, FETCH_METHOD } from '@/composable';
import { isSuccessStatus } from '@/utils';
import { friendlyRequestError } from '@/utils/friendlyError';
import { avatarGradient, avatarLetter } from '@/composable/useAvatarGradient';
import { Button, Input, message } from 'ant-design-vue';

const router = useRouter();
const friendsStore = useFriendsStore();

type FriendsTab = "friends" | "requests" | "subscribers" | "subscriptions";

const activeTab = ref<FriendsTab>("friends");

const tabs = computed<{ key: FriendsTab; label: string; count: number }[]>(() => [
  {
    key: "friends",
    label: "Друзья",
    count: friendsStore.stats?.friendsCount ?? 0,
  },
  {
    key: "requests",
    label: "Запросы",
    count: friendsStore.pendingRequestsCount,
  },
  {
    key: "subscribers",
    label: "Подписчики",
    count: friendsStore.stats?.subscribersCount ?? 0,
  },
  {
    key: "subscriptions",
    label: "Подписки",
    count: friendsStore.stats?.subscriptionsCount ?? 0,
  },
]);
const chatStore = useChatStore();
const userStatusStore = useUserStatusStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || '');
const searchQuery = ref('');
const isAddModalVisible = ref(false);
const isLoading = ref(false);
const newFriendEmail = ref('');
const requestType = ref<FriendshipType>(FriendshipType.FRIEND_REQUEST);
const submitError = ref<string | null>(null);

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
  submitError.value = null;
};

const closeAddModal = () => {
  isAddModalVisible.value = false;
  submitError.value = null;
};

// «Повторить» из состояния ошибки — возвращаемся к форме (email сохранён)
const dismissSubmitError = () => {
  submitError.value = null;
};

const sendFriendRequest = async () => {
  if (!newFriendEmail.value.trim()) {
    return;
  }

  submitError.value = null;
  isLoading.value = true;

  try {
    // Найти пользователя по email
    const searchResponse = await useFetch<{ id: string; email: string; fullName: string }>(
      `/users/search?email=${encodeURIComponent(newFriendEmail.value.trim())}`,
      { method: FETCH_METHOD.get }
    );

    if (!isSuccessStatus(searchResponse.status)) {
      submitError.value =
        'Пользователь с таким email не найден. Проверьте адрес и попробуйте снова.';

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
  } catch (error) {
    submitError.value = friendlyRequestError(error, {
      byStatus: {
        404: 'Пользователь с таким email не найден. Проверьте адрес и попробуйте снова.',
        409: 'Вы уже отправили запрос этому пользователю или уже добавили его.',
      },
      fallback: 'Не удалось отправить запрос. Попробуйте ещё раз.',
    });
  } finally {
    isLoading.value = false;
  }
};

const acceptRequest = async (friendshipId: string) => {
  try {
    await friendsStore.acceptRequest(userId.value, friendshipId);
    message.success('Запрос принят');
  } catch (error) {
    message.error(
      friendlyRequestError(error, { fallback: 'Не удалось принять запрос' })
    );
  }
};

const rejectRequest = async (friendshipId: string) => {
  try {
    await friendsStore.rejectRequest(userId.value, friendshipId);
    message.success('Запрос отклонён');
  } catch (error) {
    message.error(
      friendlyRequestError(error, { fallback: 'Не удалось отклонить запрос' })
    );
  }
};

const removeFriend = async (friendshipId: string) => {
  try {
    await friendsStore.removeFriendship(userId.value, friendshipId);
    message.success('Удалено');
  } catch (error) {
    message.error(
      friendlyRequestError(error, { fallback: 'Не удалось удалить' })
    );
  }
};

const openChat = (otherUserId: string) => {
  router.push(`/chat/${otherUserId}`);
};

const isUserOnline = (otherUserId: string) => {
  return userStatusStore.isUserOnline(otherUserId);
};

const loadAll = async () => {
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
};

// Скелетон с минимальной длительностью — чтобы не мигал на быстрых ответах
const showSkeleton = useMinLoading(() => friendsStore.isLoading);

onMounted(loadAll);
</script>

<template>
  <div class="friends-page">
    <SocialHubTabs :unread-count="chatStore.totalUnreadCount" />

    <!-- Hero (эталон: карточка — текст слева, поиск + «Добавить» справа) -->
    <div class="friends-page__hero-card">
      <div class="friends-page__hero-text">
        <p class="friends-page__eyebrow">Сообщество</p>
        <h1 class="friends-page__title">Друзья</h1>
        <p class="friends-page__subtitle">
          Управляйте друзьями, запросами и подписками
        </p>
      </div>
      <div class="friends-page__hero-aside">
        <Input
          v-model:value="searchQuery"
          class="friends-page__hero-search"
          placeholder="Найти пользователя"
        >
          <template #prefix>
            <BaseIcon name="ph:magnifying-glass" :width="18" :height="18" />
          </template>
        </Input>
        <Button
          type="primary"
          size="large"
          class="friends-page__add-btn"
          data-tour="friends-add-btn"
          @click="openAddModal"
        >
          <BaseIcon name="ph:user-plus" :width="18" :height="18" />
          Добавить
        </Button>
      </div>
    </div>

    <StateBlock
      v-if="friendsStore.isError"
      class="friends-page__state"
      variant="error"
      icon="ph:wifi-slash"
      title="Не удалось загрузить"
      description="Проверьте соединение и попробуйте ещё раз."
      :actions="[
        {
          label: 'Повторить',
          icon: 'ph:arrow-clockwise',
          kind: 'primary',
          onClick: loadAll,
        },
      ]"
    />

    <div v-else-if="showSkeleton" class="friends-page__tabs">
      <div class="user-grid">
        <div v-for="n in 6" :key="n" class="user-card user-card--skel">
          <SkeletonBar width="52px" height="52px" circle />
          <div class="user-card__info">
            <SkeletonBar height="14px" width="60%" radius="6px" />
            <SkeletonBar height="11px" width="40%" radius="6px" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="friends-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="friends-tabs__btn"
          :class="{ 'friends-tabs__btn--active': activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span class="friends-tabs__count">{{ tab.count }}</span>
        </button>
      </div>

      <div v-if="activeTab === 'friends'" class="friends-panel">
        <div v-if="filteredFriends.length > 0" class="user-grid">
          <div
            v-for="item in filteredFriends"
            :key="item.friendshipId"
            class="user-card"
          >
            <div
              class="user-card__avatar"
              :style="{ background: avatarGradient(item.friend.id) }"
            >
              {{ avatarLetter(item.friend.fullName) }}
              <span
                v-if="isUserOnline(item.friend.id)"
                class="user-card__dot"
                aria-hidden="true"
              />
            </div>
            <div class="user-card__info">
              <span class="user-card__name">{{ item.friend.fullName }}</span>
              <span class="user-card__meta">{{ item.friend.email }}</span>
            </div>
            <div class="user-card__actions">
              <button
                type="button"
                class="icon-btn"
                title="Написать"
                @click="openChat(item.friend.id)"
              >
                <BaseIcon name="ph:chat-circle" :width="19" :height="19" />
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Удалить из друзей"
                @click="removeFriend(item.friendshipId)"
              >
                <BaseIcon name="ph:user-minus" :width="18" :height="18" />
              </button>
            </div>
          </div>
        </div>

        <StateBlock
          v-else-if="searchQuery"
          variant="empty"
          icon="ph:magnifying-glass"
          title="Никого не нашли"
          description="Проверьте написание имени или e-mail."
        />

        <StateBlock
          v-else
          v-bind="STATE_PRESETS.friendsEmpty"
          :actions="[
            {
              label: 'Найти друзей',
              icon: 'ph:user-plus',
              kind: 'primary',
              onClick: openAddModal,
            },
          ]"
        />
      </div>

      <div v-else-if="activeTab === 'requests'" class="friends-panel">
        <div v-if="friendsStore.requests.length > 0" class="user-grid">
          <div
            v-for="item in friendsStore.requests"
            :key="item.id"
            class="user-card"
          >
            <div
              class="user-card__avatar"
              :style="{ background: avatarGradient(item.requester.id) }"
            >
              {{ avatarLetter(item.requester.fullName) }}
            </div>
            <div class="user-card__info">
              <span class="user-card__name">{{ item.requester.fullName }}</span>
              <span class="user-card__meta">Хочет добавить вас в друзья</span>
            </div>
            <div class="user-card__actions">
              <button
                type="button"
                class="icon-btn icon-btn--positive"
                title="Принять"
                @click="acceptRequest(item.id)"
              >
                <BaseIcon name="ph:check" :width="19" :height="19" />
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Отклонить"
                @click="rejectRequest(item.id)"
              >
                <BaseIcon name="ph:x" :width="17" :height="17" />
              </button>
            </div>
          </div>
        </div>

        <StateBlock v-else v-bind="STATE_PRESETS.friendsRequestsEmpty" />
      </div>

      <div v-else-if="activeTab === 'subscribers'" class="friends-panel">
        <div v-if="friendsStore.subscribers.length > 0" class="user-grid">
          <div
            v-for="item in friendsStore.subscribers"
            :key="item.friendshipId"
            class="user-card"
          >
            <div
              class="user-card__avatar"
              :style="{ background: avatarGradient(item.subscriber.id) }"
            >
              {{ avatarLetter(item.subscriber.fullName) }}
              <span
                v-if="isUserOnline(item.subscriber.id)"
                class="user-card__dot"
                aria-hidden="true"
              />
            </div>
            <div class="user-card__info">
              <span class="user-card__name">{{ item.subscriber.fullName }}</span>
              <span class="user-card__meta">{{ item.subscriber.email }}</span>
            </div>
            <div class="user-card__actions">
              <button
                type="button"
                class="icon-btn"
                title="Написать"
                @click="openChat(item.subscriber.id)"
              >
                <BaseIcon name="ph:chat-circle" :width="19" :height="19" />
              </button>
            </div>
          </div>
        </div>

        <StateBlock
          v-else
          variant="empty"
          icon="ph:users-three"
          title="Нет подписчиков"
          description="Здесь появятся пользователи, которые на вас подписались."
        />
      </div>

      <div v-else class="friends-panel">
        <div v-if="friendsStore.subscriptions.length > 0" class="user-grid">
          <div
            v-for="item in friendsStore.subscriptions"
            :key="item.friendshipId"
            class="user-card"
          >
            <div
              class="user-card__avatar"
              :style="{ background: avatarGradient(item.subscribedTo.id) }"
            >
              {{ avatarLetter(item.subscribedTo.fullName) }}
              <span
                v-if="isUserOnline(item.subscribedTo.id)"
                class="user-card__dot"
                aria-hidden="true"
              />
            </div>
            <div class="user-card__info">
              <span class="user-card__name">{{ item.subscribedTo.fullName }}</span>
              <span class="user-card__meta">{{ item.subscribedTo.email }}</span>
            </div>
            <div class="user-card__actions">
              <button
                type="button"
                class="icon-btn"
                title="Написать"
                @click="openChat(item.subscribedTo.id)"
              >
                <BaseIcon name="ph:chat-circle" :width="19" :height="19" />
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Отписаться"
                @click="removeFriend(item.friendshipId)"
              >
                <BaseIcon name="ph:user-minus" :width="18" :height="18" />
              </button>
            </div>
          </div>
        </div>

        <StateBlock
          v-else
          variant="empty"
          icon="ph:user-check"
          title="Нет подписок"
          description="Подпишитесь на других — их обновления появятся здесь."
        />
      </div>
    </template>

    <BaseModal v-model="isAddModalVisible">
      <template #title>Добавить пользователя</template>

      <template #body>
      <StateBlock
        v-if="submitError"
        compact
        variant="error"
        icon="ph:warning-circle"
        title="Не удалось отправить"
        :description="submitError"
      />
      <div v-else class="add-modal">
        <div class="add-modal__field">
          <span class="add-modal__label">Email пользователя</span>
          <Input
            v-model:value="newFriendEmail"
            placeholder="name@mail.ru"
            size="large"
          />
        </div>

        <span class="add-friend__label">Тип запроса</span>
        <BaseRadio
          :model-value="requestType"
          :options="[
            {
              value: FriendshipType.FRIEND_REQUEST,
              label: 'Запрос в друзья',
              hint: '— требует подтверждения',
            },
            {
              value: FriendshipType.SUBSCRIPTION,
              label: 'Подписаться',
              hint: '— без подтверждения',
            },
          ]"
          @update:model-value="requestType = $event as FriendshipType"
        />
      </div>
      </template>

      <template #footer>
        <a-button class="add-friend__cancel" @click="closeAddModal">
          Отмена
        </a-button>
        <a-button
          v-if="submitError"
          type="primary"
          html-type="button"
          @click="dismissSubmitError"
        >
          Повторить
        </a-button>
        <a-button
          v-else
          type="primary"
          html-type="button"
          :loading="isLoading"
          :disabled="!newFriendEmail.trim()"
          @click="sendFriendRequest"
        >
          Отправить
        </a-button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/scrollbar" as *;

/* Модалка «Добавить пользователя»: лейбл группы и кнопки 1:2 (эталон) */
.add-friend__label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--fv-color-text-secondary);
}

:deep(.modal__footer) .ant-btn {
  flex: 2;
}

:deep(.modal__footer) .add-friend__cancel {
  flex: 1;
}

.friends-page {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;

  // Hero-карточка эталона: текст слева (flex:1), поиск + «Добавить» справа
  &__hero-card {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
    padding: 1.75rem 2rem;
    margin-bottom: 1.5rem;
    background: var(--fv-color-bg-primary);
    border: 1px solid var(--fv-color-border);
    border-radius: var(--fv-radius-lg);
    box-shadow: var(--fv-shadow-low);
  }

  &__hero-text {
    flex: 1 1 260px;
    min-width: 0;
  }

  &__eyebrow {
    margin: 0 0 8px;
    font-family: var(--fv-font-display);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fv-color-text-tertiary);
  }

  &__title {
    margin: 0;
    font-family: var(--fv-font-display);
    font-size: clamp(1.6rem, 3.5vw, 2.2rem);
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--fv-color-text-primary);
  }

  &__subtitle {
    margin: 8px 0 0;
    font-size: clamp(0.95rem, 2vw, 1.05rem);
    color: var(--fv-color-text-secondary);
  }

  &__hero-aside {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;

    @media (max-width: 640px) {
      width: 100%;
    }
  }

  &__hero-search {
    width: 260px;
    max-width: 100%;

    @media (max-width: 640px) {
      flex: 1;
      width: auto;
    }

    // здесь только размеры и иконка-префикс
    :deep(.ant-input-affix-wrapper) {
      height: 44px;
      padding: 0 16px;
    }

    :deep(.ant-input-prefix) {
      margin-inline-end: 10px;
      font-size: 18px;
      color: var(--fv-color-text-tertiary);
    }

    :deep(.ant-input) {
      font-size: 0.95rem;
    }
  }

  &__add-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;

    @media (max-width: 640px) {
      flex-shrink: 0;
    }
  }

  &__tabs {
    background: var(--fv-color-bg-primary);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid var(--fv-color-border);
  }

  // Скелетон табов держит ту же обёртку, что и раньше
  &__panel-gap {
    margin-top: 22px;
  }
}

/* Табы друзей: голый ряд с подчёркиванием активного (эталон), не карточка */
.friends-tabs {
  display: flex;
  gap: 22px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--fv-color-border);
  overflow-x: auto;

  @include hideScrollbar();

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    height: 44px;
    padding: 0 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    font: inherit;
    font-size: 15px;
    color: var(--fv-color-text-secondary);
    cursor: pointer;
    transition: color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      color: var(--fv-color-text-primary);
    }

    &--active {
      color: var(--fv-color-text-primary);
      font-weight: 500;
      border-bottom-color: var(--fv-color-brand);
    }
  }

  &__count {
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-secondary);
    font-size: 12px;
    font-weight: 500;
  }
}

// Ошибка загрузки на уровне страницы — на той же поверхности, что и карточки
.friends-page__state {
  background: var(--fv-color-bg-primary);
  border: 1px solid var(--fv-color-border);
  border-radius: 16px;
}

// Скелетон карточки пользователя (та же раскладка, что и .user-card)
.user-card--skel {
  pointer-events: none;

  .user-card__info {
    gap: 8px;
  }
}

// Грид карточек пользователей (эталон: auto-fill minmax(300px,1fr))
.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: var(--fv-color-bg-primary);
  border-radius: var(--fv-radius-lg);
  box-shadow: var(--fv-shadow-low);

  &__avatar {
    position: relative;
    flex-shrink: 0;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 500;
    font-size: 20px;
  }

  &__dot {
    position: absolute;
    right: 1px;
    bottom: 1px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--fv-color-positive);
    border: 2px solid var(--fv-color-bg-secondary);
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: 0.8rem;
    color: var(--fv-color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
}

// Круглая иконка-кнопка (эталон btng)
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--fv-color-bg-secondary);
  color: var(--fv-color-text-secondary);
  cursor: pointer;
  transition:
    background var(--fv-motion-fast) var(--fv-ease),
    color var(--fv-motion-fast) var(--fv-ease);

  &:hover {
    background: color-mix(
      in srgb,
      var(--fv-color-text-primary) 8%,
      var(--fv-color-bg-primary)
    );
    color: var(--fv-color-text-primary);
  }

  &--positive {
    background: var(--fv-color-positive-soft);
    color: var(--fv-color-positive);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-positive) 22%,
        transparent
      );
      color: var(--fv-color-positive);
    }
  }
}

.add-modal {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;

  &__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fv-color-text-secondary);
  }
}
</style>
