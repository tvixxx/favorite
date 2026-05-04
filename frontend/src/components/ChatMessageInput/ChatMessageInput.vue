<script setup lang="ts">
import { ref, onUnmounted, nextTick, watch } from "vue";
import { useRouter } from "vue-router";
import { Input, Tag } from "ant-design-vue";
import { findHashMention } from "@/utils/hashMention";
import {
  fetchUserCollectionSuggestions,
  findUserMovieByQuotedTitle,
} from "@/composable/useFetchUserCollectionSuggestions";
import type { UserMovie } from "@/stores/movies/types/movies.types";
import { formatUserMovieShareTitle } from "@/utils/movieShareTitle";
import BaseIcon from "@/components/BaseIcon/BaseIcon.vue";
import type { MovieChip } from "@/utils/chatComposeExpand";
import {
  alignChipsToQuotedTitles,
  expandMessageWithMovieUrls,
  stripMovieUrlsFromText,
} from "@/utils/chatComposeExpand";

const props = defineProps<{
  modelValue: string;
  userId: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [string];
  send: [wireContent: string];
}>();

const router = useRouter();
const textareaRef = ref<{ $el?: HTMLElement } | null>(null);

const chips = ref<MovieChip[]>([]);

const mentionOpen = ref(false);
const suggestions = ref<UserMovie[]>([]);
const activeIndex = ref(0);
const mentionLoading = ref(false);
const mentionQueryNonEmpty = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let enrichTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

function getNativeTextarea(): HTMLTextAreaElement | null {
  const root = textareaRef.value?.$el;

  if (!root) {
    return null;
  }

  return root.querySelector("textarea");
}

function closeMention() {
  mentionOpen.value = false;
  suggestions.value = [];
  mentionLoading.value = false;
  mentionQueryNonEmpty.value = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function syncMentionFromValue(text: string, caret: number) {
  const m = findHashMention(text, caret);
  if (!m) {
    closeMention();

    return;
  }

  mentionOpen.value = true;
  activeIndex.value = 0;

  const q = m.query.trim();
  mentionQueryNonEmpty.value = q.length >= 1;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (q.length < 1) {
    suggestions.value = [];
    mentionLoading.value = false;

    return;
  }

  mentionLoading.value = true;
  debounceTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    try {
      const list = await fetchUserCollectionSuggestions(props.userId, q);

      if (seq !== searchSeq) {
        return;
      }

      suggestions.value = list;
      activeIndex.value = Math.min(
        activeIndex.value,
        Math.max(0, list.length - 1)
      );
    } finally {
      if (seq === searchSeq) {
        mentionLoading.value = false;
      }
    }
  }, 280);
}

function onUpdateValue(v: string) {
  emit("update:modelValue", v);
}

function scheduleEnrichMissing(text: string) {
  if (enrichTimer) {
    clearTimeout(enrichTimer);
  }

  enrichTimer = setTimeout(() => void enrichMissingChips(text), 400);
}

watch(
  () => props.modelValue,
  (v) => {
    chips.value = alignChipsToQuotedTitles(v, chips.value);
    nextTick(() => {
      const ta = getNativeTextarea();
      const caret = ta?.selectionStart ?? v.length;
      syncMentionFromValue(v, caret);
      if (v.includes("«")) {
        scheduleEnrichMissing(v);
      }
    });
  },
  { immediate: true }
);

async function enrichMissingChips(text: string) {
  if (!props.userId?.trim() || !text.includes("«")) {
    return;
  }

  const uniqueTitles = new Set<string>();
  const re = /«([^»]+)»/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    uniqueTitles.add(m[1]);
  }

  const additions: MovieChip[] = [];

  for (const title of uniqueTitles) {
    if (chips.value.some((c) => c.title === title)) {
      continue;
    }

    const um = await findUserMovieByQuotedTitle(props.userId, title);

    if (um) {
      additions.push({
        movieId: um.movieId,
        title: formatUserMovieShareTitle(um),
      });
    }
  }

  if (additions.length === 0) {
    return;
  }

  chips.value = alignChipsToQuotedTitles(text, [...chips.value, ...additions]);
}

function onCaretSync() {
  nextTick(() => {
    const ta = getNativeTextarea();

    if (!ta) {
      return;
    }

    syncMentionFromValue(props.modelValue, ta.selectionStart ?? 0);
  });
}

function pickSuggestion(um: UserMovie) {
  const ta = getNativeTextarea();
  const caret = ta?.selectionStart ?? props.modelValue.length;
  const text = props.modelValue;
  const state = findHashMention(text, caret);

  if (!state) {
    return;
  }

  const before = text.slice(0, state.hashIndex);
  const after = text.slice(caret);
  const title = formatUserMovieShareTitle(um);
  const insert = `«${title}» `;
  const next = before + insert + after;
  const mergedPool = chips.value.some((c) => c.movieId === um.movieId)
    ? chips.value
    : [...chips.value, { movieId: um.movieId, title }];
  chips.value = alignChipsToQuotedTitles(next, mergedPool);
  emit("update:modelValue", next);
  closeMention();

  nextTick(() => {
    const el = getNativeTextarea();
    const pos = before.length + insert.length;
    el?.focus();
    el?.setSelectionRange(pos, pos);
  });
}

function removeChipAt(displayIndex: number) {
  const chip = chips.value[displayIndex];
  if (!chip) {
    chips.value = alignChipsToQuotedTitles(props.modelValue, chips.value);

    return;
  }

  const escaped = chip.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const newText = props.modelValue.replace(
    new RegExp(`«${escaped}»\\s*`, "g"),
    ""
  );
  emit("update:modelValue", newText);
}

