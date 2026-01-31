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

// todo: расскоментировать если добавится новый вид иконок
// const customIcon = computed(() => {
//   if (props.source !== "iconify") {
//     return defineAsyncComponent(
//       () => import(`@components/icons/${props.name}.vue`)
//     );
//   } else {
//     return null;
//   }
// });
</script>

<template>
  <Icon v-if="isIconifySource" :icon="name" :width="width" :heigth="height" />

  <!--  <component v-else :is="customIcon" :width="width" :height="height" />-->
</template>

<style scoped></style>
