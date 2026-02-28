<script lang="ts" setup>
import { computed } from "vue";

const inputValue = defineModel<string>("");

const props = defineProps<{
  btnLabel: string;
  placeholder: string;
  size?: "small" | "medium" | "large";
  searchHandler: (value: string) => Promise<void>;
}>();

const inputSize = computed(() => props.size || "large");
</script>

<template>
  <a-input-search
    v-model:value="inputValue"
    :enter-button="props.btnLabel"
    :placeholder="props.placeholder"
    :size="inputSize"
    class="input-search"
    @search="searchHandler"
  />
</template>

<style lang="scss">
.input-search {
  max-width: 100%;
}
</style>
