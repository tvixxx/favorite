import { computed, ref, watch, type ComputedRef, type Ref } from "vue";

const INTERACTIVE =
  'button, a, input, textarea, select, label, video, audio, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="combobox"], [data-sheet-swipe-ignore]';

export function useSheetSwipe(
  element: Ref<HTMLElement | null>,
  enabled: () => boolean,
  close: () => void
): {
  dragStyle: ComputedRef<{ transform: string; transition: string } | undefined>;
  onTouchStart: (event: TouchEvent) => void;
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  reset: () => void;
  captureOffset: () => void;
} {
  const offset = ref(0);
  let start: { x: number; y: number; time: number; id: number } | undefined;
  const dragging = ref(false);

  const dragStyle = computed(() =>
    dragging.value
      ? { transform: `translateY(${offset.value}px)`, transition: "none" }
      : undefined
  );

  function reset(): void {
    offset.value = 0;
    start = undefined;
    dragging.value = false;
  }

  function canStart(target: Element): boolean {
    if (target.closest(INTERACTIVE)) return false;
    if (target.closest("[data-sheet-handle]")) return true;
    if (!target.closest("[data-sheet-scroll]")) return false;

    for (
      let node: Element | null = target;
      node && node !== element.value;
      node = node.parentElement
    ) {
      if (node.scrollTop > 1) return false;
      if (
        node.scrollWidth > node.clientWidth + 1 &&
        /auto|scroll/.test(getComputedStyle(node).overflowX)
      )
        return false;
    }

    return true;
  }

  function onTouchStart(event: TouchEvent): void {
    reset();
    if (
      !enabled() ||
      event.touches.length !== 1 ||
      !(event.target instanceof Element) ||
      !canStart(event.target)
    )
      return;

    const point = event.touches[0];

    start = {
      x: point.clientX,
      y: point.clientY,
      time: event.timeStamp,
      id: point.identifier,
    };
  }

  function update(point: Touch): number | undefined {
    if (!start || point.identifier !== start.id) {
      reset();

      return;
    }

    const x = point.clientX - start.x;
    const y = point.clientY - start.y;

    if (
      !dragging.value &&
      (y < -8 || (Math.abs(x) > 8 && Math.abs(x) >= Math.abs(y)))
    ) {
      reset();

      return;
    }

    if (y > 8) dragging.value = true;
    if (dragging.value) offset.value = Math.max(0, y);

    return Math.max(0, y);
  }

  function onTouchMove(event: TouchEvent): void {
    if (!enabled() || event.touches.length !== 1 || !event.cancelable) {
      reset();

      return;
    }

    update(event.touches[0]);
    if (dragging.value && event.cancelable) event.preventDefault();
  }

  function captureOffset(): void {
    const sheet = element.value;

    if (!sheet) return;

    const matrix = /^matrix(3d)?\((.+)\)$/.exec(
      getComputedStyle(sheet).transform
    );
    const y = matrix
      ? Number(matrix[2].split(",")[matrix[1] ? 13 : 5])
      : offset.value;

    sheet.style.setProperty("--fv-sheet-drag", `${Math.max(0, y || 0)}px`);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (
      !enabled() ||
      !start ||
      event.touches.length ||
      !event.changedTouches.length
    ) {
      reset();

      return;
    }

    const elapsed = Math.max(1, event.timeStamp - start.time);
    const distance = update(event.changedTouches[0]);

    if (
      dragging.value &&
      distance !== undefined &&
      (distance > 90 || (distance >= 28 && distance / elapsed > 0.5))
    ) {
      captureOffset();
      close();
    }

    reset();
  }

  watch(enabled, reset);

  return {
    dragStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    reset,
    captureOffset,
  };
}
