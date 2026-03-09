<script lang="ts" setup>
import { watch } from "vue";
import { useDebounceFn } from "@vueuse/core";

const DEFAULT_DEBOUNCE_TIME = 300;
const DEFAULT_MIN_CHARS = 3;
const DEFAULT_SEARCH_QUERY_TEXT = "";

const inputValue = defineModel<string>("");

const {
  btnLabel,
  placeholder,
  size = "large",
  searchHandler,
  debounceMs = DEFAULT_DEBOUNCE_TIME,
  minChars = DEFAULT_MIN_CHARS,
} = defineProps<{
  btnLabel: string;
  placeholder: string;
  size?: "small" | "medium" | "large";
  searchHandler: (value: string) => Promise<void>;
  debounceMs?: number;
  minChars?: number;
}>();

const debouncedSearch = useDebounceFn((value: string) => {
  searchHandler(value);
}, debounceMs);

watch(inputValue, (value) => {
  const query = value ?? DEFAULT_SEARCH_QUERY_TEXT;

  if (query.length === 0) {
    searchHandler(DEFAULT_SEARCH_QUERY_TEXT);
    return;
  }

  if (query.length >= minChars) {
    debouncedSearch(query);
  }
});
</script>

<template>
  <a-input-search
    v-model:value="inputValue"
    :enter-button="btnLabel"
    :placeholder="placeholder"
    :size="size"
    class="input-search"
    @search="searchHandler"
  />
</template>

<style lang="scss">
.input-search {
  max-width: 100%;
}
</style>
