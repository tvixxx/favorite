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

function eventCards(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-event-id]"));
}

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
    const filtering = changed && filter !== oldFilter && !error && !oldError;
    const crossfade =
      view !== oldView &&
      !changed &&
      !error &&
      !oldError &&
      props.items.length > 0;

    if (!crossfade && !changed && error === oldError) return;

    const snapshot =
      crossfade || filtering
        ? (root.cloneNode(crossfade) as HTMLElement)
        : undefined;
    const positions = new Map<string, DOMRect>();

    if (filtering && snapshot) {
      const origin = root.getBoundingClientRect();
      const nextIds = new Set(props.items.map((item) => item.id));

      for (const card of eventCards(root)) {
        const id = card.dataset.eventId!;
        const rect = card.getBoundingClientRect();

        if (nextIds.has(id)) positions.set(id, rect);
        else {
          const copy = card.cloneNode(true) as HTMLElement;

          copy.classList.add("notification-events__leaving");
          Object.assign(copy.style, {
            left: `${rect.left - origin.left}px`,
            top: `${rect.top - origin.top - root.clientTop}px`,
            width: `${rect.width}px`,
          });

          snapshot.append(copy);
        }
      }
    }

    const animations: Animation[] = [];
    let cancelled = false;

    function cancel(): void {
      if (cancelled) return;
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
      snapshot?.remove();
    }

    function play(
      element: HTMLElement,
      frames: Parameters<HTMLElement["animate"]>[0],
      duration: number
    ): Animation {
      const animation = element.animate(frames, {
        duration,
        easing: "ease-out",
      });

      animations.push(animation);

      return animation;
    }

    reduced?.addEventListener?.("change", cancel);
    onCleanup(() => {
      reduced?.removeEventListener?.("change", cancel);
      cancel();
    });

    await nextTick();
    if (cancelled || reduced?.matches) return;

    if (filtering) {
      // Measure the final layout before applying transforms or inserting the old layer.
      const cards = Array.from(eventCards(root), (card) => ({
        card,
        previous: positions.get(card.dataset.eventId!),
        rect: card.getBoundingClientRect(),
      }));

      for (const { card, previous, rect } of cards) {
        if (!previous) play(card, enterFrames, 150);
        else {
          const x = previous.left - rect.left;
          const y = previous.top - rect.top;

          if (Math.abs(x) >= 1 || Math.abs(y) >= 1)
            play(
              card,
              [
                { transform: `translate(${x}px, ${y}px)` },
                { transform: "none" },
              ],
              220
            );
        }
      }
    } else if (!crossfade) play(root, enterFrames, 180);

    if (snapshot?.childElementCount) {
      snapshot.classList.add("notification-events__snapshot");
      snapshot.classList.toggle(
        "notification-events__snapshot--view",
        crossfade
      );

      snapshot.setAttribute("inert", "");
      snapshot.setAttribute("aria-hidden", "true");
      root.after(snapshot);
      play(snapshot, exitFrames, crossfade ? 180 : 150).onfinish = () =>
        snapshot.remove();
    }
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
        :data-event-id="item.id"
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
}
.notification-events__snapshot--view,
.notification-events__leaving {
  background: var(--fv-color-bg-primary);
}
.notification-events__leaving {
  position: absolute;
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
