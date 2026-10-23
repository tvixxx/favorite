import { nextTick, onScopeDispose, ref, watch, type Ref } from "vue";

interface ChatRow {
  id: string;
  senderId: string;
}

export function useChatMessageMotion(
  container: Ref<HTMLElement | null>,
  messages: () => readonly ChatRow[],
  peerId: () => string | null,
  loading: () => boolean,
  userId: Ref<string>
): {
  pendingCount: Ref<number>;
  showLatest: () => void;
  onScroll: () => void;
  stopFollowing: () => void;
} {
  const pendingCount = ref(0);
  let previousPeer: string | null | undefined;
  let previousIds: string[] = [];
  let initialized = false;
  let historyLoading = false;
  let revision = 0;
  let frame = 0;
  let following = false;
  const animations = new Set<Animation>();
  let motionGeneration = 0;

  function stopFollowing(): void {
    following = false;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function cancelMotion(): void {
    motionGeneration++;
    stopFollowing();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  }

  function pin(): void {
    frame = 0;
    if (!following || !container.value) return;
    container.value.scrollTop = container.value.scrollHeight;
    if (animations.size) frame = requestAnimationFrame(pin);
  }

  function trackAnimation(animation: Animation): void {
    const generation = motionGeneration;

    animations.add(animation);
    void animation.finished
      .catch(() => undefined)
      .then(() => {
        if (generation !== motionGeneration) return;
        animations.delete(animation);
        if (!animations.size) {
          if (following && container.value)
            container.value.scrollTop = container.value.scrollHeight;
          stopFollowing();
        }
      });
  }

  function atBottom(element: HTMLElement): boolean {
    return element.scrollHeight - element.clientHeight - element.scrollTop < 48;
  }

  function showLatest(): void {
    pendingCount.value = 0;
    following = true;
    pin();
    if (!animations.size) stopFollowing();
  }

  function onScroll(): void {
    if (container.value && atBottom(container.value)) pendingCount.value = 0;
  }

  watch(
    [
      container,
      peerId,
      loading,
      () =>
        messages()
          .map((item) => item.id)
          .join("|"),
    ],
    async ([element, peer, isLoading]) => {
      const current = ++revision;

      if (peer !== previousPeer) {
        cancelMotion();
        pendingCount.value = 0;
        previousPeer = peer;
        previousIds = [];
        initialized = false;
        historyLoading = false;
      }

      if (!element || !peer) return;

      const rows = messages();
      const ids = rows.map((item) => item.id);

      if (isLoading) {
        const pinned = following || atBottom(element);

        cancelMotion();
        if (pinned) element.scrollTop = element.scrollHeight;
        historyLoading = true;
        previousIds = ids;

        return;
      }

      const initial = !initialized;
      const appended =
        !initial &&
        ids.length > previousIds.length &&
        previousIds.every((id, index) => ids[index] === id)
          ? rows.slice(previousIds.length)
          : [];
      const wasAtBottom = atBottom(element);
      const shouldFollow =
        initial ||
        following ||
        wasAtBottom ||
        appended.some((item) => item.senderId === userId.value);
      const animateNew = !initial && !historyLoading && appended.length > 0;

      previousIds = ids;
      initialized = true;
      historyLoading = false;
      if (!initial && !appended.length) return;

      if (initial) cancelMotion();
      await nextTick();
      if (
        current !== revision ||
        container.value !== element ||
        peerId() !== peer
      )
        return;

      if (!shouldFollow) pendingCount.value += appended.length;
      else pendingCount.value = 0;

      if (
        animateNew &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const elements = new Map(
          Array.from(
            element.querySelectorAll<HTMLElement>("[data-chat-message]")
          ).map((row) => [row.dataset.chatMessage, row])
        );
        const gap = parseFloat(getComputedStyle(element).rowGap) || 0;

        appended.forEach((item, index) => {
          const row = elements.get(item.id);

          if (!row) return;

          const height = row.getBoundingClientRect().height;

          trackAnimation(
            row.animate(
              [
                {
                  height: "0px",
                  minHeight: "0px",
                  marginTop:
                    previousIds.length - appended.length + index > 0
                      ? `-${gap}px`
                      : "0px",
                  opacity: 0,
                  overflow: "hidden",
                },
                {
                  height: `${height}px`,
                  minHeight: "0px",
                  marginTop: "0px",
                  opacity: 1,
                  overflow: "hidden",
                },
              ],
              { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" }
            )
          );
        });
      }

      if (shouldFollow) {
        following = true;
        element.scrollTop = element.scrollHeight;
        if (!frame && animations.size) pin();
      }

      if (!animations.size) stopFollowing();
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    revision++;
    cancelMotion();
  });

  return { pendingCount, showLatest, onScroll, stopFollowing };
}
