<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRoute } from "vue-router";
import { useChatStore, useUserStatusStore } from "@/stores";
import { useMainStore } from "@/state/state";
import {
  Input,
  Button,
  List,
  ListItem,
  Empty,
  Badge,
  Avatar,
} from "ant-design-vue";
import { SendOutlined } from "@ant-design/icons-vue";

const route = useRoute();
const chatStore = useChatStore();
const userStatusStore = useUserStatusStore();
const mainStore = useMainStore();

const userId = computed(() => mainStore.userData?.id || "");
const messageInput = ref("");
const messagesContainer = ref<HTMLElement | null>(null);

const selectedConversation = computed(() => {
  if (!chatStore.currentChatUserId) return null;
  return chatStore.conversations.find(
    (c) => c.otherUser.id === chatStore.currentChatUserId,
  );
});

const isOtherUserOnline = computed(() => {
  if (!chatStore.currentChatUserId) return false;
  return userStatusStore.isUserOnline(chatStore.currentChatUserId);
});

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const selectConversation = async (otherUserId: string) => {
  await chatStore.openChat(userId.value, otherUserId);
  scrollToBottom();
};

const sendMessage = () => {
  if (!messageInput.value.trim() || !chatStore.currentChatUserId) return;

  chatStore.sendMessage(chatStore.currentChatUserId, messageInput.value.trim());
  messageInput.value = "";
  scrollToBottom();
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  }
};

watch(
  () => chatStore.currentMessages,
  () => {
    scrollToBottom();
  },
  { deep: true },
);

onMounted(async () => {
  if (!userId.value) return;

  chatStore.connect(userId.value);
  await chatStore.fetchConversations(userId.value);

  const paramPeerId = route.params.userId as string | undefined;

  if (paramPeerId) {
    await selectConversation(paramPeerId);
    return;
  }

  const rememberedPeer = chatStore.currentChatUserId;
  if (rememberedPeer) {
    const stillPresent = chatStore.conversations.some(
      (c) => c.otherUser.id === rememberedPeer,
    );
    if (stillPresent) {
      await selectConversation(rememberedPeer);
      return;
    }
    chatStore.closeChat();
  }

  if (chatStore.conversations.length === 1) {
    await selectConversation(chatStore.conversations[0].otherUser.id);
  }
});

onUnmounted(() => {
  chatStore.disconnect();
});
</script>

