<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useChatStore, useUserStatusStore } from "@/stores";
import { useMainStore } from "@/state/state";
import { Badge } from "ant-design-vue";
import ChatMessageInput from "@/components/ChatMessageInput/ChatMessageInput.vue";
import ChatMessageContent from "@/components/ChatMessageContent/ChatMessageContent.vue";
import SocialHubTabs from "@/components/SocialHubTabs/SocialHubTabs.vue";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import RowsSkeleton from "@/components/Skeleton/RowsSkeleton.vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import { useMinLoading } from "@/components/Skeleton/useMinLoading";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import { STATE_PRESETS } from "@/components/StateBlock/stateBlockPresets";
import { avatarGradient, avatarLetter } from "@/composable/useAvatarGradient";

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const userStatusStore = useUserStatusStore();
const mainStore = useMainStore();

const showConversationsSkeleton = useMinLoading(() => chatStore.isLoading);

const userId = computed(() => mainStore.userData?.id || "");
const messageInput = ref("");

const reloadConversations = (): void => {
  if (userId.value) {
    void chatStore.fetchConversations(userId.value);
  }
};

const reloadMessages = (): void => {
  if (userId.value && chatStore.currentChatUserId) {
    void chatStore.fetchMessages(userId.value, chatStore.currentChatUserId);
  }
};

const chatInputRef = ref<InstanceType<typeof ChatMessageInput> | null>(null);
const messagesContainer = ref<HTMLElement | null>(null);

const selectedConversation = computed(() => {
  if (!chatStore.currentChatUserId) {
    return null;
  }

  return chatStore.conversations.find(
    (c) => c.otherUser.id === chatStore.currentChatUserId,
  );
});

