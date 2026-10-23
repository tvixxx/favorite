<script setup lang="ts">
import { onScopeDispose, useTemplateRef, watch } from "vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import NotificationEventCard from "./NotificationEventCard.vue";
import type { NotificationEvent, NotificationView } from "./center.types";

const props = defineProps<{
  items: NotificationEvent[];
  view: NotificationView;
  loading: boolean;
  ready: boolean;
  error: string;
  disabled: boolean;
}>();

defineEmits<{
  read: [item: NotificationEvent];
  update: [item: NotificationEvent];
  full: [item: NotificationEvent];
  navigate: [item: NotificationEvent, path: string];
  retry: [];
}>();

const content = useTemplateRef<HTMLDivElement>("content");
let previousResult: string | undefined;
let animation: Animation | undefined;

watch(
  () => [props.ready, props.loading, props.error, props.items] as const,
  () => {
    if (!props.ready) {
      previousResult = undefined;
      animation?.cancel();
      animation = undefined;

      return;
    }

    if (props.loading) return;

    const result = JSON.stringify([
      props.error,
      props.items.map((item) => item.id),
    ]);
    const changed = previousResult !== undefined && previousResult !== result;

    previousResult = result;
    if (!changed) return;

    animation?.cancel();
    animation = undefined;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      animation = content.value?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease-out",
      });
  },
  { flush: "post", immediate: true }
);

onScopeDispose(() => animation?.cancel());
</script>
<template>
  <div
    ref="content"
    class="notification-events"
    :class="'notification-events--' + view"
    :aria-busy="loading"
  >
    <StateBlock
      v-if="error"
      variant="error"
      :title="error"
      :actions="[{ label: 'Повторить', onClick: () => $emit('retry') }]"
    />
    <template v-if="loading && !ready"
      ><SkeletonBar
        v-for="n in 4"
        :key="n"
        width="100%"
        height="108px"
        radius="12px"
    /></template>
    <NotificationEventCard
      v-for="item in items"
      :key="item.id"
      :item="item"
      :compact="view === 'compact'"
      :disabled="disabled"
      @read="$emit('read', $event)"
      @update="$emit('update', $event)"
      @full="$emit('full', $event)"
      @navigate="(event, path) => $emit('navigate', event, path)"
    />
    <StateBlock
      v-if="ready && !error && !items.length"
      variant="empty"
      title="Событий пока нет"
      description="Попробуйте другой фильтр или измените запрос."
    />
  </div>
</template>
<style scoped lang="scss">
@use "@/styles/media" as *;

.skel {
  animation: notification-loading-delay 0s 250ms both;
}

@keyframes notification-loading-delay {
  from {
    visibility: hidden;
  }
  to {
    visibility: visible;
  }
}

.notification-events {
  padding: 0 22px;
  min-width: 0;
  border-top: 1px solid var(--fv-color-border);
  > .stateblock {
    grid-column: 1 / -1;
  }
  &--grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 18px;
    align-items: start;
  }
  &--grid :deep(.notification-event) {
    padding: 14px 12px;
    border: 1px solid var(--fv-color-border);
    border-radius: 12px;
  }
}
@include mediaMax(1000px) {
  .notification-events--grid {
    grid-template-columns: 1fr;
  }
}
@include mediaMax(767px) {
  .notification-events {
    padding: 0 14px;
    &--grid {
      padding: 12px;
    }
  }
}
</style>
