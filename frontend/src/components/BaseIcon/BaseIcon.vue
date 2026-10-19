<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    default: "iconify",
  },
  width: {
    type: Number,
    default: 20,
  },
  height: {
    type: Number,
    default: 20,
  },
});

const isIconifySource = computed(() => props.source === "iconify");
</script>

<template>
  <Icon v-if="isIconifySource" :icon="name" :width="width" :height="height" />
</template>