const isOtherUserOnline = computed(() => {
  if (!chatStore.currentChatUserId) {
    return false;
  }

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

// Клаппер: вставляет «#» — открывает подсказку фильмов из коллекции
const attachMovie = () => {
  const current = messageInput.value;
  const needsSpace = current.length > 0 && !/\s$/.test(current);
  messageInput.value = `${current}${needsSpace ? " " : ""}#`;
};

const sendMessage = (wireFromEnter?: string) => {
  const content = (
    wireFromEnter ??
    chatInputRef.value?.composeWire?.() ??
    messageInput.value
  ).trim();

  if (!content || !chatStore.currentChatUserId) {
    return;
  }

  chatStore.sendMessage(chatStore.currentChatUserId, content);
  messageInput.value = "";
  scrollToBottom();
};

const goToFriends = () => {
  router.push("/friends");
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

// Скроллим вниз при новом сообщении — следим за длиной + id последнего,
// а не за глубоким обходом всего треда (deep-watch дёргался и на isRead)
watch(
  () => {
    const msgs = chatStore.currentMessages;

    return `${msgs.length}:${msgs[msgs.length - 1]?.id ?? ""}`;
  },
  () => {
    scrollToBottom();
  },
);

onMounted(async () => {
  if (!userId.value) {
    return;
  }

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

</script>

<template>
  <div class="chat-page-shell">
    <SocialHubTabs :unread-count="chatStore.totalUnreadCount" />

    <div
      class="chat-page"
      :class="{ 'chat-page--conversation': !!chatStore.currentChatUserId }"
    >
      <div class="chat-page__sidebar">
        <div class="chat-page__sidebar-header">
          <h2 class="chat-page__title">Сообщения</h2>
        </div>

      <RowsSkeleton
        v-if="showConversationsSkeleton"
        :count="6"
        :badge="false"
      />

      <StateBlock
        v-else-if="chatStore.isError"
        variant="error"
        icon="ph:warning-circle"
        title="Диалоги не загрузились"
        description="Не удалось получить список диалогов. Попробуйте обновить."
        :actions="[
          {
            label: 'Обновить',
            icon: 'ph:arrow-clockwise',
            kind: 'primary',
            onClick: reloadConversations,
          },
        ]"
      />

      <div
        v-else-if="chatStore.conversations.length > 0"
        class="chat-page__conversations"
      >
        <button
          v-for="item in chatStore.conversations"
          :key="item.otherUser.id"
          type="button"
          class="conversation-item"
          :class="{
            'conversation-item--active':
              chatStore.currentChatUserId === item.otherUser.id,
          }"
          @click="selectConversation(item.otherUser.id)"
        >
          <div class="conversation-item__avatar">
            <Badge
              :dot="userStatusStore.isUserOnline(item.otherUser.id)"
              color="green"
            >
              <span
                class="chat-avatar"
                :style="{ background: avatarGradient(item.otherUser.id) }"
              >
                {{ avatarLetter(item.otherUser.fullName) }}
              </span>
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
                class="conversation-item__preview"
                :class="{
                  'conversation-item__preview--unread': item.unreadCount > 0,
                }"
              >
                {{ item.lastMessage.content }}
              </span>
              <span
                v-if="item.unreadCount > 0"
                class="conversation-item__badge"
                >{{ item.unreadCount }}</span
              >
            </div>
          </div>
        </button>
      </div>

      <StateBlock
        v-else
        v-bind="STATE_PRESETS.chatListEmpty"
        :actions="[
          {
            label: 'К друзьям',
            icon: 'ph:users-three',
            kind: 'primary',
            onClick: goToFriends,
          },
        ]"
      />
    </div>

    <div class="chat-page__main">
      <div v-if="!chatStore.currentChatUserId" class="chat-page__empty">
        <StateBlock
          variant="empty"
          icon="ph:chats-circle"
          title="Выберите диалог"
          description="Откройте переписку слева или начните новую в разделе «Друзья»."
        />
      </div>

      <template v-else>
        <div class="chat-page__header">
          <button
            type="button"
            class="chat-page__header-back"
            aria-label="К списку диалогов"
            @click="chatStore.closeChat()"
          >
            <BaseIcon name="ph:arrow-left" :width="20" :height="20" />
          </button>
          <div class="chat-page__header-user">
            <Badge :dot="isOtherUserOnline" color="green">
              <span
                class="chat-avatar chat-avatar--sm"
                :style="{
                  background: avatarGradient(
                    selectedConversation?.otherUser.id || '',
                  ),
                }"
              >
                {{ avatarLetter(selectedConversation?.otherUser.fullName) }}
              </span>
            </Badge>
            <div class="chat-page__header-info">
              <span class="chat-page__header-username">
                {{ selectedConversation?.otherUser.fullName }}
              </span>
              <span
                class="chat-page__header-status"
                :class="{
                  'chat-page__header-status--online': isOtherUserOnline,
                }"
              >
                {{ isOtherUserOnline ? "в сети" : "не в сети" }}
              </span>
            </div>
          </div>
        </div>

        <div ref="messagesContainer" class="chat-page__messages">
          <StateBlock
            v-if="chatStore.isMessagesError"
            v-bind="STATE_PRESETS.chatThreadError"
            :actions="[
              {
                label: 'Обновить',
                icon: 'ph:arrow-clockwise',
                kind: 'primary',
                onClick: reloadMessages,
              },
            ]"
          />

          <div
            v-else-if="
              chatStore.isMessagesLoading && !chatStore.currentMessages.length
            "
            class="chat-page__msg-skel"
          >
            <div
              v-for="n in 6"
              :key="`msg-skel-${n}`"
              class="msg-skel"
              :class="
                n % 2 === 0 ? 'msg-skel--sent' : 'msg-skel--received'
              "
            >
              <SkeletonBar
                :width="n % 2 === 0 ? '55%' : '45%'"
                height="38px"
                radius="16px"
              />
            </div>
          </div>

          <StateBlock
            v-else-if="!chatStore.currentMessages.length"
            v-bind="STATE_PRESETS.chatThreadEmpty"
          />

          <div
            v-for="message in chatStore.currentMessages"
            v-else
            :key="message.id"
            class="message"
            :class="{
              'message--sent': message.senderId === userId,
              'message--received': message.senderId !== userId,
            }"
          >
            <ChatMessageContent
              :content="message.content"
              :sent="message.senderId === userId"
            />
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

        <div class="chat-page__input">
          <button
            type="button"
            class="chat-page__attach"
            aria-label="Прикрепить фильм из коллекции"
            @click="attachMovie"
          >
            <BaseIcon name="ph:film-slate" :width="20" :height="20" />
          </button>

          <ChatMessageInput
            ref="chatInputRef"
            v-model="messageInput"
            :user-id="userId"
            @send="sendMessage"
          />

          <button
            type="button"
            class="chat-page__send"
            :disabled="!messageInput.trim()"
            aria-label="Отправить"
            @click="sendMessage()"
          >
            <BaseIcon name="ph:paper-plane-right-fill" :width="18" :height="18" />
          </button>
        </div>
      </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/scrollbar" as *;