function onPaste(e: ClipboardEvent) {
  const pasted = e.clipboardData?.getData("text/plain");

  if (pasted == null) {
    return;
  }

  e.preventDefault();

  const ta = getNativeTextarea();

  if (!ta) {
    return;
  }

  const start = ta.selectionStart ?? 0;
  const end = ta.selectionEnd ?? 0;
  const before = props.modelValue.slice(0, start);
  const after = props.modelValue.slice(end);
  const merged = before + pasted + after;
  const { cleaned, extracted } = stripMovieUrlsFromText(merged);
  const { cleaned: pastedClean } = stripMovieUrlsFromText(pasted);
  const pool = [...chips.value, ...extracted];

  chips.value = alignChipsToQuotedTitles(cleaned, pool);

  emit("update:modelValue", cleaned);

  const newCaret = start + pastedClean.length;

  nextTick(() => {
    const el = getNativeTextarea();
    el?.focus();
    el?.setSelectionRange(newCaret, newCaret);
    void enrichMissingChips(cleaned);
  });
}

function emitSend() {
  const wire = expandMessageWithMovieUrls(
    props.modelValue,
    chips.value,
    router
  );
  emit("send", wire);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && e.shiftKey) {
    return;
  }

  if (e.key === "Enter") {
    if (mentionOpen.value && suggestions.value.length > 0) {
      e.preventDefault();

      const um = suggestions.value[activeIndex.value];

      if (um) {
        pickSuggestion(um);
      }

      return;
    }

    e.preventDefault();
    emitSend();

    return;
  }

  if (!mentionOpen.value || suggestions.value.length === 0) {
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + suggestions.value.length) %
      suggestions.value.length;
  } else if (e.key === "Escape") {
    e.preventDefault();
    closeMention();
  }
}

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (enrichTimer) {
    clearTimeout(enrichTimer);
  }
});

defineExpose({
  composeWire: () =>
    expandMessageWithMovieUrls(props.modelValue, chips.value, router),
});
</script>

<template>
  <div class="chat-message-input">
    <div v-if="chips.length > 0" class="chat-message-input__chips">
      <Tag
        v-for="(chip, idx) in chips"
        :key="chip.movieId"
        class="chat-message-input__chip"
        closable
        @close="removeChipAt(idx)"
      >
        {{ chip.title }}
      </Tag>
    </div>

    <div class="chat-message-input__field">
      <Input.TextArea
        ref="textareaRef"
        :value="modelValue"
        :disabled="disabled"
        :auto-size="{ minRows: 1, maxRows: 6 }"
        placeholder="Введите сообщение… (# — фильм из вашей коллекции)"
        class="chat-message-input__textarea"
        @update:value="onUpdateValue"
        @keydown="onKeydown"
        @click="onCaretSync"
        @keyup="onCaretSync"
        @paste="onPaste"
      />
    </div>

    <Transition name="chat-mention-fade">
      <div
        v-show="mentionOpen"
        class="chat-message-input__mention"
        role="listbox"
      >
        <div v-if="mentionLoading" class="chat-message-input__mention-hint">
          Поиск…
        </div>
        <template v-else-if="suggestions.length > 0">
          <button
            v-for="(um, idx) in suggestions"
            :key="um.movieId"
            type="button"
            class="chat-message-input__mention-item"
            :class="{
              'chat-message-input__mention-item--active': idx === activeIndex,
            }"
            role="option"
            @mousedown.prevent
            @click="pickSuggestion(um)"
          >
            <BaseIcon
              class="chat-message-input__mention-icon"
              name="mdi:movie-open-outline"
              :width="18"
              :height="18"
            />
            <span class="chat-message-input__mention-text">
              {{ um.movie.title }}
              <span
                v-if="um.movie.isSerial"
                class="chat-message-input__mention-serial"
                >(сериал)</span
              >
            </span>
          </button>
        </template>
        <div
          v-else-if="mentionQueryNonEmpty"
          class="chat-message-input__mention-hint"
        >
          В коллекции ничего не найдено
        </div>
        <div v-else class="chat-message-input__mention-hint">
          Начните вводить название после #
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.chat-message-input {
  position: relative;
  flex: 1;
  min-width: 0;

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
    min-height: 0;
  }

  &__chip {
    margin: 0 !important;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__field {
    width: 100%;
  }

  &__textarea {
    width: 100%;
  }

  &__mention {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
    max-height: 240px;
    overflow-y: auto;
    z-index: 50;
    padding: 0.35rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    box-shadow: 0 8px 28px color-mix(in srgb, #000 12%, transparent);
  }

  &__mention-hint {
    padding: 0.6rem 0.75rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  &__mention-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.6rem;
    margin: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover,
    &--active {
      background: color-mix(
        in srgb,
        var(--ant-color-primary) 10%,
        var(--bg-secondary)
      );
    }
  }

  &__mention-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--ant-color-primary);
    opacity: 0.9;
  }

  &__mention-text {
    min-width: 0;
    line-height: 1.35;
  }

  &__mention-serial {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.88em;
  }
}

.chat-mention-fade-enter-active,
.chat-mention-fade-leave-active {
  transition: opacity 0.15s ease;
}

.chat-mention-fade-enter-from,
.chat-mention-fade-leave-to {
  opacity: 0;
}
</style>