<template>
  <div class="chat-page">
    <div class="chat-page__sidebar">
      <div class="chat-page__sidebar-header">
        <h2 class="chat-page__title">Сообщения</h2>
        <Badge :count="chatStore.totalUnreadCount" :overflow-count="99" />
      </div>

      <div v-if="chatStore.isLoading" class="chat-page__loading">
        <div class="loader"></div>
      </div>

      <List
        v-else-if="chatStore.conversations.length > 0"
        :data-source="chatStore.conversations"
        :row-key="(item: { otherUser: { id: string } }) => item.otherUser.id"
        class="chat-page__conversations"
      >
        <template #renderItem="{ item }">
          <ListItem class="conversation-list-item">
            <div
              class="conversation-item"
              :class="{
                'conversation-item--active':
                  chatStore.currentChatUserId === item.otherUser.id,
              }"
              role="button"
              tabindex="0"
              @click="selectConversation(item.otherUser.id)"
            >
              <div class="conversation-item__avatar">
                <Badge
                  :dot="userStatusStore.isUserOnline(item.otherUser.id)"
                  color="green"
                >
                  <Avatar :size="48">
                    {{ (item.otherUser.fullName || "?")[0].toUpperCase() }}
                  </Avatar>
                </Badge>
              </div>
              <div class="conversation-item__content">
                <div class="conversation-item__header">
                  <span class="conversation-item__username">{{
                    item.otherUser.fullName
                  }}</span>
                  <span class="conversation-item__time">{{
                    formatTime(item.lastMessage.createdAt)
                  }}</span>
                </div>
                <div class="conversation-item__message">
                  <span
                    :class="{
                      'conversation-item__message--unread':
                        item.unreadCount > 0,
                    }"
                  >
                    {{ item.lastMessage.content }}
                  </span>
                  <Badge
                    v-if="item.unreadCount > 0"
                    :count="item.unreadCount"
                  />
                </div>
              </div>
            </div>
          </ListItem>
        </template>
      </List>

      <Empty v-else description="Нет диалогов" />
    </div>

    <div class="chat-page__main">
      <div v-if="!chatStore.currentChatUserId" class="chat-page__empty">
        <Empty description="Выберите диалог" />
      </div>

      <template v-else>
        <div class="chat-page__header">
          <div class="chat-page__header-user">
            <Badge :dot="isOtherUserOnline" color="green">
              <Avatar :size="40">
                {{ selectedConversation?.otherUser.fullName[0].toUpperCase() }}
              </Avatar>
            </Badge>
            <div class="chat-page__header-info">
              <span class="chat-page__header-username">
                {{ selectedConversation?.otherUser.fullName }}
              </span>
              <span class="chat-page__header-status">
                {{ isOtherUserOnline ? "онлайн" : "не в сети" }}
              </span>
            </div>
          </div>
        </div>

        <div ref="messagesContainer" class="chat-page__messages">
          <div
            v-for="message in chatStore.currentMessages"
            :key="message.id"
            class="message"
            :class="{
              'message--sent': message.senderId === userId,
              'message--received': message.senderId !== userId,
            }"
          >
            <div class="message__bubble">
              <p class="message__content">{{ message.content }}</p>
              <span class="message__time">
                {{ formatTime(message.createdAt) }}
                <span
                  v-if="message.senderId === userId && message.isRead"
                  class="message__read"
                  >✓✓</span
                >
              </span>
            </div>
          </div>
        </div>

        <div class="chat-page__input">
          <Input
            v-model:value="messageInput"
            placeholder="Введите сообщение..."
            size="large"
            @press-enter="sendMessage"
          />
          <Button
            type="primary"
            size="large"
            :disabled="!messageInput.trim()"
            @click="sendMessage"
          >
            <SendOutlined />
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.chat-page {
  display: grid;
  grid-template-columns: 360px 1fr;
  height: calc(100vh - 80px);
  gap: 1rem;
  padding: 1rem;

  &__sidebar {
    background: var(--bg-primary);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  &__title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  &__conversations {
    flex: 1;
    overflow-y: auto;
    min-width: 0;

    :deep(.ant-list) {
      width: 100%;
    }

    :deep(.ant-spin-nested-loading),
    :deep(.ant-spin-container) {
      width: 100%;
    }

    :deep(.ant-list-items) {
      width: 100%;
    }

    :deep(.ant-list-item) {
      display: block;
      width: 100%;
      max-width: 100%;
      padding: 0;
    }
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
  }

  &__main {
    background: var(--bg-primary);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  &__header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  &__header-user {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  &__header-info {
    display: flex;
    flex-direction: column;
  }

  &__header-username {
    font-weight: 600;
    font-size: 1.125rem;
  }

  &__header-status {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  &__messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__input {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    gap: 0.75rem;
  }
}

.conversation-list-item {
  width: 100%;
  max-width: 100%;
  padding: 0 !important;
  border-block-end: 1px solid var(--border-color);
}

.conversation-item {
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-secondary);
  }

  &--active {
    background: color-mix(
      in srgb,
      var(--ant-color-primary) 8%,
      var(--bg-secondary)
    );
    box-shadow: inset 3px 0 0 0 var(--ant-color-primary);
  }

  &__avatar {
    margin-right: 1rem;
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  &__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    min-width: 0;
  }

  &__username {
    min-width: 0;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  &__message {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &--unread {
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.message {
  display: flex;
  max-width: 70%;

  &--sent {
    align-self: flex-end;

    .message__bubble {
      background: var(--ant-color-primary);
      color: white;
    }
  }

  &--received {
    align-self: flex-start;

    .message__bubble {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
  }

  &__bubble {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    word-wrap: break-word;
  }

  &__content {
    margin: 0 0 0.25rem 0;
  }

  &__time {
    font-size: 0.75rem;
    opacity: 0.7;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__read {
    color: var(--ant-color-success);
  }
}

.loader {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color);
  border-top-color: var(--ant-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