.chat-page-shell {
  // контейнер как на Друзьях — чтобы отступы/позиция чипа совпадали (нет скачка)
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  text-align: left;
}

.chat-page {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 0;
  overflow: hidden;
  border-radius: var(--fv-radius-lg);
  background: var(--fv-color-bg-primary);
  box-shadow: var(--fv-shadow-low);

  &__sidebar {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--fv-color-border);
  }

  &__sidebar-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 20px 18px 14px;
  }

  &__title {
    font-size: var(--fv-text-h4-size);
    line-height: var(--fv-text-h4-lh);
    font-weight: 500;
    margin: 0;
  }

  // В сети — зелёным (эталон)
  &__header-status--online {
    color: var(--fv-color-positive);
  }

  &__conversations {
    flex: 1;
    min-width: 0;
    overflow-y: auto;

    @include customScrollbar();
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
  }

  &__sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 1.25rem;
    text-align: center;
  }

  &__sidebar-empty-hint {
    margin: 0;
    max-width: 18rem;
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--fv-color-text-secondary);
  }

  &__main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--fv-color-border);
  }

  &__header-back {
    display: none; // видна только на мобиле (одна панель за раз)
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border: none;
    border-radius: 50%;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }
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
    font-weight: 500;
    font-size: 1.125rem;
  }

  &__header-status {

    font-size: 0.875rem;
    color: var(--fv-color-text-secondary);
  }

  &__messages {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;

    @include customScrollbar();
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--fv-color-bg-secondary);
  }

  // Скелетон сообщений: чередующиеся «пузыри» слева/справа
  &__msg-skel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    .msg-skel {
      display: flex;

      &--sent {
        justify-content: flex-end;
      }

      &--received {
        justify-content: flex-start;
      }
    }
  }


  &__input {
    padding: 12px 16px;
    border-top: 1px solid var(--fv-color-border);
    background: var(--fv-color-bg-primary);
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  &__attach,
  &__send {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    transition: background var(--fv-motion-fast) var(--fv-ease);
  }

  &__attach {
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);

    &:hover {
      background: color-mix(
        in srgb,
        var(--fv-color-text-primary) 8%,
        var(--fv-color-bg-secondary)
      );
    }
  }

  &__send {
    background: var(--fv-color-brand);
    color: #fff;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--fv-color-brand), #000 10%);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }
}

// Мобайл: одна панель за раз (список ИЛИ переписка) — иначе 2 колонки не влезают
@media (max-width: 768px) {
  .chat-page-shell {
    // высота с учётом верхней шапки + нижнего таб-бара; отступы — как на Друзьях
    height: calc(100dvh - 128px);
  }

  .chat-page {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .chat-page__main {
    display: none;
  }

  .chat-page--conversation {
    .chat-page__sidebar {
      display: none;
    }

    .chat-page__main {
      display: flex;
    }
  }

  .chat-page__header-back {
    display: inline-flex;
  }

  .message {
    max-width: 85%;
  }
}

.conversation-item {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background var(--fv-motion-fast) var(--fv-ease);

  &:hover {
    background: var(--fv-color-bg-secondary);
  }

  &--active {
    background: color-mix(in srgb, var(--fv-color-accent) 10%, transparent);
  }

  &__avatar {
    margin-right: 12px;
  }

  &__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
  }

  &__username {
    min-width: 0;
    font-weight: 500;
    color: var(--fv-color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__time {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--fv-color-text-tertiary);
    white-space: nowrap;
  }

  &__message {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__preview {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    color: var(--fv-color-text-secondary);

    &--unread {
      font-weight: 500;
      color: var(--fv-color-text-primary);
    }
  }

  &__badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 12px;
    font-weight: 500;
  }
}

/* Цветной аватар диалога/шапки (эталон) */
.chat-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: #fff;
  font-weight: 500;
  font-size: 1.1rem;

  &--sm {
    width: 40px;
    height: 40px;
    font-size: 1rem;
  }
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 82%;
  min-width: 0;

  &--sent {
    align-self: flex-end;
    align-items: flex-end;
  }

  &--received {
    align-self: flex-start;
    align-items: flex-start;
  }

  &__time {
    margin: 0 6px;
    font-size: 11px;
    color: var(--fv-color-text-tertiary);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__read {
    color: var(--fv-color-positive);
  }
}

</style>
