<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import ChatMovieCard from "@/components/ChatMessageContent/ChatMovieCard.vue";
import {
  parseChatMessageContent,
  type ChatMessageSegment,
} from "@/utils/chatMessageSegments";

const props = defineProps<{
  content: string;
  /** Сообщение отправлено текущим пользователем — красный пузырь */
  sent?: boolean;
}>();

type Block =
  | { kind: "text"; segments: ChatMessageSegment[] }
  | { kind: "movie"; url: string; title: string };

// Группируем сегменты в блоки: подряд идущий текст/ссылки → пузырь,
// каждый фильм → отдельная карточка (как в эталоне — не внутри пузыря).
const blocks = computed<Block[]>(() => {
  const segments = parseChatMessageContent(props.content);
  const result: Block[] = [];
  let run: ChatMessageSegment[] = [];

  const flush = (): void => {
    const hasContent = run.some(
      (seg) => seg.type === "link" || (seg.type === "text" && seg.text.trim()),
    );

    if (hasContent) {
      result.push({ kind: "text", segments: run });
    }

    run = [];
  };

  for (const seg of segments) {
    if (seg.type === "movie") {
      flush();
      result.push({ kind: "movie", url: seg.url, title: seg.title });
    } else {
      run.push(seg);
    }
  }

  flush();

  return result;
});

function parseDetailLink(
  url: string,
): { id: string; title: string | null } | null {
  try {
    const parsed = new URL(url, window.location.origin);

    if (parsed.origin !== window.location.origin) {
      return null;
    }

    const match = parsed.pathname.match(/^\/detail\/([^/]+)\/?$/);

    if (!match) {
      return null;
    }

    return { id: match[1], title: parsed.searchParams.get("shareTitle") };
  } catch {
    return null;
  }
}
</script>

<template>
  <template v-for="(block, idx) in blocks" :key="idx">
    <ChatMovieCard
      v-if="block.kind === 'movie'"
      :url="block.url"
      :title="block.title"
    />

    <div
      v-else
      class="chat-bubble"
      :class="sent ? 'chat-bubble--sent' : 'chat-bubble--received'"
    >
      <template v-for="(seg, sidx) in block.segments" :key="sidx">
        <span v-if="seg.type === 'text'">{{ seg.text }}</span>
        <template v-else-if="seg.type === 'link'">
          <RouterLink
            v-if="parseDetailLink(seg.url)"
            class="chat-bubble__link"
            :to="{ name: 'detail', params: { id: parseDetailLink(seg.url)!.id } }"
          >
            {{ parseDetailLink(seg.url)?.title || seg.url }}
          </RouterLink>
          <a
            v-else
            class="chat-bubble__link"
            :href="seg.url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ seg.url }}</a
          >
        </template>
      </template>
    </div>
  </template>
</template>

<style scoped lang="scss">
/* Текстовый пузырь (эталон): красный отправленный / белый полученный, хвост */
.chat-bubble {
  width: fit-content;
  max-width: 100%;
  padding: 11px 14px;
  font-family: var(--fv-font-ui);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;

  &--sent {
    align-self: flex-end;
    background: var(--fv-color-brand);
    color: #fff;
    border-radius: 16px 16px 4px 16px;
  }

  &--received {
    align-self: flex-start;
    background: var(--fv-color-bg-primary);
    color: var(--fv-color-text-primary);
    border-radius: 16px 16px 16px 4px;
    box-shadow: var(--fv-shadow-low);
  }

  &__link {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 500;
  }
}
</style>
