<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue";
import SkeletonBar from "@/components/Skeleton/SkeletonBar.vue";
import StateBlock from "@/components/StateBlock/StateBlock.vue";
import NotificationEventCard from "./NotificationEventCard.vue";
import type { NotificationEvent, NotificationView } from "./center.types";

const props = defineProps<{
  items: NotificationEvent[];
  filterKey?: string;
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
const reduced =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)")
    : undefined;
const exitFrames = [{ opacity: 1 }, { opacity: 0 }];
const enterFrames = [{ opacity: 0 }, { opacity: 1 }];

watch(
  [
    () => props.view,
    () => props.filterKey,
    () => props.ready,
    () => props.error,
    () => JSON.stringify(props.items.map((item) => item.id)),
  ],
  async (
    [view, filter, ready, error, ids],
    [oldView, oldFilter, wasReady, oldError, oldIds],
    onCleanup
  ) => {
    const root = content.value;

    if (
      !ready ||
      !wasReady ||
      reduced?.matches ||
      typeof root?.animate !== "function"
    )
      return;

    const changed = ids !== oldIds;
    const crossfade =
      !error &&
      !oldError &&
      (changed
        ? filter !== oldFilter
        : view !== oldView && props.items.length > 0);

    if (!crossfade && !changed && error === oldError) return;

    const snapshot = crossfade
      ? (root.cloneNode(true) as HTMLElement)
      : undefined;
    let animation: Animation | undefined;
    let cancelled = false;

    function cancel(): void {
      if (cancelled) return;
      cancelled = true;
      animation?.cancel();
      snapshot?.remove();
    }

    reduced?.addEventListener?.("change", cancel);
    onCleanup(() => {
      reduced?.removeEventListener?.("change", cancel);
      cancel();
    });

    await nextTick();
    if (cancelled || reduced?.matches) return;

    if (snapshot) {
      snapshot.classList.add("notification-events__snapshot");
      snapshot.setAttribute("inert", "");
      snapshot.setAttribute("aria-hidden", "true");
      root.after(snapshot);
    }

    animation = (snapshot ?? root).animate(snapshot ? exitFrames : enterFrames, {
      duration: 180,
      easing: "ease-out",
    });

    if (snapshot) animation.onfinish = () => snapshot.remove();
  }
);
</script>
<template>
  <div class="notification-events-stage">
    <div
      ref="content"
      class="notification-events"
      :class="'notification-events--' + (ready && !items.length ? 'list' : view)"
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
.notification-events-stage {
  position: relative;
}
.notification-events__snapshot {
  position: absolute;
  inset: 0;
  overflow: clip;
  align-content: start;
  pointer-events: none;
  background: var(--fv-color-bg-primary);
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
