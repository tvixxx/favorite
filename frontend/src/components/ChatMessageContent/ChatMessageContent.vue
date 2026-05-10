<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { parseChatMessageContent } from "@/utils/chatMessageSegments";

const props = defineProps<{
  content: string;
}>();

const segments = computed(() => parseChatMessageContent(props.content));

function parseDetailLink(url: string): { id: string; title: string | null } | null {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) {
      return null;
    }

    const m = u.pathname.match(/^\/detail\/([^/]+)\/?$/);
    if (!m) {
      return null;
    }

    return { id: m[1], title: u.searchParams.get("shareTitle") };
  } catch {
    return null;
  }
}
</script>

<template>
  <span class="chat-msg-content">
    <template v-for="(seg, idx) in segments" :key="idx">
      <span v-if="seg.type === 'text'" class="chat-msg-content__text">{{
        seg.text
      }}</span>
      <template v-else-if="seg.type === 'movie'">
        <RouterLink
          v-if="parseDetailLink(seg.url)"
          class="chat-msg-content__link"
          :to="{ name: 'detail', params: { id: parseDetailLink(seg.url)!.id } }"
        >
          {{ seg.title }}
        </RouterLink>
        <a
          v-else
          class="chat-msg-content__link"
          :href="seg.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ seg.title }}</a
        >
      </template>
      <template v-else-if="seg.type === 'link'">
        <RouterLink
          v-if="parseDetailLink(seg.url)"
          class="chat-msg-content__link"
          :to="{ name: 'detail', params: { id: parseDetailLink(seg.url)!.id } }"
        >
          {{ parseDetailLink(seg.url)?.title || seg.url }}
        </RouterLink>
        <a
          v-else
          class="chat-msg-content__link"
          :href="seg.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ seg.url }}</a
        >
      </template>
    </template>
  </span>
</template>

<style scoped lang="scss">
.chat-msg-content {
  white-space: pre-wrap;
  word-break: break-word;

  &__text {
    white-space: pre-wrap;
  }

  &__link {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 600;
  }
}
</style>
