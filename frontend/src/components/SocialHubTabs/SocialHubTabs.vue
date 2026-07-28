<script setup lang="ts">
/**
 * Переключатель соцхаба «Общение»: Чат · Друзья (эталон handoff-new-6).
 * Чипы (серый + рамка), активный — тёмный (.chip.on). У «Чат» — бейдж непрочитанного.
 * Активная вкладка определяется по текущему маршруту.
 */
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";

const props = withDefaults(
  defineProps<{
    /** Число непрочитанных сообщений для бейджа на «Чат» */
    unreadCount?: number;
  }>(),
  { unreadCount: 0 },
);

const route = useRoute();
const router = useRouter();

const isChat = computed(() => route.path.startsWith("/chat"));
const badge = computed(() =>
  props.unreadCount > 99 ? "99+" : String(props.unreadCount),
);

const goChat = (): void => {
  if (!isChat.value) {
    router.push("/chat");
  }
};

const goFriends = (): void => {
  if (isChat.value) {
    router.push("/friends");
  }
};
</script>

<template>
  <div class="social-hub" role="tablist" aria-label="Общение">
    <button
      type="button"
      role="tab"
      class="social-hub__chip"
      :class="{ 'social-hub__chip--active': isChat }"
      :aria-selected="isChat"
      @click="goChat"
    >
      <BaseIcon name="ph:chat-circle" :width="17" :height="17" />
      Чат
      <span v-if="unreadCount > 0" class="social-hub__badge">{{ badge }}</span>
    </button>

    <button
      type="button"
      role="tab"
      class="social-hub__chip"
      :class="{ 'social-hub__chip--active': !isChat }"
      :aria-selected="!isChat"
      @click="goFriends"
    >
      <BaseIcon name="ph:users" :width="17" :height="17" />
      Друзья
    </button>
  </div>
</template>

<style scoped lang="scss">
.social-hub {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    // Эталон .chip: 36px, серая заливка в покое
    height: 36px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: var(--fv-color-bg-secondary);
    color: var(--fv-color-text-primary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--fv-motion-fast) var(--fv-ease),
      color var(--fv-motion-fast) var(--fv-ease),
      border-color var(--fv-motion-fast) var(--fv-ease);

    &:hover {
      background: var(--fv-color-bg-hover);
    }

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 2px solid var(--fv-color-accent);
      outline-offset: 2px;
    }

    &--active {
      background: var(--fv-color-text-primary);
      color: var(--fv-color-bg-primary);
      border-color: transparent;

      &:hover {
        background: color-mix(in srgb, var(--fv-color-text-primary), #fff 16%);
        color: var(--fv-color-bg-primary);
      }
    }
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--fv-color-brand);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
}
</style>
